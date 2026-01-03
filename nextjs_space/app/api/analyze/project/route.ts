export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/db';
import { redactForLLM } from '@/lib/redaction';
import { ProjectAnalysisSchema } from '@/lib/analysis-schemas';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId } = body ?? {};

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Fetch project with repositories
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: session.user.id,
      },
      include: {
        repositories: {
          include: {
            aiAnalysis: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    if (project.repositories.length === 0) {
      return NextResponse.json(
        { error: 'No repositories in this project' },
        { status: 400 }
      );
    }

    const settings = await prisma.portfolioSettings.findUnique({
      where: { userId: session.user.id },
    });

    const parseJsonArray = (val: string | string[] | null | undefined) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      try {
        return JSON.parse(val || '[]');
      } catch {
        return [];
      }
    };

    // Prepare context for AI analysis
    const repoContexts = [...project.repositories]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((repo) => ({
      name: repo.name,
      description: repo.description ?? 'No description',
      language: repo.language ?? 'Unknown',
      topics: parseJsonArray(repo.topics),
      stars: repo.stargazersCount ?? 0,
      size: repo.size ?? 0,
      readme:
        repo.isPrivate && settings?.hidePrivateRepoNames
          ? ''
          : redactForLLM(repo.readmeContent ?? '', { maxLength: 1500 }),
      languages: repo.languages ?? {},
      analysis: repo.aiAnalysis ? {
        techStack: parseJsonArray(repo.aiAnalysis.techStack),
        architecturePatterns: parseJsonArray(repo.aiAnalysis.architecturePatterns),
        skillsDemonstrated: parseJsonArray(repo.aiAnalysis.skillsDemonstrated),
      } : null,
    }));

    async function fetchValidatedAnalysis(): Promise<unknown> {
      const messages = [{ role: 'user', content: prompt }];

      const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          messages,
          stream: false,
          max_tokens: 3000,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        throw new Error('LLM API request failed');
      }

      const json = await response.json();
      const content = json?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new Error('LLM returned empty response');
      }

      const parsed = JSON.parse(content);
      const validated = ProjectAnalysisSchema.safeParse(parsed);
      if (!validated.success) {
        throw new Error('LLM response validation failed');
      }
      return validated.data;
    }

    const prompt = `You are a Senior Engineering Manager assessing a candidate's portfolio project. This 'Project' is a collection of repositories representing different services, iterations, or components of a larger system.
    
    Project Name: ${project.name}
    Project Description: ${project.description || 'No description'}
    
    Repositories involved (Chronological):
    ${repoContexts.map((repo, i) => `
    [Repo ${i + 1}]: ${repo.name}
    - Description: ${repo.description}
    - Stack: ${repo.language} / ${repo.topics.join(', ')}
    - Analysis: ${repo.analysis ? JSON.stringify(repo.analysis.techStack) : 'N/A'}
    `).join('\n')}
    
    YOUR GOAL: Construct the "Developer's Narrative" for a prospective employer.
    
    QUESTIONS TO ANSWER:
    1. SYSTEM THINKING: How do these pieces fit together? Is this a microservices architecture? A frontend/backend split? Or just a collection of random scripts?
    2. GROWTH TRAJECTORY: If these are iterations, how did the code improve? Did they move from vanilla JS to TypeScript? From monolith to serverless?
    3. SPECIALIZATION: What distinct "Engineering Persona" emerges? (e.g., "Strong Backend Systems Engineer", "Product-Focused UI UX Developer", "Data Pipeline Specialist").
    
    CRITICAL RULES:
    - NO FLUFF. Do not say "showcased strong skills". Say "demonstrated proficiency in distributed systems by implementing Raft consensus".
    - BE SPECIFIC. Cite specific technologies and patterns used in the repos.
    - FOCUS ON EMPLOYABILITY. What role would you hire this person for based *only* on this project?
    
    Respond with raw JSON only in this exact structure:
    {
      "technicalSkills": ["list of HARD skills proven by this project"],
      "designDecisions": "<Analysis of architectural choices (e.g. 'Chose SQL over NoSQL because...')>",
      "novelApproaches": "<Any non-standard, creative solutions found?>",
      "testingStrategy": "<Assessment of quality assurance across the project>",
      "problemsSolved": "<The core business or technical problems addressed>",
      "skillDemonstration": "<The 'Engineering Persona' proven by this project (e.g. 'Full Stack Architect')>",
      "architectureInsights": "<How the system scales, handles data, or communicates>",
      "techStack": ["Combined stack"]
    }
    
    Respond with raw JSON only.`;

    // Create a stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          // 1. Send "processing" status
          const progressData = JSON.stringify({
            status: 'processing',
            message: 'Analyzing project evolution...',
          });
          controller.enqueue(encoder.encode(`data: ${progressData}\n\n`));

          // 2. Call OpenRouter via lib/llm
          // We use a specific system prompt for the project analyzer
          const systemPrompt = "You are a CTO-level engineering manager assessing a candidate's portfolio project for technical growth and architectural maturity.";
          
          // Import dynamically to avoid circular dependencies if any, or just standard import
          const { analyzeJSON } = await import('@/lib/llm');
          
          const rawAnalysis = await analyzeJSON(prompt, systemPrompt);

          // 3. Validate
          const validated = ProjectAnalysisSchema.safeParse(rawAnalysis);
          if (!validated.success) {
            throw new Error('Analysis validation failed: ' + validated.error.message);
          }

          const finalAnalysis = validated.data;

          // 4. Save to database
          await prisma.projectAnalysis.upsert({
            where: { projectId: project.id },
            update: {
              technicalSkills: JSON.stringify(finalAnalysis.technicalSkills ?? []) as any,
              designDecisions: finalAnalysis.designDecisions,
              novelApproaches: finalAnalysis.novelApproaches,
              testingStrategy: finalAnalysis.testingStrategy,
              problemsSolved: finalAnalysis.problemsSolved,
              skillDemonstration: finalAnalysis.skillDemonstration,
              architectureInsights: finalAnalysis.architectureInsights,
              techStack: JSON.stringify(finalAnalysis.techStack ?? []) as any,
              updatedAt: new Date(),
            },
            create: {
              projectId: project.id,
              technicalSkills: JSON.stringify(finalAnalysis.technicalSkills ?? []) as any,
              designDecisions: finalAnalysis.designDecisions,
              novelApproaches: finalAnalysis.novelApproaches,
              testingStrategy: finalAnalysis.testingStrategy,
              problemsSolved: finalAnalysis.problemsSolved,
              skillDemonstration: finalAnalysis.skillDemonstration,
              architectureInsights: finalAnalysis.architectureInsights,
              techStack: JSON.stringify(finalAnalysis.techStack ?? []) as any,
            },
          });

          // 5. Send "completed" status
          const finalData = JSON.stringify({
            status: 'completed',
            result: finalAnalysis,
          });
          controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));
          controller.close();

        } catch (error: any) {
          console.error('Analysis error:', error);
          const errorData = JSON.stringify({
            status: 'error',
            message: error?.message || 'Analysis failed',
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Project analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze project' },
      { status: 500 }
    );
  }
}

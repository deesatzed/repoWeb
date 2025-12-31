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

    // Prepare context for AI analysis
    const repoContexts = [...project.repositories]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((repo) => ({
      name: repo.name,
      description: repo.description ?? 'No description',
      language: repo.language ?? 'Unknown',
      topics: repo.topics ?? [],
      stars: repo.stargazersCount ?? 0,
      size: repo.size ?? 0,
      readme:
        repo.isPrivate && settings?.hidePrivateRepoNames
          ? ''
          : redactForLLM(repo.readmeContent ?? '', { maxLength: 1500 }),
      languages: repo.languages ?? {},
      analysis: repo.aiAnalysis ? {
        techStack: repo.aiAnalysis.techStack,
        architecturePatterns: repo.aiAnalysis.architecturePatterns,
        skillsDemonstrated: repo.aiAnalysis.skillsDemonstrated,
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

    const prompt = `You are analyzing a PROJECT composed of multiple related repositories (iterations/versions of the same system). Focus on what this evolution demonstrates about the DEVELOPER's growth, learning, and technical decision-making across iterations.

Project Name: ${project.name}
Project Description: ${project.description || 'No description'}

Repositories in this project (chronological order):
${repoContexts.map((repo, i) => `
Repository ${i + 1}:
- Name: ${repo.name}
- Description: ${repo.description}
- Primary Language: ${repo.language}
- Topics: ${repo.topics.join(', ')}
- Size: ${repo.size} KB
- Languages: ${JSON.stringify(repo.languages)}
- README Preview: ${repo.readme.substring(0, 500)}
${repo.analysis ? `- Previous Analysis:
  - Tech Stack: ${repo.analysis.techStack.join(', ')}
  - Architecture: ${repo.analysis.architecturePatterns.join(', ')}
  - Skills: ${repo.analysis.skillsDemonstrated.join(', ')}` : ''}`).join('\n')}

Analyze what this PROJECT (as a whole) reveals about the DEVELOPER:

1. TECHNICAL EVOLUTION: How did the technology choices and implementations evolve across iterations?
2. DESIGN MATURITY: What design decisions show growth in architectural thinking?
3. PROBLEM-SOLVING PROGRESSION: What challenges were tackled? How did approaches improve?
4. TESTING & QUALITY: How did testing and quality practices evolve?
5. LEARNING DEMONSTRATED: What new technologies or patterns were adopted? Why?
6. ARCHITECTURAL INSIGHTS: What does the final architecture say about the developer's systems thinking?

CRITICAL RULES:
- FOCUS on the developer's technical growth and decision-making across iterations
- NO marketing language about app features
- NO timelines or dollar amounts
- Emphasize LEARNING and IMPROVEMENT visible across versions
- Highlight TRANSFERABLE SKILLS and engineering maturity

Respond with raw JSON only in this exact structure:
{
  "technicalSkills": ["comprehensive list of technical skills demonstrated across all repos"],
  "designDecisions": "<detailed analysis of key architectural and design decisions made, and what they reveal about the developer's thinking>",
  "novelApproaches": "<specific innovative or advanced techniques used that go beyond standard implementation>",
  "testingStrategy": "<analysis of testing approach, quality practices, and how they evolved>",
  "problemsSolved": "<key technical challenges solved across the project and the sophistication of solutions>",
  "skillDemonstration": "<what this project proves about the developer's capabilities - be specific and technical>",
  "architectureInsights": "<analysis of system architecture, scalability considerations, and design patterns>",
  "techStack": ["consolidated tech stack across all repositories"]
}

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`;

    const messages = [
      { role: 'user', content: prompt },
    ];

    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: messages,
        stream: true,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response?.ok) {
      throw new Error('LLM API request failed');
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response?.body?.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = '';
        let partialRead = '';

        try {
          while (true) {
            const { done, value } = (await reader?.read()) ?? {};
            if (done) break;
            
            partialRead += decoder.decode(value ?? new Uint8Array(), { stream: true });
            let lines = partialRead.split('\n');
            partialRead = lines.pop() ?? '';
            
            for (const line of lines ?? []) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  // Parse and save the analysis
                  let analysis: unknown;
                  try {
                    analysis = JSON.parse(buffer);
                  } catch {
                    analysis = null;
                  }

                  let validated = ProjectAnalysisSchema.safeParse(analysis);
                  if (!validated.success) {
                    // Safe retry using non-stream completion
                    const retry = await fetchValidatedAnalysis();
                    validated = ProjectAnalysisSchema.safeParse(retry);
                  }

                  if (!validated.success) {
                    const errorData = JSON.stringify({
                      status: 'error',
                      message: 'Analysis validation failed',
                    });
                    controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
                    controller.close();
                    return;
                  }

                  const finalAnalysis = validated.data;
                  
                  // Save to database
                  await prisma.projectAnalysis.upsert({
                    where: { projectId: project.id },
                    update: {
                      technicalSkills: finalAnalysis.technicalSkills,
                      designDecisions: finalAnalysis.designDecisions,
                      novelApproaches: finalAnalysis.novelApproaches,
                      testingStrategy: finalAnalysis.testingStrategy,
                      problemsSolved: finalAnalysis.problemsSolved,
                      skillDemonstration: finalAnalysis.skillDemonstration,
                      architectureInsights: finalAnalysis.architectureInsights,
                      techStack: finalAnalysis.techStack,
                      updatedAt: new Date(),
                    },
                    create: {
                      projectId: project.id,
                      technicalSkills: finalAnalysis.technicalSkills,
                      designDecisions: finalAnalysis.designDecisions,
                      novelApproaches: finalAnalysis.novelApproaches,
                      testingStrategy: finalAnalysis.testingStrategy,
                      problemsSolved: finalAnalysis.problemsSolved,
                      skillDemonstration: finalAnalysis.skillDemonstration,
                      architectureInsights: finalAnalysis.architectureInsights,
                      techStack: finalAnalysis.techStack,
                    },
                  });

                  const finalData = JSON.stringify({
                    status: 'completed',
                    result: finalAnalysis,
                  });
                  controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));
                  controller.close();
                  return;
                }
                
                try {
                  const parsed = JSON.parse(data);
                  buffer += parsed?.choices?.[0]?.delta?.content || '';
                  const progressData = JSON.stringify({
                    status: 'processing',
                    message: 'Analyzing project...',
                  });
                  controller.enqueue(encoder.encode(`data: ${progressData}\n\n`));
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        } catch (error: any) {
          console.error('Stream error:', error);
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

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/db';
import { redactForLLM } from '@/lib/redaction';
import { RepositoryAnalysisSchema } from '@/lib/analysis-schemas';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { repositoryId } = body ?? {};

    if (!repositoryId) {
      return NextResponse.json(
        { error: 'Repository ID is required' },
        { status: 400 }
      );
    }

    // Fetch repository with connection check
    const repository = await prisma.repository.findFirst({
      where: {
        id: repositoryId,
        githubConnection: {
          userId: session.user.id,
        },
      },
    });

    if (!repository) {
      return NextResponse.json(
        { error: 'Repository not found' },
        { status: 404 }
      );
    }

    const settings = await prisma.portfolioSettings.findUnique({
      where: { userId: session.user.id },
    });

    const shouldOmitPrivateReadme = Boolean(
      repository.isPrivate && settings?.hidePrivateRepoNames
    );

    // Prepare context for AI analysis
    const context = {
      name: repository.name,
      description: repository.description ?? 'No description',
      language: repository.language ?? 'Unknown',
      topics: repository.topics ?? [],
      stars: repository.stargazersCount ?? 0,
      forks: repository.forksCount ?? 0,
      size: repository.size ?? 0,
      readme: shouldOmitPrivateReadme
        ? ''
        : redactForLLM(repository.readmeContent ?? '', { maxLength: 2000 }),
      languages: repository.languages ?? {},
      isPrivate: repository.isPrivate,
      isFork: repository.isFork,
    };

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
          max_tokens: 2000,
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
      const validated = RepositoryAnalysisSchema.safeParse(parsed);
      if (!validated.success) {
        throw new Error('LLM response validation failed');
      }
      return validated.data;
    }

    const prompt = `You are analyzing a software project to assess the BUILDER's capabilities, NOT to advertise the application itself. Focus on what this project demonstrates about the developer's technical skills, decision-making, and engineering maturity.

Repository Information:
- Name: ${context.name}
- Description: ${context.description}
- Primary Language: ${context.language}
- Topics/Tags: ${context.topics.join(', ')}
- Stars: ${context.stars}
- Forks: ${context.forks}
- Size: ${context.size} KB
- Languages: ${JSON.stringify(context.languages)}
- Is Fork: ${context.isFork}
- README Preview: ${context.readme.substring(0, 1000)}

Analyze what this project reveals about the DEVELOPER's skills:

1. TECHNICAL SKILLS: What specific technologies, frameworks, and tools did the builder demonstrate competency in?
2. DESIGN DECISIONS: What architectural or design patterns are evident? Why might they have chosen these approaches?
3. PROBLEM SOLVING: What technical challenges did this project likely require solving? What does the solution approach reveal?
4. ENGINEERING MATURITY: Evidence of testing, documentation, code quality practices, deployment considerations?
5. NOVEL/ADVANCED TECHNIQUES: Any sophisticated or innovative approaches that go beyond basic implementation?

CRITICAL RULES:
- NO marketing fluff about the app's features
- NO dollar amounts or business metrics
- NO generic timelines
- FOCUS on what the code and architecture demonstrate about the builder's capabilities
- Be specific and technical
- Emphasize skills that transfer to other projects

Respond with raw JSON only in this exact structure:
{
  "complexityScore": <number 0-100 based on technical sophistication>,
  "codeQualityScore": <number 0-100 based on engineering practices>,
  "projectType": "<type of application>",
  "techStack": ["specific technologies used"],
  "keyFeatures": ["technical capabilities implemented, not user features"],
  "strengths": ["specific technical strengths demonstrated by the builder"],
  "architecturePatterns": ["design patterns, architectural decisions visible"],
  "summary": "<2-3 sentences about what this project demonstrates about the builder's technical capabilities>",
  "employerHighlights": "<What specific skills or technical decisions make this builder hireable? Focus on transferable engineering competencies, not app features>",
  "skillsDemonstrated": ["specific technical skills: e.g. 'API design', 'state management', 'database optimization', 'authentication implementation']",
  "linesOfCode": <estimated>,
  "fileCount": <estimated>,
  "hasTests": <boolean>,
  "hasDocumentation": <boolean>,
  "hasCiCd": <boolean>,
  "contributionPattern": "<Solo Project|Team Collaboration|Open Source>"
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
        max_tokens: 2000,
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

                  let validated = RepositoryAnalysisSchema.safeParse(analysis);
                  if (!validated.success) {
                    // Safe retry using non-stream completion
                    const retry = await fetchValidatedAnalysis();
                    validated = RepositoryAnalysisSchema.safeParse(retry);
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
                  await prisma.aIAnalysis.upsert({
                    where: { repositoryId: repository.id },
                    update: {
                      complexityScore: finalAnalysis.complexityScore,
                      codeQualityScore: finalAnalysis.codeQualityScore,
                      projectType: finalAnalysis.projectType,
                      techStack: finalAnalysis.techStack,
                      keyFeatures: finalAnalysis.keyFeatures,
                      strengths: finalAnalysis.strengths,
                      architecturePatterns: finalAnalysis.architecturePatterns,
                      summary: finalAnalysis.summary,
                      employerHighlights: finalAnalysis.employerHighlights,
                      skillsDemonstrated: finalAnalysis.skillsDemonstrated,
                      linesOfCode: finalAnalysis.linesOfCode ?? null,
                      fileCount: finalAnalysis.fileCount ?? null,
                      hasTests: finalAnalysis.hasTests,
                      hasDocumentation: finalAnalysis.hasDocumentation,
                      hasCiCd: finalAnalysis.hasCiCd,
                      contributionPattern: finalAnalysis.contributionPattern,
                      updatedAt: new Date(),
                    },
                    create: {
                      repositoryId: repository.id,
                      complexityScore: finalAnalysis.complexityScore,
                      codeQualityScore: finalAnalysis.codeQualityScore,
                      projectType: finalAnalysis.projectType,
                      techStack: finalAnalysis.techStack,
                      keyFeatures: finalAnalysis.keyFeatures,
                      strengths: finalAnalysis.strengths,
                      architecturePatterns: finalAnalysis.architecturePatterns,
                      summary: finalAnalysis.summary,
                      employerHighlights: finalAnalysis.employerHighlights,
                      skillsDemonstrated: finalAnalysis.skillsDemonstrated,
                      linesOfCode: finalAnalysis.linesOfCode ?? null,
                      fileCount: finalAnalysis.fileCount ?? null,
                      hasTests: finalAnalysis.hasTests,
                      hasDocumentation: finalAnalysis.hasDocumentation,
                      hasCiCd: finalAnalysis.hasCiCd,
                      contributionPattern: finalAnalysis.contributionPattern,
                    },
                  });

                  // Update repository last analyzed time
                  await prisma.repository.update({
                    where: { id: repository.id },
                    data: { lastAnalyzedAt: new Date() },
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
                    message: 'Analyzing repository...',
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
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze repository' },
      { status: 500 }
    );
  }
}

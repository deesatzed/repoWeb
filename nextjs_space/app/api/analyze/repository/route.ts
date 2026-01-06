import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/db';
import { redactForLLM } from '@/lib/redaction';
import { RepositoryAnalysisSchema } from '@/lib/analysis-schemas';
import { analyzeJSON } from '@/lib/llm';
import { GitHubService } from '@/lib/github-api';
import { decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

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

    const parseJsonArray = (val: string | string[]) => {
      if (Array.isArray(val)) return val;
      try {
        return JSON.parse(val || '[]');
      } catch {
        return [];
      }
    };

    // Fetch repository files for evidence-backed analysis
    let fileContents: Array<{ path: string; content: string }> = [];
    try {
      const gitHubConnection = await prisma.gitHubConnection.findFirst({
        where: { userId: session.user.id },
      });

      if (gitHubConnection?.githubToken) {
        const githubService = new GitHubService(gitHubConnection.githubToken);
        const [owner, repoName] = repository.name.split('/');
        fileContents = await githubService.getRepositoryFiles(owner, repoName, '', 8);
      }
    } catch (err) {
      console.warn('Failed to fetch repository files for analysis:', err);
    }

    // Prepare context for AI analysis
    const context = {
      name: repository.name,
      description: repository.description ?? 'No description',
      language: repository.language ?? 'Unknown',
      topics: parseJsonArray(repository.topics),
      stars: repository.stargazersCount ?? 0,
      forks: repository.forksCount ?? 0,
      size: repository.size ?? 0,
      readme: shouldOmitPrivateReadme
        ? ''
        : redactForLLM(repository.readmeContent ?? '', { maxLength: 2000 }),
      languages: repository.languages ?? {},
      isPrivate: repository.isPrivate,
      isFork: repository.isFork,
      files: fileContents.slice(0, 5).map(f => ({
        path: f.path,
        content: f.content.substring(0, 1500),
      })),
    };

    const prompt = `You are a cynical, high-bar CTO reviewing a candidate's code repository to determine if they are worth interviewing.

    Repository Context:
    - Name: ${context.name}
    - Description: ${context.description}
    - Language: ${context.language}
    - Topics: ${context.topics.join(', ')}
    - Stars/Forks: ${context.stars} / ${context.forks}
    - README Preview: ${context.readme.substring(0, 1500)}

    ${context.files.length > 0 ? `
    Sample Files for Evidence-Based Analysis:
    ${context.files.map(f => `
    File: ${f.path}
    Content:
    ${f.content}
    `).join('\n---\n')}
    ` : ''}

    TASK: Deep technical analysis for a "Senior Engineer" or "Lead" role.

    CRITICAL INSTRUCTIONS:
    1. EVIDENCE-BASED ONLY: Do not say "excellent code quality" unless you cite specific patterns (e.g., "Dependency injection used for service layers", "Comprehensive unit testing with Jest").
    2. EMPLOYER FOCUS: What ROI does this person bring? Do they solve hard problems (scalability, security, performance) or just build CRUD apps?
    3. DETECT JUNK/TUTORIALS: If this is a tutorial-style repo, be blunt. If it's a fork with zero changes, flag it.
    4. PERSONA: You are looking for system thinking, architectural awareness, and production readiness.
    5. CITATIONS: For each key claim (strengths, features, patterns), provide a citation with the file path, line number (approximate), and a short code snippet.

    Analyze specifically for:
    - ARCHITECTURAL DEPTH: MVC, Microservices, Event-driven, DDD, etc.
    - OPERATIONAL EXCELLENCE: CI/CD, Monitoring, Error handling, Logging.
    - DOMAIN EXPERTISE: Does this show deep knowledge of ${context.language} or specific industries (e.g. Fintech, Healthcare)?

    Respond with raw JSON only in this exact structure:
    {
      "complexityScore": <number 0-100, be strict, tutorial=10, production=90>,
      "codeQualityScore": <number 0-100>,
      "projectType": "<e.g. 'Production-Grade System', 'Technical Proof of Concept', 'Open Source Library'>",
      "techStack": ["specific libs/frameworks"],
      "keyFeatures": ["feature 1 (technical detail)", "feature 2"],
      "strengths": ["architectural strength 1", "operational strength 2"],
      "architecturePatterns": ["pattern 1", "pattern 2"],
      "summary": "<2 sentence technical value proposition for a hiring manager>",
      "employerHighlights": "<A 'Killer Feature' or specific reason this code proves senior-level skill.>",
      "skillsDemonstrated": ["skill 1", "skill 2"],
      "linesOfCode": <estimated>,
      "fileCount": <estimated>,
      "hasTests": <boolean>,
      "hasDocumentation": <boolean>,
      "hasCiCd": <boolean>,
      "contributionPattern": "<Solo Project|Team Collaboration|Open Source>",
      "citations": [
        {
          "claim": "Specific claim about code quality or architecture",
          "filePath": "path/to/file.ext",
          "lineNumber": <number>,
          "codeSnippet": "<short code excerpt (max 500 chars) supporting the claim>"
        }
      ]
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
            message: 'Analyzing repository...',
          });
          controller.enqueue(encoder.encode(`data: ${progressData}\n\n`));

          // 2. Call OpenRouter
          const rawAnalysis = await analyzeJSON(prompt, 'You are a senior technical recruiter and engineering manager.');

          // Normalize contributionPattern to schema enum
          const normalizeContributionPattern = (val: any): 'Solo Project' | 'Team Collaboration' | 'Open Source' => {
            if (!val) return 'Solo Project';
            const v = String(val).toLowerCase();
            if (v.includes('team')) return 'Team Collaboration';
            if (v.includes('open')) return 'Open Source';
            return 'Solo Project';
          };
          const normalizedAnalysis = {
            ...((rawAnalysis as Record<string, unknown>) ?? {}),
            contributionPattern: normalizeContributionPattern((rawAnalysis as any)?.contributionPattern),
          };

          // 3. Validate
          const validated = RepositoryAnalysisSchema.safeParse(normalizedAnalysis);
          if (!validated.success) {
            throw new Error('Analysis validation failed: ' + validated.error.message);
          }

          const finalAnalysis = validated.data;

          // 4. Save to DB
          await prisma.aIAnalysis.upsert({
            where: { repositoryId: repository.id },
            update: {
              complexityScore: finalAnalysis.complexityScore,
              codeQualityScore: finalAnalysis.codeQualityScore,
              projectType: finalAnalysis.projectType,
              techStack: JSON.stringify(finalAnalysis.techStack ?? []) as any,
              keyFeatures: JSON.stringify(finalAnalysis.keyFeatures ?? []) as any,
              strengths: JSON.stringify(finalAnalysis.strengths ?? []) as any,
              architecturePatterns: JSON.stringify(finalAnalysis.architecturePatterns ?? []) as any,
              summary: finalAnalysis.summary,
              employerHighlights: finalAnalysis.employerHighlights,
              skillsDemonstrated: JSON.stringify(finalAnalysis.skillsDemonstrated ?? []) as any,
              linesOfCode: finalAnalysis.linesOfCode ?? null,
              fileCount: finalAnalysis.fileCount ?? null,
              hasTests: finalAnalysis.hasTests,
              hasDocumentation: finalAnalysis.hasDocumentation,
              hasCiCd: finalAnalysis.hasCiCd,
              contributionPattern: finalAnalysis.contributionPattern,
              citations: JSON.stringify(finalAnalysis.citations ?? []) as any,
              updatedAt: new Date(),
            },
            create: {
              repositoryId: repository.id,
              complexityScore: finalAnalysis.complexityScore,
              codeQualityScore: finalAnalysis.codeQualityScore,
              projectType: finalAnalysis.projectType,
              techStack: JSON.stringify(finalAnalysis.techStack ?? []) as any,
              keyFeatures: JSON.stringify(finalAnalysis.keyFeatures ?? []) as any,
              strengths: JSON.stringify(finalAnalysis.strengths ?? []) as any,
              architecturePatterns: JSON.stringify(finalAnalysis.architecturePatterns ?? []) as any,
              summary: finalAnalysis.summary,
              employerHighlights: finalAnalysis.employerHighlights,
              skillsDemonstrated: JSON.stringify(finalAnalysis.skillsDemonstrated ?? []) as any,
              linesOfCode: finalAnalysis.linesOfCode ?? null,
              fileCount: finalAnalysis.fileCount ?? null,
              hasTests: finalAnalysis.hasTests,
              hasDocumentation: finalAnalysis.hasDocumentation,
              hasCiCd: finalAnalysis.hasCiCd,
              contributionPattern: finalAnalysis.contributionPattern,
              citations: JSON.stringify(finalAnalysis.citations ?? []) as any,
            },
          });

          // Update repository last analyzed time
          await prisma.repository.update({
            where: { id: repository.id },
            data: { lastAnalyzedAt: new Date() },
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
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze repository' },
      { status: 500 }
    );
  }
}

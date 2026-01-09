import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';
import { redactForLLM } from '@/lib/redaction';
import { RepositoryAnalysisSchema } from '@/lib/analysis-schemas';
import { analyzeJSON } from '@/lib/llm';
import { GitHubService } from '@/lib/github-api';
import { decrypt } from '@/lib/encryption';
import { auth } from '@/lib/auth';

const SINGLE_USER_ID = 'single-user';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) {
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

    // Fetch repository
    const repositories = await db.getRepositories(SINGLE_USER_ID);
    const repository = repositories.find(r => r.id === repositoryId);

    if (!repository) {
      return NextResponse.json(
        { error: 'Repository not found' },
        { status: 404 }
      );
    }

    const settings = await db.getSettings(SINGLE_USER_ID);

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
      const gitHubConnection = await db.getGitHubConnection(SINGLE_USER_ID);

      if (gitHubConnection?.githubToken) {
        const githubService = new GitHubService(gitHubConnection.githubToken);
        const repoSlug = repository.fullName || repository.name;
        let owner = '';
        let repoName = '';

        if (repoSlug.includes('/')) {
          [owner, repoName] = repoSlug.split('/');
        } else if (gitHubConnection.githubUsername) {
          owner = gitHubConnection.githubUsername;
          repoName = repoSlug;
        }

        if (owner && repoName) {
          fileContents = await githubService.getRepositoryFiles(owner, repoName, '', 8);
        } else {
          console.warn('Skipping file fetch: missing owner/repo', {
            repositoryId: repository.id,
            repoSlug,
          });
        }
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

    const prompt = `You are a Technical Portfolio Writer creating accomplishment-focused descriptions for a developer's portfolio.

    Repository Context:
    - Name: ${context.name}
    - Description: ${context.description}
    - Primary Language: ${context.language}
    - Topics: ${context.topics.join(', ')}
    - Community Interest: ${context.stars} stars, ${context.forks} forks
    - README Preview: ${context.readme.substring(0, 1500)}

    ${context.files.length > 0 ? `
    Code Samples:
    ${context.files.map(f => `
    File: ${f.path}
    \`\`\`
    ${f.content}
    \`\`\`
    `).join('\n---\n')}
    ` : ''}

    TASK: Write an accomplishment-focused analysis. NO RATINGS OR SCORES. Focus on WHAT WAS BUILT and SKILLS USED.

    WRITING STYLE:
    1. ACCOMPLISHMENT-FOCUSED: Describe what the project DOES and what was BUILT
    2. TECH-FORWARD: Emphasize specific technologies, frameworks, and tools used
    3. SKILLS-BASED: Highlight concrete skills demonstrated (not vague praise)
    4. NO FLUFF: Be specific and factual, not generic or promotional
    5. NO NEGATIVES: Never mention limitations or what's missing

    WHAT TO EXTRACT:
    - What does this application/tool DO? (one clear sentence)
    - What specific technologies power it?
    - What technical skills does building this demonstrate?
    - Any novel approaches or interesting implementation details?
    - Any measurable results, metrics, or outcomes (if evident from README or code)

    Respond with raw JSON only:
    {
      "projectType": "<e.g. 'CLI Tool', 'Web Application', 'ML Pipeline', 'API Service', 'Data Analysis'>",
      "summary": "<1-2 sentences: What does this project DO? Be specific about its purpose and functionality.>",
      "techStack": ["specific framework/library 1", "tool 2", "technology 3"],
      "keyFeatures": ["concrete feature 1", "concrete feature 2"],
      "skillsDemonstrated": ["specific skill 1", "specific skill 2", "specific skill 3"],
      "keyResults": ["<measurable outcome, metric, or achievement if any - e.g. '95% accuracy on test set', 'Processes 10K requests/sec', 'Reduced build time by 40%'>"],
      "novelApproaches": "<Any interesting or novel technical approaches used. If none obvious, describe the main technical approach.>",
      "architecturePatterns": ["pattern 1 if any"],
      "hasTests": <boolean>,
      "hasDocumentation": <boolean>,
      "hasCiCd": <boolean>,
      "contributionPattern": "<Solo Project|Team Collaboration|Open Source>"
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
          const rawAnalysis = await analyzeJSON(prompt, 'You are a supportive portfolio advisor who highlights the positive aspects of code and helps developers present their best work to employers.');

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
          await db.updateRepository(repository.id, {
            aiAnalysis: {
              projectType: finalAnalysis.projectType,
              summary: finalAnalysis.summary ?? '',
              techStack: finalAnalysis.techStack ?? [],
              keyFeatures: finalAnalysis.keyFeatures ?? [],
              skillsDemonstrated: finalAnalysis.skillsDemonstrated ?? [],
              keyResults: finalAnalysis.keyResults ?? [],
              novelApproaches: finalAnalysis.novelApproaches ?? '',
              architecturePatterns: finalAnalysis.architecturePatterns ?? [],
              hasTests: finalAnalysis.hasTests ?? false,
              hasDocumentation: finalAnalysis.hasDocumentation ?? false,
              hasCiCd: finalAnalysis.hasCiCd ?? false,
              contributionPattern: finalAnalysis.contributionPattern,
            },
            lastAnalyzedAt: new Date().toISOString()
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

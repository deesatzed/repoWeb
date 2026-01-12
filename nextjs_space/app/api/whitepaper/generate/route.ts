import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';
import { redactForLLM } from '@/lib/redaction';
import { WhitepaperSchema } from '@/lib/analysis-schemas';
import { analyzeJSON } from '@/lib/llm';
import { GitHubService } from '@/lib/github-api';
import { auth } from '@/lib/auth';
import { createHash, randomBytes } from 'crypto';

const SINGLE_USER_ID = 'single-user';

function generateWhitepaperHash(repositoryId: string): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(8).toString('hex');
  const hash = createHash('sha256')
    .update(`${repositoryId}-${timestamp}-${random}`)
    .digest('hex')
    .substring(0, 16);
  return `wp-${hash}`;
}

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
          fileContents = await githubService.getRepositoryFiles(owner, repoName, '', 30);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch repository files for whitepaper:', err);
    }

    const analysis = repository.aiAnalysis;
    const context = {
      name: repository.name,
      fullName: repository.fullName,
      displayName: repository.displayName || analysis?.displayTitle || repository.name,
      description: repository.description ?? 'No description',
      language: repository.language ?? 'Unknown',
      topics: parseJsonArray(repository.topics),
      stars: repository.stargazersCount ?? 0,
      forks: repository.forksCount ?? 0,
      size: repository.size ?? 0,
      readme: shouldOmitPrivateReadme
        ? ''
        : redactForLLM(repository.readmeContent ?? '', { maxLength: 5000 }),
      languages: repository.languages ?? {},
      isPrivate: repository.isPrivate,
      isFork: repository.isFork,
      analysis: analysis ? {
        projectType: analysis.projectType,
        summary: analysis.summary,
        techStack: analysis.techStack,
        keyFeatures: analysis.keyFeatures,
        skillsDemonstrated: analysis.skillsDemonstrated,
        keyResults: analysis.keyResults,
        novelApproaches: analysis.novelApproaches,
        architecturePatterns: analysis.architecturePatterns,
        hasTests: analysis.hasTests,
        hasDocumentation: analysis.hasDocumentation,
        hasCiCd: analysis.hasCiCd,
        employerHighlights: analysis.employerHighlights,
        strengths: analysis.strengths,
      } : null,
      files: fileContents.map(f => ({
        path: f.path,
        content: f.content.substring(0, 3000),
      })),
    };

    const prompt = `You are a Senior Software Engineer and Technical Writer creating an in-depth whitepaper for expert software engineers.

REPOSITORY CONTEXT:
- Name: ${context.name}
- Display Title: ${context.displayName}
- Description: ${context.description}
- Primary Language: ${context.language}
- Topics: ${context.topics.join(', ')}
- Community Interest: ${context.stars} stars, ${context.forks} forks
- Repository Size: ${context.size} KB

${context.analysis ? `
EXISTING AI ANALYSIS:
- Project Type: ${context.analysis.projectType}
- Summary: ${context.analysis.summary}
- Tech Stack: ${context.analysis.techStack.join(', ')}
- Key Features: ${context.analysis.keyFeatures.join('; ')}
- Skills Demonstrated: ${context.analysis.skillsDemonstrated.join(', ')}
${context.analysis.keyResults?.length ? `- Key Results: ${context.analysis.keyResults.join('; ')}` : ''}
${context.analysis.novelApproaches ? `- Novel Approaches: ${context.analysis.novelApproaches}` : ''}
${context.analysis.architecturePatterns?.length ? `- Architecture Patterns: ${context.analysis.architecturePatterns.join(', ')}` : ''}
${context.analysis.employerHighlights ? `- Employer Highlights: ${context.analysis.employerHighlights}` : ''}
${context.analysis.strengths?.length ? `- Strengths: ${context.analysis.strengths.join(', ')}` : ''}
` : ''}

README CONTENT:
${context.readme.substring(0, 4000)}

${context.files.length > 0 ? `
SOURCE CODE SAMPLES (${context.files.length} files):
${context.files.map((f, i) => `
File ${i + 1}: ${f.path}
\`\`\`
${f.content}
\`\`\`
`).join('\n---\n')}
` : ''}

TASK: Generate a comprehensive technical whitepaper for expert software engineers. This should be a deep-dive technical document that demonstrates sophisticated understanding of the codebase.

CRITICAL: PROTECT PROPRIETARY INTELLECTUAL PROPERTY
- Focus on ARCHITECTURE, PATTERNS, and METHODOLOGY — not specific business logic or proprietary algorithms
- Explain the technical approach at a level that demonstrates expertise without revealing unique IP
- Use generic descriptions for proprietary components (e.g., "custom algorithm" instead of specific implementation details)
- Highlight the sophistication and technical challenges without exposing trade secrets
- Make it INTRIGUING for other experts — show interesting technical choices and sophisticated patterns

WRITING REQUIREMENTS:
1. EXPERT AUDIENCE: Write for senior engineers who understand complex systems. Use proper terminology and assume technical literacy.
2. EVIDENCE-BASED: Ground all claims in actual code analysis. Cite specific files, functions, and patterns you observe.
3. ARCHITECTURAL DEPTH: Explain not just WHAT the code does, but WHY it was designed that way.
4. IMPLEMENTATION DETAILS: Include specific algorithms, data structures, and design patterns used.
5. TRADEOFFS: Discuss design decisions with alternatives considered and rationale.
6. NO FLUFF: Every sentence should add technical value. Avoid generic statements.
7. INTRIGUE & EDUCATION: Make other experts curious about the technical approach while protecting proprietary specifics.

WHITEPAPER STRUCTURE:
- Title: Professional, descriptive title for the whitepaper
- Abstract: 200-300 word executive summary of the technical approach
- Sections: 4-6 main sections covering:
  1. System Overview & Architecture
  2. Core Algorithms & Data Structures
  3. Design Patterns & Architectural Patterns
  4. Implementation Details (with code references)
  5. Performance & Scalability Considerations
  6. Security & Reliability (if applicable)
- Technical Specs: Structured technical specifications
- Implementation Notes: Specific technical observations with file references
- Tradeoffs: Key design decisions with alternatives and rationale

Respond with raw JSON only:
{
  "title": "<Professional technical whitepaper title>",
  "abstract": "<200-300 word executive summary>",
  "sections": [
    {
      "heading": "<Section heading>",
      "content": "<Detailed technical content, 300-500 words>",
      "subsections": [
        {
          "heading": "<Subsection heading>",
          "content": "<Detailed technical content, 200-300 words>"
        }
      ]
    }
  ],
  "technicalSpecs": {
    "architecture": "<High-level architecture description, 200-300 words>",
    "designPatterns": ["<pattern 1>", "<pattern 2>"],
    "keyAlgorithms": ["<algorithm 1>", "<algorithm 2>"],
    "dataStructures": ["<structure 1>", "<structure 2>"],
    "performanceCharacteristics": "<Performance analysis if applicable>",
    "securityConsiderations": "<Security analysis if applicable>",
    "scalabilityApproach": "<Scalability analysis if applicable>"
  },
  "implementationNotes": [
    {
      "topic": "<Technical topic>",
      "details": "<Detailed explanation with specific observations>",
      "codeReferences": ["<file/path:line>", "<file/path:line>"]
    }
  ],
  "tradeoffs": [
    {
      "decision": "<Design decision made>",
      "alternatives": ["<alternative 1>", "<alternative 2>"],
      "rationale": "<Why this decision was made, with technical reasoning>"
    }
  ],
  "generatedAt": "<ISO timestamp>"
}

Respond with raw JSON only.`;

    const protectedPrompt = `You are a Senior Software Engineer and Technical Writer creating a comprehensive technical whitepaper for expert software engineers.

REPOSITORY CONTEXT:
- Name: ${context.name}
- Display Title: ${context.displayName}
- Description: ${context.description}
- Primary Language: ${context.language}
- Topics: ${context.topics.join(', ')}
- Community Interest: ${context.stars} stars, ${context.forks} forks
- Repository Size: ${context.size} KB

${context.analysis ? `
EXISTING AI ANALYSIS:
- Project Type: ${context.analysis.projectType}
- Summary: ${context.analysis.summary}
- Tech Stack: ${context.analysis.techStack.join(', ')}
- Key Features: ${context.analysis.keyFeatures.join('; ')}
- Skills Demonstrated: ${context.analysis.skillsDemonstrated.join(', ')}
${context.analysis.keyResults?.length ? `- Key Results: ${context.analysis.keyResults.join('; ')}` : ''}
${context.analysis.novelApproaches ? `- Novel Approaches: ${context.analysis.novelApproaches}` : ''}
${context.analysis.architecturePatterns?.length ? `- Architecture Patterns: ${context.analysis.architecturePatterns.join(', ')}` : ''}
${context.analysis.employerHighlights ? `- Employer Highlights: ${context.analysis.employerHighlights}` : ''}
${context.analysis.strengths?.length ? `- Strengths: ${context.analysis.strengths.join(', ')}` : ''}
` : ''}

README CONTENT:
${context.readme.substring(0, 4000)}

${context.files.length > 0 ? `
SOURCE CODE SAMPLES (${context.files.length} files):
${context.files.map((f, i) => `
File ${i + 1}: ${f.path}
\`\`\`
${f.content}
\`\`\`
`).join('\n---\n')}
` : ''}

TASK: Generate a comprehensive technical whitepaper for expert software engineers with FULL technical depth including proprietary details. This is for trusted recipients (recruiters, employers) who need complete understanding.

WRITING REQUIREMENTS:
1. EXPERT AUDIENCE: Write for senior engineers who understand complex systems. Use proper terminology and assume technical literacy.
2. EVIDENCE-BASED: Ground all claims in actual code analysis. Cite specific files, functions, and patterns you observe.
3. ARCHITECTURAL DEPTH: Explain not just WHAT the code does, but WHY it was designed that way.
4. IMPLEMENTATION DETAILS: Include specific algorithms, data structures, and design patterns used.
5. TRADEOFFS: Discuss design decisions with alternatives considered and rationale.
6. NO FLUFF: Every sentence should add technical value. Avoid generic statements.
7. FULL DEPTH: Include proprietary algorithms, business logic, and specific implementation details.

WHITEPAPER STRUCTURE:
- Title: Professional, descriptive title for the whitepaper
- Abstract: 200-300 word executive summary of the technical approach
- Sections: 4-6 main sections covering:
  1. System Overview & Architecture
  2. Core Algorithms & Data Structures
  3. Design Patterns & Architectural Patterns
  4. Implementation Details (with code references)
  5. Performance & Scalability Considerations
  6. Security & Reliability (if applicable)
- Technical Specs: Structured technical specifications including proprietary algorithms and business logic
- Implementation Notes: Specific technical observations with file references
- Tradeoffs: Key design decisions with alternatives and rationale

Respond with raw JSON only:
{
  "title": "<Professional technical whitepaper title>",
  "abstract": "<200-300 word executive summary>",
  "sections": [
    {
      "heading": "<Section heading>",
      "content": "<Detailed technical content, 300-500 words>",
      "subsections": [
        {
          "heading": "<Subsection heading>",
          "content": "<Detailed technical content, 200-300 words>"
        }
      ]
    }
  ],
  "technicalSpecs": {
    "architecture": "<High-level architecture description, 200-300 words>",
    "designPatterns": ["<pattern 1>", "<pattern 2>"],
    "keyAlgorithms": ["<algorithm 1>", "<algorithm 2>"],
    "dataStructures": ["<structure 1>", "<structure 2>"],
    "performanceCharacteristics": "<Performance analysis if applicable>",
    "securityConsiderations": "<Security analysis if applicable>",
    "scalabilityApproach": "<Scalability analysis if applicable>",
    "proprietaryAlgorithms": ["<proprietary algorithm 1>", "<proprietary algorithm 2>"],
    "businessLogic": "<Detailed business logic explanation>"
  },
  "implementationNotes": [
    {
      "topic": "<Technical topic>",
      "details": "<Detailed explanation with specific observations>",
      "codeReferences": ["<file/path:line>", "<file/path:line>"]
    }
  ],
  "tradeoffs": [
    {
      "decision": "<Design decision made>",
      "alternatives": ["<alternative 1>", "<alternative 2>"],
      "rationale": "<Why this decision was made, with technical reasoning>"
    }
  ],
  "generatedAt": "<ISO timestamp>"
}

Respond with raw JSON only.`;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          const progressData = JSON.stringify({
            status: 'processing',
            message: 'Generating public whitepaper...',
          });
          controller.enqueue(encoder.encode(`data: ${progressData}\n\n`));

          const rawWhitepaper = await analyzeJSON(
            prompt,
            'You are a senior software engineer and technical writer specializing in deep technical documentation for expert audiences.'
          );

          const validated = WhitepaperSchema.safeParse(rawWhitepaper);
          if (!validated.success) {
            console.error('Public whitepaper validation failed:', validated.error);
            throw new Error(
              'Public whitepaper validation failed: ' + validated.error.message
            );
          }

          const publicWhitepaper = validated.data;

          const protectedProgressData = JSON.stringify({
            status: 'processing',
            message: 'Generating protected whitepaper...',
          });
          controller.enqueue(encoder.encode(`data: ${protectedProgressData}\n\n`));

          const rawProtectedWhitepaper = await analyzeJSON(
            protectedPrompt,
            'You are a senior software engineer and technical writer specializing in deep technical documentation for expert audiences.'
          );

          const protectedValidated = WhitepaperSchema.safeParse(rawProtectedWhitepaper);
          if (!protectedValidated.success) {
            console.error('Protected whitepaper validation failed:', protectedValidated.error);
            throw new Error(
              'Protected whitepaper validation failed: ' + protectedValidated.error.message
            );
          }

          const protectedWhitepaper = {
            ...protectedValidated.data,
            technicalSpecs: {
              ...protectedValidated.data.technicalSpecs,
              proprietaryAlgorithms: (rawProtectedWhitepaper as any)?.technicalSpecs?.proprietaryAlgorithms || [],
              businessLogic: (rawProtectedWhitepaper as any)?.technicalSpecs?.businessLogic || '',
            },
          };

          const whitepaperHash = generateWhitepaperHash(repository.id);

          await db.updateRepository(repository.id, {
            whitepaper: publicWhitepaper,
            whitepaperHash,
            protectedWhitepaper,
          });

          const finalData = JSON.stringify({
            status: 'completed',
            result: {
              public: publicWhitepaper,
              protected: protectedWhitepaper,
              hash: whitepaperHash,
            },
          });
          controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));
          controller.close();

        } catch (error: any) {
          console.error('Whitepaper generation error:', error);
          const errorData = JSON.stringify({
            status: 'error',
            message: error?.message || 'Whitepaper generation failed',
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
    console.error('Whitepaper API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate whitepaper' },
      { status: 500 }
    );
  }
}

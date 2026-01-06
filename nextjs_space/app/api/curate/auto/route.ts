
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { analyzeJSON } from '@/lib/llm';
import { z } from 'zod';
import { validateWorkflowAction, transitionWorkflowState } from '@/lib/workflow-state';

export const dynamic = 'force-dynamic';

// Schema for the LLM response
const AutoCurateSchema = z.object({
  excludedRepoIds: z.array(z.string()),
  projects: z.array(z.object({
    name: z.string(),
    description: z.string(),
    repositoryIds: z.array(z.string()),
  })),
  reasoning: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // WORKFLOW VALIDATION: Cannot auto-curate until all repos are analyzed
    const workflowCheck = await validateWorkflowAction(
      session.user.id,
      'ANALYZED',
      'generate AI grouping suggestions'
    );

    if (!workflowCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Workflow validation failed',
          reason: workflowCheck.reason,
          currentState: workflowCheck.currentState,
          requiredState: 'ANALYZED',
          hint: 'All included repositories must be analyzed before AI can suggest groupings',
        },
        { status: 403 }
      );
    }

    // Require explicit user intent to prevent accidental auto-runs
    const body = await request.json().catch(() => ({}));
    if (body?.intent !== 'manual') {
      return NextResponse.json(
        { error: 'Auto-curate requires explicit intent' },
        { status: 400 }
      );
    }

    const mode: 'preview' | 'apply' = body?.mode === 'preview' ? 'preview' : 'apply';

    // 1. Fetch all repositories for the user WITH AI ANALYSIS
    const repositories = await prisma.repository.findMany({
      where: {
        githubConnection: {
          userId: session.user.id,
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        language: true,
        topics: true,
        stargazersCount: true,
        isFork: true,
        updatedAt: true,
        // CRITICAL: Include AI analysis for intelligent grouping
        aiAnalysis: {
          select: {
            complexityScore: true,
            codeQualityScore: true,
            projectType: true,
            techStack: true,
            keyFeatures: true,
            strengths: true,
            architecturePatterns: true,
            summary: true,
            skillsDemonstrated: true,
            hasTests: true,
            hasDocumentation: true,
            hasCiCd: true,
            contributionPattern: true,
          },
        },
      },
    });

    if (repositories.length === 0) {
      return NextResponse.json({ message: 'No repositories to curate' });
    }

    // PHASE 3B: Analysis Validation Before Grouping
    // Belt-and-suspenders check: Ensure all INCLUDED repos have AI analysis
    const includedRepos = repositories.filter(r => !r.isFork || r.stargazersCount > 0);
    const reposWithoutAnalysis = includedRepos.filter(r => !r.aiAnalysis);

    if (reposWithoutAnalysis.length > 0) {
      return NextResponse.json(
        {
          error: 'Analysis validation failed',
          message: `${reposWithoutAnalysis.length} repositories lack AI analysis data`,
          unanalyzedRepos: reposWithoutAnalysis.map(r => ({
            id: r.id,
            name: r.name,
          })),
          hint: 'All included repositories must be analyzed before generating grouping suggestions',
        },
        { status: 400 }
      );
    }

    const userRepoIdSet = new Set(repositories.map((r) => r.id));

    const validateOwnership = (plan: z.infer<typeof AutoCurateSchema>) => {
      const unknownRepoIds: string[] = [];

      for (const id of plan.excludedRepoIds ?? []) {
        if (!userRepoIdSet.has(id)) unknownRepoIds.push(id);
      }
      for (const project of plan.projects ?? []) {
        for (const id of project.repositoryIds ?? []) {
          if (!userRepoIdSet.has(id)) unknownRepoIds.push(id);
        }
      }

      if (unknownRepoIds.length > 0) {
        return { ok: false as const, unknownRepoIds };
      }

      return { ok: true as const };
    };

    // Helper to parse JSON string fields
    const parseJsonArray = (val: string | string[] | null | undefined) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      try {
        return JSON.parse(val || '[]');
      } catch {
        return [];
      }
    };

    // 2. Prepare context for LLM with RICH AI ANALYSIS DATA
    const repoList = repositories.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description || '',
      language: r.language || 'Unknown',
      topics: parseJsonArray(r.topics),
      stars: r.stargazersCount,
      isFork: r.isFork,
      lastUpdate: r.updatedAt.toISOString().split('T')[0],
      // AI ANALYSIS DATA (if available)
      analysis: r.aiAnalysis ? {
        complexityScore: r.aiAnalysis.complexityScore,
        codeQualityScore: r.aiAnalysis.codeQualityScore,
        projectType: r.aiAnalysis.projectType,
        techStack: parseJsonArray(r.aiAnalysis.techStack),
        keyFeatures: parseJsonArray(r.aiAnalysis.keyFeatures),
        strengths: parseJsonArray(r.aiAnalysis.strengths),
        architecturePatterns: parseJsonArray(r.aiAnalysis.architecturePatterns),
        summary: r.aiAnalysis.summary,
        skillsDemonstrated: parseJsonArray(r.aiAnalysis.skillsDemonstrated),
        hasTests: r.aiAnalysis.hasTests,
        hasDocumentation: r.aiAnalysis.hasDocumentation,
        hasCiCd: r.aiAnalysis.hasCiCd,
        contributionPattern: r.aiAnalysis.contributionPattern,
      } : null,
    }));

    const prompt = `You are an expert Technical Recruiter and Engineering Manager organizing a candidate's portfolio.

    You have a list of ${repoList.length} GitHub repositories with DEEP AI ANALYSIS DATA.
    Your goal is to ORGANIZE them into a clean, employer-ready portfolio using the technical analysis provided.

    CRITICAL: BE HIGHLY SELECTIVE. If a repository seems like a tutorial, "Hello World", or low-value exercise, EXCLUDE it.
    The user complained that the previous grouping was too broad (e.g., non-medical repos grouped under medical).

    ANALYSIS-DRIVEN GROUPING RULES:
    1. USE AI ANALYSIS DATA: Each repo has:
       - analysis.projectType (e.g., "Production-Grade System", "Proof of Concept")
       - analysis.techStack (specific frameworks/libraries)
       - analysis.architecturePatterns (e.g., "Microservices", "Event-Driven")
       - analysis.skillsDemonstrated (technical skills shown)
       - analysis.complexityScore (0-100, tutorial=10, production=90)
       - analysis.summary (technical value proposition)

    2. IDENTIFY JUNK (BE STRICT):
       - Low complexityScore (<20): Likely "Hello World" or tutorial
       - projectType contains "Tutorial" or "Exercise": EXCLUDE
       - Forks with no stars and no analysis: EXCLUDE
       - Empty repos or config-only repos: EXCLUDE

    3. INTELLIGENT CLUSTERING:
       - Group repos that are LOGICALLY PART OF THE SAME SYSTEM:
         * Same domain problem (e.g., all healthcare, all e-commerce)
         * Complementary architecture patterns (e.g., frontend + backend API + infrastructure)
         * Shared techStack AND shared skillsDemonstrated
       - DO NOT group just because they use the same language (e.g., all Python)
       - Example GOOD grouping: "E-Commerce Platform" = [React storefront, Node.js API, PostgreSQL schema]
       - Example BAD grouping: "Python Projects" = [ML script, Django blog, data scraper] (too vague)

    4. PROJECT NAMING:
       - Use SPECIFIC domain names: "Healthcare Alert System", "Fintech Trading Platform"
       - NOT generic: "Full-Stack App", "Microservices Project"

    5. LEAVE STANDALONE:
       - High-quality repos (complexityScore >70) that don't fit a group should stay visible
       - Don't force grouping just to reduce standalone repos

    INPUT DATA (with AI Analysis):
    ${JSON.stringify(repoList, null, 2)}

    RESPOND WITH JSON ONLY in this structure:
    {
      "excludedRepoIds": ["id_of_junk_1", "id_of_junk_2"],
      "projects": [
        {
          "name": "Specific Domain-Focused Project Name",
          "description": "Brief professional summary leveraging analysis data",
          "repositoryIds": ["id_1", "id_2"]
        }
      ],
      "reasoning": "Explain how you used AI analysis data for grouping decisions"
    }
    `;

    const validatedPlan = (() => {
      if (mode === 'apply' && body?.plan) {
        return AutoCurateSchema.parse(body.plan);
      }
      return null;
    })();

    // 3. Call LLM (preview always generates; apply can either generate or use provided plan)
    const finalPlan = validatedPlan
      ? validatedPlan
      : AutoCurateSchema.parse(
          await analyzeJSON(
            prompt,
            'You are a meticulous Portfolio Curator who hates clutter and loves clear, cohesive engineering narratives.'
          )
        );

    const ownership = validateOwnership(finalPlan);
    if (!ownership.ok) {
      return NextResponse.json(
        { error: 'Plan contains unknown repositories', unknownRepoIds: ownership.unknownRepoIds },
        { status: 400 }
      );
    }

    if (mode === 'preview') {
      const projectRepoCount = finalPlan.projects.reduce((sum, p) => sum + p.repositoryIds.length, 0);
      return NextResponse.json({
        success: true,
        mode,
        plan: finalPlan,
        preview: {
          excludedCount: finalPlan.excludedRepoIds.length,
          projectsCount: finalPlan.projects.length,
          projectRepoCount,
        },
      });
    }

    // 4. Execute Plan (apply)
    const results = {
      excluded: 0,
      projectsCreated: 0,
      reposAssigned: 0,
    };

    // A. Exclude Junk
    if (finalPlan.excludedRepoIds.length > 0) {
      const updateResult = await prisma.repository.updateMany({
        where: {
          id: { in: finalPlan.excludedRepoIds },
          githubConnection: { userId: session.user.id } // Safety check
        },
        data: { isExcluded: true },
      });
      results.excluded = updateResult.count;
    }

    // B. Create Projects & Link Repos
    for (const projectPlan of finalPlan.projects) {
      if (projectPlan.repositoryIds.length === 0) continue;

      // Create Project
      const project = await prisma.project.create({
        data: {
          userId: session.user.id,
          name: projectPlan.name,
          description: projectPlan.description,
          repositories: {
            connect: projectPlan.repositoryIds.map(id => ({ id })),
          },
        },
      });
      results.projectsCreated++;
      results.reposAssigned += projectPlan.repositoryIds.length;
    }

    // Transition workflow state to GROUPING_SUGGESTED after successful AI curation
    await transitionWorkflowState(
      session.user.id,
      'GROUPING_SUGGESTED',
      'AI generated grouping suggestions and applied them'
    );

    return NextResponse.json({
      success: true,
      mode,
      plan: finalPlan,
      results
    });

  } catch (error: any) {
    console.error('Auto-curate error:', error);
    return NextResponse.json(
      { error: 'Failed to auto-curate portfolio', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

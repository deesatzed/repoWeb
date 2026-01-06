
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

    // 1. Fetch all repositories for the user
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
      },
    });

    if (repositories.length === 0) {
      return NextResponse.json({ message: 'No repositories to curate' });
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

    // 2. Prepare context for LLM
    const repoList = repositories.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description || '',
      language: r.language || 'Unknown',
      topics: r.topics, // This is a JSON string in DB, but prisma might return string. We should check. 
      // Actually schema says String @default("[]"). 
      // We'll pass it as is or parse it if needed. 
      // For LLM context, raw string is fine or parsed.
      stars: r.stargazersCount,
      isFork: r.isFork,
      lastUpdate: r.updatedAt.toISOString().split('T')[0],
    }));

    const prompt = `You are an expert Technical Recruiter and Engineering Manager organizing a candidate's portfolio.
    
    You have a list of ${repoList.length} GitHub repositories. Your goal is to ORGANIZE them into a clean, employer-ready portfolio.
    
    CRITICAL: BE HIGHLY SELECTIVE. If a repository seems like a tutorial, medical boilerplate, "Hello World", or irrelevant exercise, EXCLUDE it.
    The user complained that the previous grouping was too broad (e.g., non-medical repos grouped under medical). 
    
    TASKS:
    1. IDENTIFY JUNK: Find repositories that should be HIDDEN (excluded).
       - Criteria: "Hello World" exercises, tutorial clones (e.g. "react-todo-tutorial"), empty repos, old/abandoned forks with no stars, or random config files.
       - BE STRICT. If you are unsure, exclude it.
    
    2. CLUSTER PROJECTS: Group related repositories into "Projects".
       - DO NOT group unrelated repositories just because they use the same language.
       - Group ONLY if they are logically part of the same system (e.g. frontend + backend of the same app).
       - Project names should be specific and professional.
    
    3. LEAVE STANDALONE: High-quality repos that don't fit a group should stay visible but NOT in a project.
    
    INPUT DATA:
    ${JSON.stringify(repoList, null, 2)}
    
    RESPOND WITH JSON ONLY in this structure:
    {
      "excludedRepoIds": ["id_of_junk_1", "id_of_junk_2"],
      "projects": [
        {
          "name": "Specific Project Name",
          "description": "Brief professional summary of this group",
          "repositoryIds": ["id_1", "id_2"]
        }
      ],
      "reasoning": "Brief explanation of your choices"
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

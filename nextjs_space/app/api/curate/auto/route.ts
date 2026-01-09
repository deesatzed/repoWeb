
import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';
import { analyzeJSON } from '@/lib/llm';
import { z } from 'zod';

const SINGLE_USER_ID = 'single-user';

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
    const repositories = await db.getRepositories(SINGLE_USER_ID);

    if (repositories.length === 0) {
      return NextResponse.json({ message: 'No repositories to curate' });
    }

    // Note: Grouping can proceed even without AI analysis - we'll use basic repo metadata

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

    // 2. Prepare context for LLM with RICH AI ANALYSIS DATA
    const repoList = repositories.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description || '',
      language: r.language || 'Unknown',
      topics: r.topics,
      stars: r.stargazersCount,
      isFork: r.isFork,
      lastUpdate: r.updatedAt,
      // AI ANALYSIS DATA (if available)
      analysis: r.aiAnalysis ? {
        complexityScore: r.aiAnalysis.complexityScore,
        codeQualityScore: r.aiAnalysis.codeQualityScore,
        projectType: r.aiAnalysis.projectType,
        techStack: r.aiAnalysis.techStack,
        keyFeatures: r.aiAnalysis.keyFeatures,
        strengths: r.aiAnalysis.strengths,
        architecturePatterns: r.aiAnalysis.architecturePatterns,
        summary: r.aiAnalysis.summary,
        skillsDemonstrated: r.aiAnalysis.skillsDemonstrated,
        hasTests: r.aiAnalysis.hasTests,
        hasDocumentation: r.aiAnalysis.hasDocumentation,
        hasCiCd: r.aiAnalysis.hasCiCd,
        contributionPattern: r.aiAnalysis.contributionPattern,
      } : null,
    }));

    const prompt = `You are an expert Portfolio Organizer helping a developer showcase their best work to employers.

    You have ${repoList.length} GitHub repositories to organize into a professional portfolio.

    YOUR GOAL: Create a POSITIVE, employer-ready portfolio that highlights skills and achievements.

    GROUPING STRATEGY:
    1. GROUP BY DOMAIN/PURPOSE (not by language):
       - Healthcare/Medical projects together
       - Machine Learning/AI projects together  
       - Web Applications together
       - DevOps/Infrastructure together
       - Data Engineering together
       - etc.

    2. PROJECT NAMING - Use professional, specific names:
       - GOOD: "Healthcare Analytics Platform", "ML Research & Experimentation", "Full-Stack Web Applications"
       - BAD: "Python Projects", "Misc Code", "Old Stuff"

    3. PROJECT DESCRIPTIONS - Write POSITIVE, employer-focused descriptions:
       - Highlight skills demonstrated
       - Mention technologies used
       - Focus on what the developer CAN DO
       - NEVER mention negatives, problems, or criticisms
       - Example: "A collection of machine learning projects demonstrating expertise in PyTorch, data preprocessing, and model evaluation."

    4. EXCLUSION CRITERIA (be conservative - when in doubt, INCLUDE):
       - Only exclude if clearly empty or broken
       - Only exclude obvious forks with zero modifications
       - Keep learning projects - they show growth mindset
       - Keep experimental projects - they show curiosity

    5. STANDALONE REPOS:
       - Repos that don't fit a group should remain visible (not excluded)
       - It's OK to have ungrouped repos

    INPUT DATA:
    ${JSON.stringify(repoList, null, 2)}

    RESPOND WITH JSON ONLY:
    {
      "excludedRepoIds": ["only_truly_empty_or_broken_repos"],
      "projects": [
        {
          "name": "Professional Domain-Focused Name",
          "description": "Positive description highlighting skills and technologies demonstrated",
          "repositoryIds": ["id_1", "id_2"]
        }
      ],
      "reasoning": "Brief explanation of grouping logic"
    }
    `

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
      for (const id of finalPlan.excludedRepoIds) {
        await db.updateRepository(id, { isExcluded: true });
        results.excluded++;
      }
    }

    // B. Create Projects & Link Repos
    for (const projectPlan of finalPlan.projects) {
      if (projectPlan.repositoryIds.length === 0) continue;

      // Create Project
      const project = await db.createProject({
        userId: SINGLE_USER_ID,
        name: projectPlan.name,
        description: projectPlan.description,
        isVisible: true,
      });
      results.projectsCreated++;
      results.reposAssigned += projectPlan.repositoryIds.length;

      // Link repos
      for (const id of projectPlan.repositoryIds) {
        await db.updateRepository(id, { projectId: project.id });
      }
    }

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

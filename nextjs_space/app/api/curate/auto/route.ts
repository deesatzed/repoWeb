
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/db';
import { analyzeJSON } from '@/lib/llm';
import { z } from 'zod';

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
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    
    TASKS:
    1. IDENTIFY JUNK: Find repositories that should be HIDDEN (excluded).
       - Criteria: "Hello World" exercises, tutorial clones (e.g. "react-todo-tutorial"), empty repos, old/abandoned forks with no stars, or random config files.
       - Keep: Real projects, libraries, useful tools, even if old (if they show skill).
    
    2. CLUSTER PROJECTS: Group related repositories into "Projects".
       - Example: "frontend-repo" + "backend-repo" -> Project "Full Stack E-commerce App".
       - Example: "v1-app" + "v2-app" -> Project "App Evolution".
       - Example: "algo-lib" + "utils" -> Project "Core Libraries".
    
    3. LEAVE STANDALONE: High-quality repos that don't fit a group should stay visible but NOT in a project (do not include them in 'projects' array, and do not exclude them).
    
    INPUT DATA:
    ${JSON.stringify(repoList, null, 2)}
    
    RESPOND WITH JSON ONLY in this structure:
    {
      "excludedRepoIds": ["id_of_junk_1", "id_of_junk_2"],
      "projects": [
        {
          "name": "Exciting Project Name",
          "description": "A brief 1-sentence description of what this group represents",
          "repositoryIds": ["id_1", "id_2"]
        }
      ],
      "reasoning": "Brief explanation of your choices"
    }
    `;

    // 3. Call LLM
    const curationPlan = await analyzeJSON(
      prompt, 
      "You are a meticulous Portfolio Curator who hates clutter and loves clear, cohesive engineering narratives."
    );

    const validatedPlan = AutoCurateSchema.parse(curationPlan);

    // 4. Execute Plan
    const results = {
      excluded: 0,
      projectsCreated: 0,
    };

    // A. Exclude Junk
    if (validatedPlan.excludedRepoIds.length > 0) {
      const updateResult = await prisma.repository.updateMany({
        where: {
          id: { in: validatedPlan.excludedRepoIds },
          githubConnection: { userId: session.user.id } // Safety check
        },
        data: { isExcluded: true },
      });
      results.excluded = updateResult.count;
    }

    // B. Create Projects & Link Repos
    for (const projectPlan of validatedPlan.projects) {
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
    }

    return NextResponse.json({ 
      success: true, 
      plan: validatedPlan,
      results 
    });

  } catch (error: any) {
    console.error('Auto-curate error:', error);
    return NextResponse.json(
      { error: 'Failed to auto-curate portfolio' },
      { status: 500 }
    );
  }
}

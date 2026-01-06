export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const repositories = await prisma.repository.findMany({
      where: {
        githubConnection: {
          userId: session.user.id,
        },
      },
      include: {
        aiAnalysis: true,
      },
      orderBy: [
        { isFeatured: 'desc' },
        { sortOrder: 'asc' },
        { stargazersCount: 'desc' },
      ],
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

    // Convert BigInt to string for JSON serialization and parse topics and analysis
    const serializedRepos = repositories?.map((repo: any) => ({
      ...repo,
      githubId: repo?.githubId?.toString() ?? '0',
      topics: parseJsonArray(repo.topics),
      aiAnalysis: repo.aiAnalysis ? {
        ...repo.aiAnalysis,
        techStack: parseJsonArray(repo.aiAnalysis.techStack),
        keyFeatures: parseJsonArray(repo.aiAnalysis.keyFeatures),
        strengths: parseJsonArray(repo.aiAnalysis.strengths),
        architecturePatterns: parseJsonArray(repo.aiAnalysis.architecturePatterns),
        skillsDemonstrated: parseJsonArray(repo.aiAnalysis.skillsDemonstrated),
      } : null,
    })) ?? [];

    return NextResponse.json({ repositories: serializedRepos });
  } catch (error: any) {
    console.error('Fetch repositories error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repositories' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { repositoryId, updates } = body ?? {};

    if (!repositoryId) {
      return NextResponse.json(
        { error: 'Repository ID is required' },
        { status: 400 }
      );
    }

    // Verify ownership
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

    // Prepare updates
    const preparedUpdates = { ...updates };
    if (preparedUpdates.topics && Array.isArray(preparedUpdates.topics)) {
      preparedUpdates.topics = JSON.stringify(preparedUpdates.topics);
    }

    // Update repository
    const updated = await prisma.repository.update({
      where: { id: repositoryId },
      data: preparedUpdates ?? {},
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

    return NextResponse.json({
      success: true,
      repository: {
        ...updated,
        githubId: updated?.githubId?.toString() ?? '0',
        topics: parseJsonArray(updated.topics),
      },
    });
  } catch (error: any) {
    console.error('Update repository error:', error);
    return NextResponse.json(
      { error: 'Failed to update repository' },
      { status: 500 }
    );
  }
}

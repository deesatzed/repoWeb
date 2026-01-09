export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';
import { auth } from '@/lib/auth';

const SINGLE_USER_ID = 'single-user';

export async function GET(request: Request) {
  try {
    const repositories = await db.getRepositories(SINGLE_USER_ID);

    // Sort repositories: featured first, then by stars desc
    const sortedRepos = repositories.sort((a, b) => {
      const aScore = (a.isFeatured ? 1 : 0) * 1000 + (a.stargazersCount ?? 0);
      const bScore = (b.isFeatured ? 1 : 0) * 1000 + (b.stargazersCount ?? 0);
      return bScore - aScore;
    });

    return NextResponse.json({ repositories: sortedRepos });
  } catch (error: any) {
    console.error('Error fetching repositories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repositories' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session) {
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
    const repositories = await db.getRepositories(SINGLE_USER_ID);
    const repository = repositories.find(r => r.id === repositoryId);

    if (!repository) {
      return NextResponse.json(
        { error: 'Repository not found' },
        { status: 404 }
      );
    }

    // Update repository
    const updated = await db.updateRepository(repositoryId, updates ?? {});

    return NextResponse.json({
      success: true,
      repository: updated,
    });
  } catch (error: any) {
    console.error('Update repository error:', error);
    return NextResponse.json(
      { error: 'Failed to update repository' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { repositoryIds } = body ?? {};

    if (!repositoryIds || !Array.isArray(repositoryIds) || repositoryIds.length === 0) {
      return NextResponse.json(
        { error: 'Repository IDs are required' },
        { status: 400 }
      );
    }

    // Verify ownership for all repos
    const repositories = await db.getRepositories(SINGLE_USER_ID);
    const validRepoIds = repositoryIds.filter(id => repositories.some(r => r.id === id));

    if (validRepoIds.length === 0) {
      return NextResponse.json(
        { error: 'No valid repositories found' },
        { status: 404 }
      );
    }

    // Delete repositories
    const deletedCount = await db.deleteRepositories(validRepoIds);

    return NextResponse.json({
      success: true,
      deletedCount,
      message: `Deleted ${deletedCount} repository${deletedCount !== 1 ? 'ies' : ''}`,
    });
  } catch (error: any) {
    console.error('Delete repository error:', error);
    return NextResponse.json(
      { error: 'Failed to delete repositories' },
      { status: 500 }
    );
  }
}

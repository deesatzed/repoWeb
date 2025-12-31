export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/db';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

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

    // Convert BigInt to string for JSON serialization
    const serializedRepos = repositories?.map((repo: any) => ({
      ...repo,
      githubId: repo?.githubId?.toString() ?? '0',
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
    const session = await getServerSession(authOptions);

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

    // Update repository
    const updated = await prisma.repository.update({
      where: { id: repositoryId },
      data: updates ?? {},
    });

    return NextResponse.json({
      success: true,
      repository: {
        ...updated,
        githubId: updated?.githubId?.toString() ?? '0',
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

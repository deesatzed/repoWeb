import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { repositoryId, isExcluded } = await req.json();

    if (!repositoryId) {
      return NextResponse.json({ error: 'Repository ID is required' }, { status: 400 });
    }

    // Verify ownership via relation to user
    const existingRepo = await prisma.repository.findFirst({
      where: {
        id: repositoryId,
        githubConnection: {
          userId: session.user.id,
        },
      },
    });

    if (!existingRepo) {
      console.log('Repo not found or mismatch:', { repositoryId, userId: session.user.id });
      return NextResponse.json({ error: 'Repository not found or unauthorized' }, { status: 404 });
    }

    console.log('Updating repo:', { repositoryId, isExcluded });

    // Update repository
    const repository = await prisma.repository.update({
      where: { id: repositoryId },
      data: { isExcluded: isExcluded ?? false },
    });

    return NextResponse.json({
      repository: {
        ...repository,
        githubId: repository.githubId.toString(),
      }
    });
  } catch (error) {
    console.error('Error toggling repository exclusion:', error);
    return NextResponse.json(
      { error: 'Failed to update repository' },
      { status: 500 }
    );
  }
}

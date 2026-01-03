import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { repositoryId, isExcluded } = await req.json();

    if (!repositoryId) {
      return NextResponse.json({ error: 'Repository ID is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { githubConnection: true },
    });

    if (!user?.githubConnection) {
      return NextResponse.json({ error: 'GitHub not connected' }, { status: 400 });
    }

    // Verify ownership first
    const existingRepo = await prisma.repository.findFirst({
      where: {
        id: repositoryId,
        githubConnectionId: user.githubConnection.id,
      },
    });

    if (!existingRepo) {
      return NextResponse.json({ error: 'Repository not found or unauthorized' }, { status: 404 });
    }

    // Update repository
    const repository = await prisma.repository.update({
      where: { id: repositoryId },
      data: { isExcluded: isExcluded ?? false },
    });

    return NextResponse.json({ repository });
  } catch (error) {
    console.error('Error toggling repository exclusion:', error);
    return NextResponse.json(
      { error: 'Failed to update repository' },
      { status: 500 }
    );
  }
}

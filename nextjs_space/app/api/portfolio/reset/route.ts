import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const confirm = String(body?.confirm ?? '');

    if (confirm !== 'NUKE') {
      return NextResponse.json(
        { error: 'Confirmation required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { githubConnection: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const connectionId = user.githubConnection?.id ?? null;

    const repoIds = connectionId
      ? (
          await prisma.repository.findMany({
            where: { githubConnectionId: connectionId },
            select: { id: true },
          })
        ).map((r) => r.id)
      : [];

    const projectIds = (
      await prisma.project.findMany({
        where: { userId: user.id },
        select: { id: true },
      })
    ).map((p) => p.id);

    const result = await prisma.$transaction(async (tx) => {
      const analysesDeleted = repoIds.length
        ? await tx.aIAnalysis.deleteMany({
            where: { repositoryId: { in: repoIds } },
          })
        : { count: 0 };

      const repositoriesDeleted = repoIds.length
        ? await tx.repository.deleteMany({
            where: { id: { in: repoIds } },
          })
        : { count: 0 };

      const projectAnalysesDeleted = projectIds.length
        ? await tx.projectAnalysis.deleteMany({
            where: { projectId: { in: projectIds } },
          })
        : { count: 0 };

      const projectsDeleted = await tx.project.deleteMany({
        where: { userId: user.id },
      });

      const settingsDeleted = await tx.portfolioSettings.deleteMany({
        where: { userId: user.id },
      });

      const connectionDeleted = connectionId
        ? await tx.gitHubConnection.deleteMany({
            where: { id: connectionId },
          })
        : { count: 0 };

      return {
        analysesDeleted: analysesDeleted.count,
        repositoriesDeleted: repositoriesDeleted.count,
        projectAnalysesDeleted: projectAnalysesDeleted.count,
        projectsDeleted: projectsDeleted.count,
        settingsDeleted: settingsDeleted.count,
        connectionDeleted: connectionDeleted.count,
      };
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error('Error resetting portfolio:', error);
    return NextResponse.json(
      { error: 'Failed to reset portfolio' },
      { status: 500 }
    );
  }
}

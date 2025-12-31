import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, description, repositoryIds, isVisible } = await req.json();
    const projectId = params.projectId;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { githubConnection: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify project ownership
    const existingProject = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: user.id,
      },
    });

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Update project
    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isVisible !== undefined && { isVisible }),
      },
    });

    // Update repository associations if provided
    if (repositoryIds !== undefined) {
      // Remove all existing associations
      await prisma.repository.updateMany({
        where: { projectId: projectId },
        data: { projectId: null },
      });

      // Add new associations
      if (repositoryIds.length > 0) {
        await prisma.repository.updateMany({
          where: {
            id: { in: repositoryIds },
            githubConnectionId: user.githubConnection?.id,
          },
          data: { projectId: projectId },
        });
      }
    }

    // Fetch updated project with repositories
    const updatedProject = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        repositories: true,
        aiAnalysis: true,
      },
    });

    return NextResponse.json({ project: updatedProject });
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.projectId;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify project ownership
    const existingProject = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: user.id,
      },
    });

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Delete project (repositories will be unlinked due to SetNull)
    await prisma.project.delete({
      where: { id: projectId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { repositoryId } = await req.json();
    const projectId = params.projectId;

    if (!repositoryId) {
      return NextResponse.json({ error: 'Repository ID is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { githubConnection: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: user.id,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify repository ownership
    const repository = await prisma.repository.findFirst({
      where: {
        id: repositoryId,
        githubConnectionId: user.githubConnection?.id,
      },
    });

    if (!repository) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }

    // Add repository to project
    const updatedRepository = await prisma.repository.update({
      where: { id: repositoryId },
      data: { projectId: projectId },
    });

    return NextResponse.json({ repository: updatedRepository });
  } catch (error) {
    console.error('Error adding repository to project:', error);
    return NextResponse.json(
      { error: 'Failed to add repository to project' },
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

    const { searchParams } = new URL(req.url);
    const repositoryId = searchParams.get('repositoryId');
    const projectId = params.projectId;

    if (!repositoryId) {
      return NextResponse.json({ error: 'Repository ID is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: user.id,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Remove repository from project
    const updatedRepository = await prisma.repository.update({
      where: { id: repositoryId },
      data: { projectId: null },
    });

    return NextResponse.json({ repository: updatedRepository });
  } catch (error) {
    console.error('Error removing repository from project:', error);
    return NextResponse.json(
      { error: 'Failed to remove repository from project' },
      { status: 500 }
    );
  }
}

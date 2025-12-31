import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      include: {
        repositories: {
          orderBy: { sortOrder: 'asc' },
        },
        aiAnalysis: true,
      },
      orderBy: { displayOrder: 'asc' },
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, description, repositoryIds } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { githubConnection: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the highest display order
    const maxOrder = await prisma.project.findFirst({
      where: { userId: user.id },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true },
    });

    const project = await prisma.project.create({
      data: {
        userId: user.id,
        name,
        description,
        displayOrder: (maxOrder?.displayOrder ?? 0) + 1,
      },
      include: {
        repositories: true,
      },
    });

    // Link repositories to project if provided
    if (repositoryIds && repositoryIds.length > 0) {
      await prisma.repository.updateMany({
        where: {
          id: { in: repositoryIds },
          githubConnectionId: user.githubConnection?.id,
        },
        data: { projectId: project.id },
      });
    }

    // Fetch updated project with repositories
    const updatedProject = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        repositories: true,
      },
    });

    return NextResponse.json({ project: updatedProject });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
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

    const parseJsonArray = (val: string | string[] | null | undefined) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      try {
        return JSON.parse(val || '[]');
      } catch {
        return [];
      }
    };

    const serializedProjects = projects.map((project: any) => ({
      ...project,
      repositories: project.repositories.map((repo: any) => ({
        ...repo,
        githubId: repo.githubId.toString(),
        topics: parseJsonArray(repo.topics),
      })),
      aiAnalysis: project.aiAnalysis ? {
        ...project.aiAnalysis,
        technicalSkills: parseJsonArray(project.aiAnalysis.technicalSkills),
        techStack: parseJsonArray(project.aiAnalysis.techStack),
      } : null,
    }));

    return NextResponse.json({ projects: serializedProjects });
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
    const session = await auth();
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
        aiAnalysis: true,
      },
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

    const serializedProject = updatedProject ? {
      ...updatedProject,
      repositories: updatedProject.repositories.map((repo: any) => ({
        ...repo,
        githubId: repo.githubId.toString(),
        topics: parseJsonArray(repo.topics),
      })),
      aiAnalysis: updatedProject.aiAnalysis ? {
        ...updatedProject.aiAnalysis,
        technicalSkills: parseJsonArray(updatedProject.aiAnalysis.technicalSkills),
        techStack: parseJsonArray(updatedProject.aiAnalysis.techStack),
      } : null,
    } : null;

    return NextResponse.json({ project: serializedProject });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}

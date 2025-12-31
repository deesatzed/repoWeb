export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { toPublicRepository } from '@/lib/public-dto';

export async function GET(
  request: Request,
  { params }: { params: { username: string } }
) {
  try {
    const username = params?.username;

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    // Find user by GitHub username
    const connection = await prisma.gitHubConnection.findFirst({
      where: { githubUsername: username },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        repositories: {
          where: { isExcluded: false },
          include: {
            aiAnalysis: true,
          },
          orderBy: [
            { isFeatured: 'desc' },
            { sortOrder: 'asc' },
            { stargazersCount: 'desc' },
          ],
        },
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Portfolio not found' },
        { status: 404 }
      );
    }

    // Get portfolio settings
    const settings = await prisma.portfolioSettings.findUnique({
      where: { userId: connection.userId },
    });

    // Get projects with their analyses
    const projects = await prisma.project.findMany({
      where: {
        userId: connection.userId,
        isVisible: true,
      },
      include: {
        repositories: {
          where: { isExcluded: false },
          include: {
            aiAnalysis: true,
          },
        },
        aiAnalysis: true,
      },
      orderBy: { displayOrder: 'asc' },
    });

    const repositories = connection?.repositories?.map((repo: any) =>
      toPublicRepository(repo, settings)
    ) ?? [];

    // Separate ungrouped repositories (not part of any project)
    const ungroupedRepos = repositories.filter(
      (repo: any) => !repo.projectId
    );

    return NextResponse.json({
      user: connection.user,
      githubUsername: connection.githubUsername,
      projects: projects.map((p: any) => ({
        ...p,
        repositories: p.repositories.map((r: any) =>
          toPublicRepository(r, settings)
        ),
      })),
      repositories: ungroupedRepos,
      ungroupedRepositories: ungroupedRepos,
      settings,
    });
  } catch (error: any) {
    console.error('Fetch portfolio error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch portfolio' },
      { status: 500 }
    );
  }
}

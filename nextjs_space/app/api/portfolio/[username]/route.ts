export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { toPublicRepository } from '@/lib/public-dto';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

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
    const rawSettings = await prisma.portfolioSettings.findUnique({
      where: { userId: connection.userId },
    });

    const settings = rawSettings ? {
      ...rawSettings,
      featuredSection: rawSettings.featuredSection ? JSON.parse(rawSettings.featuredSection) : null,
    } : null;

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

    const parseJsonArray = (val: string | string[] | null | undefined) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      try {
        return JSON.parse(val || '[]');
      } catch {
        return [];
      }
    };

    return NextResponse.json({
      user: connection.user,
      githubUsername: connection.githubUsername,
      projects: projects.map((p: any) => ({
        ...p,
        repositories: p.repositories.map((r: any) =>
          toPublicRepository(r, settings)
        ),
        aiAnalysis: p.aiAnalysis ? {
          ...p.aiAnalysis,
          technicalSkills: parseJsonArray(p.aiAnalysis.technicalSkills),
          techStack: parseJsonArray(p.aiAnalysis.techStack),
        } : null,
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

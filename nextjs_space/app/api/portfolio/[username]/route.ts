export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs/promises';
import { db } from '@/lib/storage';

const SINGLE_USER_ID = 'single-user';

const PORTFOLIO_ROOT = process.env.PORTFOLIO_DATA_DIR
  ? path.resolve(process.env.PORTFOLIO_DATA_DIR)
  : path.join(process.cwd(), 'data', 'portfolio');

async function loadPortfolioJson(username: string) {
  try {
    const filePath = path.join(PORTFOLIO_ROOT, username, 'portfolio.json');
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

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

    // Try loading from static JSON file first
    const jsonPortfolio = await loadPortfolioJson(username);
    if (jsonPortfolio) {
      const repositories = jsonPortfolio.repositories ?? [];
      const projects = jsonPortfolio.projects ?? [];
      return NextResponse.json({
        ...jsonPortfolio,
        repositories,
        projects,
        ungroupedRepositories: jsonPortfolio.ungroupedRepositories ?? repositories,
      });
    }

    // Find user by GitHub username from JSON storage
    const connection = await db.getGitHubConnection(SINGLE_USER_ID);

    if (!connection || connection.githubUsername !== username) {
      return NextResponse.json(
        { error: 'Portfolio not found' },
        { status: 404 }
      );
    }

    // Get repositories
    const allRepositories = await db.getRepositories(SINGLE_USER_ID);
    const repositories = allRepositories
      .filter(r => !r.isExcluded)
      .sort((a, b) => {
        if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
        return (b.stargazersCount || 0) - (a.stargazersCount || 0);
      });

    // Get portfolio settings
    const settings = await db.getSettings(SINGLE_USER_ID);

    // Get projects
    const allProjects = await db.getProjects(SINGLE_USER_ID);
    const projects = allProjects.filter(p => p.isVisible);

    // Map repositories to public format
    const publicRepos = repositories.map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.fullName,
      description: repo.description,
      language: repo.language,
      stargazersCount: repo.stargazersCount,
      forksCount: repo.forksCount,
      topics: repo.topics,
      htmlUrl: repo.htmlUrl,
      isPrivate: repo.isPrivate,
      isFork: repo.isFork,
      isFeatured: repo.isFeatured,
      projectId: repo.projectId,
      aiAnalysis: repo.aiAnalysis,
    }));

    // Separate ungrouped repositories (not part of any project)
    const ungroupedRepos = publicRepos.filter(repo => !repo.projectId);

    // Map projects with their repositories
    const projectsWithRepos = projects.map(project => ({
      ...project,
      repositories: publicRepos.filter(r => r.projectId === project.id),
    }));

    return NextResponse.json({
      user: { id: SINGLE_USER_ID, name: settings?.displayName || connection.githubUsername },
      githubUsername: connection.githubUsername,
      projects: projectsWithRepos,
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

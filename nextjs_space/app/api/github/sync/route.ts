export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/db';
import { GitHubService } from '@/lib/github-api';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connection = await prisma.gitHubConnection.findUnique({
      where: { userId: session.user.id },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'GitHub not connected' },
        { status: 400 }
      );
    }

    const githubService = new GitHubService(connection.githubToken);
    const repos = await githubService.getUserRepositories(connection.githubUsername);

    // Sync repositories
    for (const repo of repos ?? []) {
      const [owner, repoName] = repo?.full_name?.split('/') ?? [];
      
      // Fetch additional data
      const languages = await githubService.getRepositoryLanguages(owner ?? '', repoName ?? '');
      const readme = await githubService.getRepositoryReadme(owner ?? '', repoName ?? '');

      await prisma.repository.upsert({
        where: { githubId: BigInt(repo?.id ?? 0) },
        update: {
          name: repo?.name ?? '',
          fullName: repo?.full_name ?? '',
          description: repo?.description,
          htmlUrl: repo?.html_url ?? '',
          homepage: repo?.homepage,
          isPrivate: repo?.private ?? false,
          isFork: repo?.fork ?? false,
          language: repo?.language,
          stargazersCount: repo?.stargazers_count ?? 0,
          forksCount: repo?.forks_count ?? 0,
          openIssuesCount: repo?.open_issues_count ?? 0,
          watchersCount: repo?.watchers_count ?? 0,
          size: repo?.size ?? 0,
          defaultBranch: repo?.default_branch ?? 'main',
          topics: repo?.topics ?? [],
          updatedAt: new Date(repo?.updated_at ?? new Date()),
          pushedAt: repo?.pushed_at ? new Date(repo.pushed_at) : null,
          readmeContent: readme,
          languages: languages,
        },
        create: {
          githubConnectionId: connection.id,
          githubId: BigInt(repo?.id ?? 0),
          name: repo?.name ?? '',
          fullName: repo?.full_name ?? '',
          description: repo?.description,
          htmlUrl: repo?.html_url ?? '',
          homepage: repo?.homepage,
          isPrivate: repo?.private ?? false,
          isFork: repo?.fork ?? false,
          language: repo?.language,
          stargazersCount: repo?.stargazers_count ?? 0,
          forksCount: repo?.forks_count ?? 0,
          openIssuesCount: repo?.open_issues_count ?? 0,
          watchersCount: repo?.watchers_count ?? 0,
          size: repo?.size ?? 0,
          defaultBranch: repo?.default_branch ?? 'main',
          topics: repo?.topics ?? [],
          createdAt: new Date(repo?.created_at ?? new Date()),
          updatedAt: new Date(repo?.updated_at ?? new Date()),
          pushedAt: repo?.pushed_at ? new Date(repo.pushed_at) : null,
          readmeContent: readme,
          languages: languages,
        },
      });
    }

    // Update last synced time
    await prisma.gitHubConnection.update({
      where: { id: connection.id },
      data: { lastSyncedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      repoCount: repos?.length ?? 0,
    });
  } catch (error: any) {
    console.error('GitHub sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync repositories' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';
import { GitHubService } from '@/lib/github-api';
import { auth } from '@/lib/auth';

const SINGLE_USER_ID = 'single-user';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connection = await db.getGitHubConnection(SINGLE_USER_ID);

    if (!connection) {
      return NextResponse.json(
        { error: 'GitHub not connected' },
        { status: 400 }
      );
    }

    const githubService = new GitHubService(connection.githubToken);
    const repoLimitRaw = Number(process.env.DEV_REPO_LIMIT ?? 0);
    const repoLimit = Number.isFinite(repoLimitRaw) && repoLimitRaw > 0 ? repoLimitRaw : undefined;
    if (repoLimit) {
      console.log(`DEV_REPO_LIMIT enabled: syncing up to ${repoLimit} repositories.`);
    }
    const repos = await githubService.getUserRepositories(connection.githubUsername, repoLimit);

    // Sync repositories
    console.log(`Syncing ${repos.length} repositories for ${connection.githubUsername}...`);
    let createdCount = 0;
    let updatedCount = 0;

    for (const repo of repos ?? []) {
      const [owner, repoName] = repo?.full_name?.split('/') ?? [];
      
      // Fetch languages and readme
      let languages = null;
      let readme = null;

      console.log(`Fetching data for ${repo.name}...`);
      [languages, readme] = await Promise.all([
        githubService.getRepositoryLanguages(owner ?? '', repoName ?? ''),
        githubService.getRepositoryReadme(owner ?? '', repoName ?? '')
      ]);

      const repoId = `repo_${repo?.id ?? Date.now()}`;
      
      await db.upsertRepository({
        id: repoId,
        userId: SINGLE_USER_ID,
        name: repo?.name ?? '',
        fullName: repo?.full_name ?? '',
        description: repo?.description ?? undefined,
        htmlUrl: repo?.html_url ?? '',
        isPrivate: repo?.private ?? false,
        isFork: repo?.fork ?? false,
        isFeatured: false,
        language: repo?.language ?? undefined,
        stargazersCount: repo?.stargazers_count ?? 0,
        forksCount: repo?.forks_count ?? 0,
        openIssuesCount: repo?.open_issues_count ?? 0,
        size: repo?.size ?? 0,
        defaultBranch: repo?.default_branch ?? 'main',
        topics: repo?.topics ?? [],
        updatedAt: repo?.updated_at ?? new Date().toISOString(),
        pushedAt: repo?.pushed_at ?? undefined,
        readmeContent: readme ?? '',
        languages: languages ?? {},
        isExcluded: false,
      });
      createdCount++;
    }

    console.log(`Sync results: ${createdCount} synced.`);

    return NextResponse.json({
      success: true,
      repoCount: repos?.length ?? 0,
      createdCount,
      updatedCount,
    });
  } catch (error: any) {
    console.error('GitHub sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync repositories', details: error?.message },
      { status: 500 }
    );
  }
}

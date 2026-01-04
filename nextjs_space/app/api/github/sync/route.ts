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
    console.log(`Syncing ${repos.length} repositories for ${connection.githubUsername}...`);
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const repo of repos ?? []) {
      const [owner, repoName] = repo?.full_name?.split('/') ?? [];
      
      // Check if we already have this repo and it hasn't changed much
      const existing = await prisma.repository.findUnique({
        where: { githubId: BigInt(repo?.id ?? 0) },
        select: { updatedAt: true, id: true }
      });

      const repoUpdatedAt = new Date(repo?.updated_at ?? new Date());
      
      // If repo exists and hasn't been updated on GitHub, skip fetching heavy data (languages/readme)
      let languages = null;
      let readme = null;

      const shouldFetchHeavy = !existing || existing.updatedAt < repoUpdatedAt;
      if (shouldFetchHeavy) {
        console.log(`Fetching heavy data for ${repo.name}...`);
        [languages, readme] = await Promise.all([
          githubService.getRepositoryLanguages(owner ?? '', repoName ?? ''),
          githubService.getRepositoryReadme(owner ?? '', repoName ?? '')
        ]);
        
        if (!existing) createdCount++;
        else updatedCount++;
      } else {
        skippedCount++;
      }

      const baseData = {
        githubConnectionId: connection.id,
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
        topics: JSON.stringify(repo?.topics ?? []) as any,
        updatedAt: repoUpdatedAt,
        pushedAt: repo?.pushed_at ? new Date(repo.pushed_at) : null,
      };

      const heavyData = {
        ...(readme !== null && { readmeContent: readme }),
        ...(languages !== null && { languages: languages as any }),
      };

      await prisma.repository.upsert({
        where: { githubId: BigInt(repo?.id ?? 0) },
        update: {
          ...baseData,
          ...heavyData,
        },
        create: {
          ...baseData,
          githubId: BigInt(repo?.id ?? 0),
          createdAt: new Date(repo?.created_at ?? new Date()),
          readmeContent: readme ?? '',
          languages: (languages ?? {}) as any,
        },
      });
    }

    console.log(`Sync results: ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped.`);

    // Update last synced time
    await prisma.gitHubConnection.update({
      where: { id: connection.id },
      data: { lastSyncedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      repoCount: repos?.length ?? 0,
      createdCount,
      updatedCount,
      skippedCount
    });
  } catch (error: any) {
    console.error('GitHub sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync repositories' },
      { status: 500 }
    );
  }
}

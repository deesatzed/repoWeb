import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [repoCount, projectCount, analyzedCount, excludedCount, connection, totalStars, languagesRaw] = await Promise.all([
      prisma.repository.count({
        where: { githubConnection: { userId: session.user.id } }
      }),
      prisma.project.count({
        where: { userId: session.user.id }
      }),
      prisma.repository.count({
        where: { 
          githubConnection: { userId: session.user.id },
          aiAnalysis: { isNot: null }
        }
      }),
      prisma.repository.count({
        where: {
          githubConnection: { userId: session.user.id },
          isExcluded: true
        }
      }),
      prisma.gitHubConnection.findUnique({
        where: { userId: session.user.id },
        select: { lastSyncedAt: true }
      }),
      prisma.repository.aggregate({
        where: { githubConnection: { userId: session.user.id } },
        _sum: { stargazersCount: true }
      }),
      prisma.repository.findMany({
        where: { 
          githubConnection: { userId: session.user.id },
          isExcluded: false
        },
        select: { languages: true }
      })
    ]);

    // Aggregate languages
    const languageTotals: Record<string, number> = {};
    languagesRaw.forEach((repo: any) => {
      const langs = repo.languages as Record<string, number> || {};
      Object.entries(langs).forEach(([lang, bytes]) => {
        languageTotals[lang] = (languageTotals[lang] || 0) + bytes;
      });
    });

    const topLanguages = Object.entries(languageTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, bytes]) => ({ name, bytes }));

    return NextResponse.json({
      repoCount,
      projectCount,
      analyzedCount,
      excludedCount,
      totalStars: totalStars._sum.stargazersCount || 0,
      topLanguages,
      lastSyncedAt: connection?.lastSyncedAt,
      hasRepos: repoCount > 0,
      isCurated: excludedCount > 0, // Changed: curation starts with first exclusion/inclusion
      hasGroups: projectCount > 0,
      isAnalyzed: analyzedCount > 0 && analyzedCount >= (repoCount - excludedCount), // Accurate check
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}

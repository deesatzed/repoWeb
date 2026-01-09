import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const SINGLE_USER_ID = 'single-user';

export async function GET() {
  try {
    const [repositories, projects, connection] = await Promise.all([
      db.getRepositories(SINGLE_USER_ID),
      db.getProjects(SINGLE_USER_ID),
      db.getGitHubConnection(SINGLE_USER_ID),
    ]);

    const repoCount = repositories.length;
    const projectCount = projects.length;
    const analyzedCount = repositories.filter(r => r.aiAnalysis).length;
    const excludedCount = repositories.filter(r => r.isExcluded).length;
    const totalStars = repositories.reduce((sum, r) => sum + (r.stargazersCount || 0), 0);

    // Aggregate languages
    const languageTotals: Record<string, number> = {};
    repositories.filter(r => !r.isExcluded).forEach((repo) => {
      const langs = repo.languages || {};
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
      totalStars,
      topLanguages,
      lastSyncedAt: connection?.lastSyncedAt,
      hasRepos: repoCount > 0,
      isCurated: excludedCount > 0,
      hasGroups: projectCount > 0,
      isAnalyzed: analyzedCount > 0 && analyzedCount >= (repoCount - excludedCount),
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}

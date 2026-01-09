import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const SINGLE_USER_ID = 'single-user';

/**
 * GET /api/portfolio/backup
 * Creates a complete JSON backup of user's portfolio data.
 */
export async function GET(request: Request) {
  try {
    const [settings, githubConnection, repositories, projects] = await Promise.all([
      db.getSettings(SINGLE_USER_ID),
      db.getGitHubConnection(SINGLE_USER_ID),
      db.getRepositories(SINGLE_USER_ID),
      db.getProjects(SINGLE_USER_ID),
    ]);

    const backup = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      userId: SINGLE_USER_ID,
      settings,
      githubConnection: githubConnection ? {
        githubUsername: githubConnection.githubUsername,
        lastSyncedAt: githubConnection.lastSyncedAt,
      } : null,
      repositories,
      projects,
      metadata: {
        repositoryCount: repositories.length,
        projectCount: projects.length,
        analyzedCount: repositories.filter((r) => r.aiAnalysis).length,
      },
    };

    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="portfolio-backup-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error: any) {
    console.error('Backup error:', error);
    return NextResponse.json(
      { error: 'Failed to create backup', details: error?.message },
      { status: 500 }
    );
  }
}

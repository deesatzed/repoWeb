import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const SINGLE_USER_ID = 'single-user';

/**
 * GET /api/workflow/status
 * Returns current workflow state based on data in JSON storage.
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [repositories, githubConnection] = await Promise.all([
      db.getRepositories(SINGLE_USER_ID),
      db.getGitHubConnection(SINGLE_USER_ID),
    ]);

    const totalRepos = repositories.length;
    const includedRepos = repositories.filter(r => !r.isExcluded);
    const analyzedRepos = includedRepos.filter(r => r.aiAnalysis);
    const unanalyzedRepos = includedRepos.filter(r => !r.aiAnalysis);

    // Determine current state based on data
    let currentState = 'INITIAL';
    if (githubConnection) {
      currentState = 'CONNECTED';
      if (totalRepos > 0) {
        currentState = 'SYNCED';
        if (analyzedRepos.length > 0) {
          currentState = 'ANALYZED';
        }
      }
    }

    // Determine available actions based on current state
    const availableActions: string[] = [];
    const blockedActions: string[] = [];

    switch (currentState) {
      case 'INITIAL':
        availableActions.push('connectGitHub');
        blockedActions.push('syncRepos', 'curate', 'startAnalysis');
        break;
      case 'CONNECTED':
        availableActions.push('syncRepos');
        blockedActions.push('curate', 'startAnalysis');
        break;
      case 'SYNCED':
        availableActions.push('curate', 'startAnalysis');
        break;
      case 'ANALYZED':
        availableActions.push('viewPortfolio', 'modifyCuration');
        break;
    }

    return NextResponse.json({
      currentState,
      transitioned: false,
      analysis: {
        totalRepos,
        includedRepos: includedRepos.length,
        analyzedRepos: analyzedRepos.length,
        unanalyzedRepos: unanalyzedRepos.map(r => ({ id: r.id, name: r.name })),
        isComplete: unanalyzedRepos.length === 0 && includedRepos.length > 0,
      },
      githubConnection: githubConnection ? {
        githubUsername: githubConnection.githubUsername,
        lastSyncedAt: githubConnection.lastSyncedAt,
      } : null,
      availableActions,
      blockedActions,
    });
  } catch (error: any) {
    console.error('Workflow status error:', error);
    return NextResponse.json(
      { error: 'Failed to get workflow status', details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workflow/status - No-op for simplified workflow
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ success: true, message: 'Workflow simplified - no manual transitions needed' });
}

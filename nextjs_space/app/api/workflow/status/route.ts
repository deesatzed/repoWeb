import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import {
  getCurrentWorkflowState,
  transitionWorkflowState,
  verifyStateRequirements,
} from '@/lib/workflow-state';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workflow/status
 *
 * Returns current workflow state and checks if automatic state transitions
 * should occur (e.g., ANALYZING → ANALYZED when all repos analyzed).
 *
 * This endpoint is called by the UI to:
 * 1. Display current workflow state
 * 2. Check if analysis is complete
 * 3. Auto-transition to ANALYZED when ready
 * 4. Determine what actions are available
 */
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get current workflow state
    const currentState = await getCurrentWorkflowState(userId);

    // Fetch repositories and analysis status
    const [totalRepos, includedRepos, analyzedRepos, githubConnection] =
      await Promise.all([
        prisma.repository.count({
          where: { githubConnection: { userId } },
        }),
        prisma.repository.findMany({
          where: {
            githubConnection: { userId },
            isExcluded: false,
          },
          select: {
            id: true,
            name: true,
            aiAnalysis: {
              select: { id: true },
            },
          },
        }),
        prisma.repository.count({
          where: {
            githubConnection: { userId },
            isExcluded: false,
            aiAnalysis: { isNot: null },
          },
        }),
        prisma.gitHubConnection.findUnique({
          where: { userId },
          select: {
            githubUsername: true,
            lastSyncedAt: true,
          },
        }),
      ]);

    const unanalyzedRepos = includedRepos.filter((r) => !r.aiAnalysis);

    // Check if we should auto-transition to ANALYZED
    if (
      currentState === 'ANALYZING' &&
      includedRepos.length > 0 &&
      unanalyzedRepos.length === 0
    ) {
      await transitionWorkflowState(
        userId,
        'ANALYZED',
        `All ${includedRepos.length} included repositories analyzed`
      );

      return NextResponse.json({
        currentState: 'ANALYZED',
        transitioned: true,
        analysis: {
          totalRepos,
          includedRepos: includedRepos.length,
          analyzedRepos: includedRepos.length,
          unanalyzedRepos: [],
          isComplete: true,
        },
        githubConnection,
        availableActions: ['generateGroupingSuggestions', 'modifyCuration'],
        blockedActions: [],
      });
    }

    // Determine available actions based on current state
    const availableActions: string[] = [];
    const blockedActions: string[] = [];

    switch (currentState) {
      case 'INITIAL':
        availableActions.push('connectGitHub');
        blockedActions.push('syncRepos', 'curate', 'analyze', 'group');
        break;
      case 'CONNECTED':
        availableActions.push('syncRepos');
        blockedActions.push('curate', 'analyze', 'group');
        break;
      case 'SYNCED':
        availableActions.push('curate');
        blockedActions.push('analyze', 'group');
        break;
      case 'CURATED':
        if (includedRepos.length > 0) {
          availableActions.push('startAnalysis');
        }
        blockedActions.push('group');
        break;
      case 'ANALYZING':
        availableActions.push('viewProgress');
        blockedActions.push('curate', 'group');
        break;
      case 'ANALYZED':
        availableActions.push('generateGroupingSuggestions', 'modifyCuration');
        break;
      case 'GROUPING_SUGGESTED':
        availableActions.push('refineGroupings', 'finalize');
        break;
      case 'FINALIZED':
        availableActions.push('viewPortfolio', 'modifyCuration');
        break;
    }

    return NextResponse.json({
      currentState,
      transitioned: false,
      analysis: {
        totalRepos,
        includedRepos: includedRepos.length,
        analyzedRepos,
        unanalyzedRepos: unanalyzedRepos.map((r) => ({
          id: r.id,
          name: r.name,
        })),
        isComplete: unanalyzedRepos.length === 0 && includedRepos.length > 0,
      },
      githubConnection,
      availableActions,
      blockedActions,
    });
  } catch (error: any) {
    console.error('Workflow status error:', error);
    return NextResponse.json(
      { error: 'Failed to get workflow status', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workflow/status
 *
 * Manually trigger workflow state transitions
 * Body: { action: 'startAnalysis' | 'completeAnalysis' | 'reset' }
 */
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await request.json();
    const userId = session.user.id;

    if (action === 'startAnalysis') {
      // Transition to ANALYZING state
      const currentState = await getCurrentWorkflowState(userId);

      if (currentState !== 'CURATED') {
        return NextResponse.json(
          { error: 'Can only start analysis from CURATED state' },
          { status: 400 }
        );
      }

      const includedRepos = await prisma.repository.count({
        where: {
          githubConnection: { userId },
          isExcluded: false,
        },
      });

      if (includedRepos === 0) {
        return NextResponse.json(
          { error: 'No repositories to analyze (all excluded)' },
          { status: 400 }
        );
      }

      const result = await transitionWorkflowState(
        userId,
        'ANALYZING',
        `Started analysis workflow for ${includedRepos} repositories`
      );

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        newState: 'ANALYZING',
        message: `Analysis started for ${includedRepos} repositories`,
      });
    }

    if (action === 'completeAnalysis') {
      // Check if all repos are analyzed, then transition
      const verification = await verifyStateRequirements(userId, 'ANALYZED');

      if (!verification.satisfied) {
        return NextResponse.json(
          { error: verification.missing },
          { status: 400 }
        );
      }

      const result = await transitionWorkflowState(
        userId,
        'ANALYZED',
        'Manual completion of analysis phase'
      );

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        newState: 'ANALYZED',
        message: 'Analysis phase completed',
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Workflow action error:', error);
    return NextResponse.json(
      { error: 'Failed to execute workflow action', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

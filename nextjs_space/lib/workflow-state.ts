import { PortfolioWorkflowState } from '@prisma/client';
import prisma from './db';

/**
 * Workflow State Machine for Portfolio Curation
 *
 * User's required workflow:
 * 1. Login + GitHub token → CONNECTED
 * 2. Sync repos → SYNCED
 * 3. Manual curation (exclude/include) → CURATED
 * 4. Deep analysis on ALL included repos → ANALYZING → ANALYZED
 * 5. AI suggests groupings based on analysis → GROUPING_SUGGESTED
 * 6. User refines groupings → FINALIZED
 * 7. Public portfolio ready for employers
 */

// Valid state transitions
const ALLOWED_TRANSITIONS: Record<PortfolioWorkflowState, PortfolioWorkflowState[]> = {
  INITIAL: ['CONNECTED'],
  CONNECTED: ['SYNCED', 'INITIAL'], // Can disconnect GitHub
  SYNCED: ['CURATED', 'CONNECTED'], // Can re-sync
  CURATED: ['ANALYZING', 'SYNCED'], // Must analyze OR go back to sync
  ANALYZING: ['ANALYZED', 'CURATED'], // Complete OR cancel (unlock)
  ANALYZED: ['GROUPING_SUGGESTED', 'CURATED'], // Get suggestions OR re-curate
  GROUPING_SUGGESTED: ['FINALIZED', 'ANALYZED'], // Finalize OR regenerate
  FINALIZED: ['CURATED'], // Can go back to refine (must re-analyze)
};

// States that are locked (no modifications allowed)
const LOCKED_STATES: PortfolioWorkflowState[] = ['ANALYZING'];

// States that require specific data to exist
const STATE_REQUIREMENTS: Record<PortfolioWorkflowState, string> = {
  INITIAL: 'New user, no requirements',
  CONNECTED: 'GitHub connection must exist',
  SYNCED: 'At least one repository must be synced',
  CURATED: 'At least one repository must be included (not excluded)',
  ANALYZING: 'Analysis must be in progress',
  ANALYZED: 'All included repositories must have AI analysis',
  GROUPING_SUGGESTED: 'Projects must exist with AI-suggested groupings',
  FINALIZED: 'User has approved final groupings',
};

export interface StateTransition {
  from: PortfolioWorkflowState;
  to: PortfolioWorkflowState;
  timestamp: string;
  reason?: string;
}

export interface WorkflowValidationResult {
  allowed: boolean;
  reason?: string;
  currentState: PortfolioWorkflowState;
  isLocked: boolean;
}

/**
 * Check if a state transition is valid
 */
export function canTransition(
  currentState: PortfolioWorkflowState,
  targetState: PortfolioWorkflowState
): { allowed: boolean; reason?: string } {
  const allowedTargets = ALLOWED_TRANSITIONS[currentState] || [];

  if (currentState === targetState) {
    return { allowed: true, reason: 'Already in target state' };
  }

  if (!allowedTargets.includes(targetState)) {
    return {
      allowed: false,
      reason: `Cannot transition from ${currentState} to ${targetState}. Allowed: ${allowedTargets.join(', ')}`,
    };
  }

  return { allowed: true };
}

/**
 * Check if the current workflow state is locked
 */
export function isWorkflowLocked(state: PortfolioWorkflowState): boolean {
  return LOCKED_STATES.includes(state);
}

/**
 * Validate if user can perform an action in the current workflow state
 */
export async function validateWorkflowAction(
  userId: string,
  requiredState: PortfolioWorkflowState | PortfolioWorkflowState[],
  action: string
): Promise<WorkflowValidationResult> {
  const settings = await prisma.portfolioSettings.findUnique({
    where: { userId },
  });

  const currentState = settings?.workflowState || 'INITIAL';
  const isLocked = isWorkflowLocked(currentState);

  // If workflow is locked, no actions allowed (except unlocking)
  if (isLocked && action !== 'unlock') {
    return {
      allowed: false,
      reason: `Portfolio is locked during ${currentState}. Please wait for analysis to complete.`,
      currentState,
      isLocked: true,
    };
  }

  // Check if current state matches required state(s)
  const requiredStates = Array.isArray(requiredState) ? requiredState : [requiredState];

  if (!requiredStates.includes(currentState)) {
    return {
      allowed: false,
      reason: `Cannot ${action} in state ${currentState}. Required: ${requiredStates.join(' or ')}`,
      currentState,
      isLocked,
    };
  }

  return {
    allowed: true,
    currentState,
    isLocked,
  };
}

/**
 * Transition workflow state with audit logging
 */
export async function transitionWorkflowState(
  userId: string,
  targetState: PortfolioWorkflowState,
  reason?: string
): Promise<{ success: boolean; error?: string; newState?: PortfolioWorkflowState }> {
  try {
    const settings = await prisma.portfolioSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      // Auto-create settings if they don't exist
      const newSettings = await prisma.portfolioSettings.create({
        data: {
          userId,
          workflowState: targetState,
          stateTransitionLog: JSON.stringify([
            {
              from: 'INITIAL',
              to: targetState,
              timestamp: new Date().toISOString(),
              reason: reason || 'Initial state creation',
            },
          ]),
        },
      });

      return { success: true, newState: newSettings.workflowState };
    }

    const currentState = settings.workflowState;

    // Validate transition
    const validation = canTransition(currentState, targetState);
    if (!validation.allowed) {
      return { success: false, error: validation.reason };
    }

    // Parse existing log
    const existingLog: StateTransition[] = settings.stateTransitionLog
      ? JSON.parse(settings.stateTransitionLog as string)
      : [];

    // Add new transition
    const newTransition: StateTransition = {
      from: currentState,
      to: targetState,
      timestamp: new Date().toISOString(),
      reason,
    };

    const updatedLog = [...existingLog, newTransition];

    // Update state
    const updatedSettings = await prisma.portfolioSettings.update({
      where: { userId },
      data: {
        workflowState: targetState,
        workflowLockedAt: isWorkflowLocked(targetState) ? new Date() : null,
        stateTransitionLog: JSON.stringify(updatedLog),
      },
    });

    return { success: true, newState: updatedSettings.workflowState };
  } catch (error) {
    console.error('Workflow state transition error:', error);
    return { success: false, error: 'Failed to transition workflow state' };
  }
}

/**
 * Verify workflow requirements before transitioning
 */
export async function verifyStateRequirements(
  userId: string,
  targetState: PortfolioWorkflowState
): Promise<{ satisfied: boolean; missing?: string }> {
  switch (targetState) {
    case 'CONNECTED': {
      const connection = await prisma.gitHubConnection.findFirst({
        where: { userId },
      });
      if (!connection) {
        return { satisfied: false, missing: 'GitHub connection required' };
      }
      break;
    }

    case 'SYNCED': {
      const repoCount = await prisma.repository.count({
        where: { githubConnection: { userId } },
      });
      if (repoCount === 0) {
        return { satisfied: false, missing: 'At least one repository must be synced' };
      }
      break;
    }

    case 'CURATED': {
      const includedCount = await prisma.repository.count({
        where: {
          githubConnection: { userId },
          isExcluded: false,
        },
      });
      if (includedCount === 0) {
        return { satisfied: false, missing: 'At least one repository must be included' };
      }
      break;
    }

    case 'ANALYZED': {
      // All included repos must have analysis
      const repos = await prisma.repository.findMany({
        where: {
          githubConnection: { userId },
          isExcluded: false,
        },
        include: { aiAnalysis: true },
      });

      const unanalyzedRepos = repos.filter((r) => !r.aiAnalysis);
      if (unanalyzedRepos.length > 0) {
        return {
          satisfied: false,
          missing: `${unanalyzedRepos.length} repositories still need analysis`,
        };
      }
      break;
    }

    case 'GROUPING_SUGGESTED': {
      const projectCount = await prisma.project.count({
        where: { userId },
      });
      if (projectCount === 0) {
        return { satisfied: false, missing: 'No project groupings exist' };
      }
      break;
    }
  }

  return { satisfied: true };
}

/**
 * Get current workflow state for a user
 */
export async function getCurrentWorkflowState(
  userId: string
): Promise<PortfolioWorkflowState | null> {
  const settings = await prisma.portfolioSettings.findUnique({
    where: { userId },
  });

  return settings?.workflowState || null;
}

/**
 * Get workflow state transition history
 */
export async function getWorkflowHistory(
  userId: string
): Promise<StateTransition[]> {
  const settings = await prisma.portfolioSettings.findUnique({
    where: { userId },
  });

  if (!settings?.stateTransitionLog) {
    return [];
  }

  return JSON.parse(settings.stateTransitionLog as string);
}

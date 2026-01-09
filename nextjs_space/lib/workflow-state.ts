import { db } from './storage';

/**
 * Workflow State Machine for Portfolio Curation (Simplified for single-user mode)
 */

export type PortfolioWorkflowState = 
  | 'INITIAL'
  | 'CONNECTED'
  | 'SYNCED'
  | 'CURATED'
  | 'ANALYZING'
  | 'ANALYZED'
  | 'GROUPING_SUGGESTED'
  | 'FINALIZED';

// Valid state transitions
const ALLOWED_TRANSITIONS: Record<PortfolioWorkflowState, PortfolioWorkflowState[]> = {
  INITIAL: ['CONNECTED'],
  CONNECTED: ['SYNCED', 'INITIAL'],
  SYNCED: ['CURATED', 'CONNECTED'],
  CURATED: ['ANALYZING', 'SYNCED'],
  ANALYZING: ['ANALYZED', 'CURATED'],
  ANALYZED: ['GROUPING_SUGGESTED', 'CURATED'],
  GROUPING_SUGGESTED: ['FINALIZED', 'ANALYZED'],
  FINALIZED: ['CURATED'],
};

// States that are locked (no modifications allowed)
const LOCKED_STATES: PortfolioWorkflowState[] = ['ANALYZING'];

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
  const settings = await db.getSettings(userId);
  const currentState = (settings?.workflowState as PortfolioWorkflowState) || 'INITIAL';
  const isLocked = isWorkflowLocked(currentState);

  if (isLocked && action !== 'unlock') {
    return {
      allowed: false,
      reason: `Portfolio is locked during ${currentState}. Please wait for analysis to complete.`,
      currentState,
      isLocked: true,
    };
  }

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
 * Transition workflow state
 */
export async function transitionWorkflowState(
  userId: string,
  targetState: PortfolioWorkflowState,
  reason?: string
): Promise<{ success: boolean; error?: string; newState?: PortfolioWorkflowState }> {
  try {
    const settings = await db.getSettings(userId);
    const currentState = (settings?.workflowState as PortfolioWorkflowState) || 'INITIAL';

    const validation = canTransition(currentState, targetState);
    if (!validation.allowed) {
      return { success: false, error: validation.reason };
    }

    await db.upsertSettings({
      userId,
      workflowState: targetState,
    });

    return { success: true, newState: targetState };
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
      const connection = await db.getGitHubConnection(userId);
      if (!connection) {
        return { satisfied: false, missing: 'GitHub connection required' };
      }
      break;
    }

    case 'SYNCED': {
      const repos = await db.getRepositories(userId);
      if (repos.length === 0) {
        return { satisfied: false, missing: 'At least one repository must be synced' };
      }
      break;
    }

    case 'CURATED': {
      const repos = await db.getRepositories(userId);
      const includedCount = repos.filter(r => !r.isExcluded).length;
      if (includedCount === 0) {
        return { satisfied: false, missing: 'At least one repository must be included' };
      }
      break;
    }

    case 'ANALYZED': {
      const repos = await db.getRepositories(userId);
      const unanalyzedRepos = repos.filter(r => !r.isExcluded && !r.aiAnalysis);
      if (unanalyzedRepos.length > 0) {
        return {
          satisfied: false,
          missing: `${unanalyzedRepos.length} repositories still need analysis`,
        };
      }
      break;
    }

    case 'GROUPING_SUGGESTED': {
      const projects = await db.getProjects(userId);
      if (projects.length === 0) {
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
  const settings = await db.getSettings(userId);
  return (settings?.workflowState as PortfolioWorkflowState) || null;
}

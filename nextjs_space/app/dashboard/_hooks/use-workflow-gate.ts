import { useEffect, useState } from 'react';

interface WorkflowStatus {
  currentState: string;
  analysis: {
    totalRepos: number;
    includedRepos: number;
    analyzedRepos: number;
    unanalyzedRepos: Array<{ id: string; name: string }>;
    isComplete: boolean;
  };
  availableActions: string[];
  blockedActions: string[];
}

interface WorkflowGate {
  currentState: string;
  isAllowed: (action: string) => boolean;
  getBlockedReason: (action: string) => string | null;
  canCurate: boolean;
  canAnalyze: boolean;
  canGenerateGroupings: boolean;
  canFinalize: boolean;
  analysisProgress: {
    total: number;
    completed: number;
    remaining: number;
    isComplete: boolean;
  };
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Hook for gating UI elements based on workflow state
 *
 * Usage:
 * const gate = useWorkflowGate();
 *
 * // Check if action is allowed
 * if (gate.canGenerateGroupings) {
 *   // Show "Get AI Suggestions" button
 * }
 *
 * // Get reason why action is blocked
 * const reason = gate.getBlockedReason('generateGroupingSuggestions');
 * // Returns: "All included repositories must be analyzed first"
 */
export function useWorkflowGate(): WorkflowGate {
  const [status, setStatus] = useState<WorkflowStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const normalizeAction = (action: string) => {
    const aliases: Record<string, string> = {
      group: 'generateGroupingSuggestions',
      analyze: 'startAnalysis',
    };
    return aliases[action] ?? action;
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/workflow/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch workflow status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const isAllowed = (action: string): boolean => {
    if (!status) return false;
    const normalized = normalizeAction(action);
    return status.availableActions.includes(normalized);
  };

  const getBlockedReason = (action: string): string | null => {
    if (!status) return 'Loading workflow status...';
    const normalized = normalizeAction(action);
    if (isAllowed(normalized)) return null;

    const stateMessages: Record<string, Record<string, string>> = {
      INITIAL: {
        syncRepos: 'Connect GitHub first',
        curate: 'Connect GitHub and sync repositories first',
        startAnalysis: 'Connect GitHub and sync repositories first',
        generateGroupingSuggestions: 'Complete all previous steps first',
      },
      CONNECTED: {
        syncRepos: 'Sync repositories first',
        curate: 'Sync repositories first',
        startAnalysis: 'Sync repositories first',
        generateGroupingSuggestions: 'Sync repositories and complete curation first',
      },
      SYNCED: {
        curate: 'Select which repositories to include first',
        startAnalysis: 'Select which repositories to include first',
        generateGroupingSuggestions: 'Select repositories and analyze them first',
      },
      CURATED: {
        generateGroupingSuggestions: `All ${status.analysis.includedRepos} included repositories must be analyzed first (${status.analysis.analyzedRepos} of ${status.analysis.includedRepos} complete)`,
      },
      ANALYZING: {
        curate: 'Cannot modify curation while analysis is in progress',
        generateGroupingSuggestions: `Analysis in progress (${status.analysis.analyzedRepos} of ${status.analysis.includedRepos} complete)`,
      },
    };

    return stateMessages[status.currentState]?.[normalized] || 'This action is not available yet';
  };

  const currentState = status?.currentState || 'INITIAL';
  const canCurate =
    isAllowed('curate') || ['SYNCED', 'CURATED', 'ANALYZED'].includes(currentState);
  const canAnalyze =
    isAllowed('startAnalysis') || ['CURATED', 'ANALYZING', 'ANALYZED'].includes(currentState);
  const canGenerateGroupings = isAllowed('generateGroupingSuggestions');
  const canFinalize = isAllowed('finalize');

  return {
    currentState,
    isAllowed,
    getBlockedReason,
    canCurate,
    canAnalyze,
    canGenerateGroupings,
    canFinalize,
    analysisProgress: {
      total: status?.analysis.includedRepos || 0,
      completed: status?.analysis.analyzedRepos || 0,
      remaining: (status?.analysis.includedRepos || 0) - (status?.analysis.analyzedRepos || 0),
      isComplete: status?.analysis.isComplete || false,
    },
    loading,
    refresh: fetchStatus,
  };
}

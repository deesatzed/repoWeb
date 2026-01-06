'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react';

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

export function WorkflowStatusIndicator() {
  const [status, setStatus] = useState<WorkflowStatus | null>(null);
  const [loading, setLoading] = useState(true);

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
    // Refresh status every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !status) {
    return null;
  }

  const getStateDisplay = (state: string) => {
    const stateConfig: Record<
      string,
      { label: string; color: string; icon: typeof Clock }
    > = {
      INITIAL: {
        label: 'Not Connected',
        color: 'text-slate-400',
        icon: AlertCircle,
      },
      CONNECTED: {
        label: 'GitHub Connected',
        color: 'text-blue-400',
        icon: CheckCircle,
      },
      SYNCED: { label: 'Repos Synced', color: 'text-blue-400', icon: CheckCircle },
      CURATED: {
        label: 'Ready for Analysis',
        color: 'text-purple-400',
        icon: Clock,
      },
      ANALYZING: {
        label: 'Analysis in Progress',
        color: 'text-yellow-400',
        icon: Loader2,
      },
      ANALYZED: {
        label: 'Analysis Complete',
        color: 'text-green-400',
        icon: CheckCircle,
      },
      GROUPING_SUGGESTED: {
        label: 'AI Suggestions Ready',
        color: 'text-cyan-400',
        icon: CheckCircle,
      },
      FINALIZED: {
        label: 'Portfolio Finalized',
        color: 'text-emerald-400',
        icon: CheckCircle,
      },
    };

    return stateConfig[state] || stateConfig.INITIAL;
  };

  const stateInfo = getStateDisplay(status.currentState);
  const Icon = stateInfo.icon;

  const showAnalysisProgress =
    status.currentState === 'CURATED' || status.currentState === 'ANALYZING';

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon
            className={`h-5 w-5 ${stateInfo.color} ${
              status.currentState === 'ANALYZING' ? 'animate-spin' : ''
            }`}
          />
          <span className="text-sm font-medium text-slate-200">
            {stateInfo.label}
          </span>
        </div>
      </div>

      {showAnalysisProgress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Analysis Progress</span>
            <span>
              {status.analysis.analyzedRepos} / {status.analysis.includedRepos}
            </span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 transition-all duration-300"
              style={{
                width: `${
                  status.analysis.includedRepos > 0
                    ? (status.analysis.analyzedRepos /
                        status.analysis.includedRepos) *
                      100
                    : 0
                }%`,
              }}
            />
          </div>
          {status.analysis.unanalyzedRepos.length > 0 && (
            <p className="text-xs text-slate-400">
              {status.analysis.unanalyzedRepos.length} repositories need analysis
              before AI grouping suggestions
            </p>
          )}
        </div>
      )}

      {status.currentState === 'ANALYZED' && (
        <p className="text-xs text-green-400">
          ✓ All repositories analyzed. Ready for AI grouping suggestions.
        </p>
      )}

      {status.blockedActions.includes('group') &&
        !status.analysis.isComplete && (
          <div className="flex items-start gap-2 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded">
            <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-yellow-200">
              AI grouping suggestions blocked until all included repositories are
              analyzed
            </p>
          </div>
        )}
    </div>
  );
}

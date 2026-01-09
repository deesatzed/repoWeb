'use client';

import { useEffect, useState } from 'react';
import { Check, Circle, Lock, ChevronRight } from 'lucide-react';

interface WorkflowStep {
  id: number;
  state: string;
  label: string;
  description: string;
  action?: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 1,
    state: 'CONNECTED',
    label: 'Connect GitHub',
    description: 'Authenticate with your GitHub account',
    action: 'Enter GitHub token',
  },
  {
    id: 2,
    state: 'SYNCED',
    label: 'Sync Repositories',
    description: 'Import your repositories from GitHub',
    action: 'Sync repos',
  },
  {
    id: 3,
    state: 'CURATED',
    label: 'Curate Portfolio',
    description: 'Include/exclude repositories for your portfolio',
    action: 'Select repos',
  },
  {
    id: 4,
    state: 'ANALYZED',
    label: 'Analyze Repositories',
    description: 'Deep AI analysis of all included repositories',
    action: 'Run analysis',
  },
  {
    id: 5,
    state: 'GROUPING_SUGGESTED',
    label: 'AI Grouping',
    description: 'Get intelligent project grouping suggestions',
    action: 'Get suggestions',
  },
  {
    id: 6,
    state: 'FINALIZED',
    label: 'Finalize Portfolio',
    description: 'Review and approve final groupings',
    action: 'Approve',
  },
];

interface WorkflowStepperProps {
  currentState: string;
  onStepClick?: (step: WorkflowStep) => void;
}

export function WorkflowStepper({ currentState, onStepClick }: WorkflowStepperProps) {
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);

  const getStateOrder = (state: string): number => {
    const stateMap: Record<string, number> = {
      INITIAL: 0,
      CONNECTED: 1,
      SYNCED: 2,
      CURATED: 3,
      ANALYZING: 3.5, // Between CURATED and ANALYZED
      ANALYZED: 4,
      GROUPING_SUGGESTED: 5,
      FINALIZED: 6,
    };
    return stateMap[state] || 0;
  };

  const currentOrder = getStateOrder(currentState);

  const getStepStatus = (step: WorkflowStep): 'completed' | 'current' | 'upcoming' | 'locked' => {
    const stepOrder = getStateOrder(step.state);

    if (stepOrder < currentOrder) {
      return 'completed';
    } else if (stepOrder === currentOrder) {
      return 'current';
    } else if (stepOrder === currentOrder + 0.5 || stepOrder === currentOrder + 1) {
      return 'upcoming';
    } else {
      return 'locked';
    }
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-200 mb-2">
          Portfolio Setup Progress
        </h3>
        <p className="text-sm text-slate-400">
          Follow these steps to create your professional portfolio
        </p>
      </div>

      <div className="space-y-4" role="list" aria-label="Portfolio setup steps">
        {WORKFLOW_STEPS.map((step, index) => {
          const status = getStepStatus(step);
          const isHovered = hoveredStep === step.id;

          return (
            <div
              key={step.id}
              role="listitem"
              aria-current={status === 'current' ? 'step' : undefined}
              onMouseEnter={() => setHoveredStep(step.id)}
              onMouseLeave={() => setHoveredStep(null)}
              className={`relative flex items-start gap-4 p-4 rounded-lg transition-all ${
                status === 'current'
                  ? 'bg-purple-500/10 border border-purple-500/30'
                  : status === 'completed'
                  ? 'bg-green-500/5 border border-green-500/20'
                  : 'bg-slate-800/30 border border-slate-700/50'
              } ${
                status === 'upcoming' || status === 'current'
                  ? 'cursor-pointer hover:bg-slate-700/50'
                  : ''
              }`}
              onClick={() => {
                if (
                  (status === 'upcoming' || status === 'current') &&
                  onStepClick
                ) {
                  onStepClick(step);
                }
              }}
            >
              {/* Step Icon */}
              <div className="flex-shrink-0 mt-1">
                {status === 'completed' ? (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500/20 border-2 border-green-500">
                    <Check className="w-5 h-5 text-green-400" />
                  </div>
                ) : status === 'current' ? (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/20 border-2 border-purple-500 animate-pulse">
                    <Circle className="w-4 h-4 text-purple-400 fill-purple-400" />
                  </div>
                ) : status === 'upcoming' ? (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-700 border-2 border-slate-600">
                    <span className="text-sm font-medium text-slate-400">
                      {step.id}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-700">
                    <Lock className="w-4 h-4 text-slate-600" />
                  </div>
                )}
              </div>

              {/* Step Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4
                    className={`text-sm font-medium ${
                      status === 'completed'
                        ? 'text-green-400'
                        : status === 'current'
                        ? 'text-purple-400'
                        : status === 'upcoming'
                        ? 'text-slate-300'
                        : 'text-slate-600'
                    }`}
                  >
                    {step.label}
                  </h4>
                  {status === 'completed' && (
                    <span className="text-xs text-green-400 font-medium">
                      Complete
                    </span>
                  )}
                  {status === 'current' && (
                    <span className="text-xs text-purple-400 font-medium flex items-center gap-1">
                      In Progress
                      <ChevronRight className="w-3 h-3" />
                    </span>
                  )}
                </div>
                <p
                  className={`text-xs ${
                    status === 'locked' ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  {step.description}
                </p>
                {status === 'current' && step.action && (
                  <div className="mt-2">
                    <span className="text-xs text-purple-300 font-medium">
                      → {step.action}
                    </span>
                  </div>
                )}
              </div>

              {/* Connector Line */}
              {index < WORKFLOW_STEPS.length - 1 && (
                <div
                  className={`absolute left-[27px] top-[56px] w-0.5 h-4 ${
                    status === 'completed'
                      ? 'bg-green-500/30'
                      : 'bg-slate-700/50'
                  }`}
                  aria-hidden="true"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Special State: ANALYZING */}
      {currentState === 'ANALYZING' && (
        <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-200 mb-1">
                Analysis in Progress
              </p>
              <p className="text-xs text-yellow-300/80">
                Portfolio is locked while repositories are being analyzed. Check the
                analysis progress above.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Final Step Indicator */}
      {currentState === 'FINALIZED' && (
        <div className="mt-4 p-4 bg-emerald-900/20 border border-emerald-700/30 rounded-lg">
          <div className="flex items-start gap-3">
            <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-emerald-200 mb-1">
                Portfolio Ready!
              </p>
              <p className="text-xs text-emerald-300/80">
                Your portfolio is finalized and ready to share with employers.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

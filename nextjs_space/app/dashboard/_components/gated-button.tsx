'use client';

import { ReactNode, useState } from 'react';
import { Lock, AlertCircle } from 'lucide-react';

interface GatedButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  gated?: boolean;
  gateReason?: string | null;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  icon?: ReactNode;
}

/**
 * Button component that can be gated based on workflow state
 *
 * Usage:
 * const gate = useWorkflowGate();
 *
 * <GatedButton
 *   gated={!gate.canGenerateGroupings}
 *   gateReason={gate.getBlockedReason('generateGroupingSuggestions')}
 *   onClick={handleGenerateGroupings}
 * >
 *   Get AI Suggestions
 * </GatedButton>
 */
export function GatedButton({
  children,
  onClick,
  disabled = false,
  gated = false,
  gateReason = null,
  variant = 'primary',
  size = 'md',
  className = '',
  icon,
}: GatedButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const isDisabled = disabled || gated;

  const baseClasses = 'relative inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900';

  const variantClasses = {
    primary: gated
      ? 'bg-blue-600/20 text-blue-400/50 border border-blue-600/30 cursor-not-allowed'
      : disabled
      ? 'bg-blue-600/50 text-blue-200/50 border border-blue-600/50 cursor-not-allowed'
      : 'bg-blue-600 text-white border border-blue-500 hover:bg-blue-700 focus:ring-blue-500',
    secondary: gated
      ? 'bg-slate-700/20 text-slate-500 border border-slate-600/30 cursor-not-allowed'
      : disabled
      ? 'bg-slate-700/50 text-slate-400/50 border border-slate-600/50 cursor-not-allowed'
      : 'bg-slate-700 text-slate-200 border border-slate-600 hover:bg-slate-600 focus:ring-slate-500',
    danger: gated
      ? 'bg-red-500/20 text-red-400/50 border border-red-500/30 cursor-not-allowed'
      : disabled
      ? 'bg-red-500/50 text-red-200/50 border border-red-500/50 cursor-not-allowed'
      : 'bg-red-600 text-white border border-red-500 hover:bg-red-700 focus:ring-red-500',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const handleClick = () => {
    if (!isDisabled && onClick) {
      onClick();
    }
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        onMouseEnter={() => gated && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        aria-disabled={isDisabled}
        aria-describedby={gated && gateReason ? 'gate-reason' : undefined}
      >
        {gated && <Lock className="w-4 h-4" aria-hidden="true" />}
        {!gated && icon}
        <span>{children}</span>
      </button>

      {/* Tooltip for gated state */}
      {gated && gateReason && showTooltip && (
        <div
          id="gate-reason"
          role="tooltip"
          className="absolute z-50 left-1/2 transform -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-slate-900 border border-yellow-700/50 rounded-lg shadow-xl max-w-xs"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-200">{gateReason}</p>
          </div>
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
            <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-yellow-700/50"></div>
          </div>
        </div>
      )}
    </div>
  );
}

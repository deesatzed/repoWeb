import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle2, 
  Circle, 
  RefreshCw, 
  Sparkles, 
  FolderOpen, 
  LayoutGrid, 
  ArrowRight, 
  RotateCcw,
  AlertCircle,
  EyeOff,
  Pencil
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stats {
  repoCount: number;
  projectCount: number;
  analyzedCount: number;
  excludedCount: number;
  hasRepos: boolean;
  isCurated: boolean;
  isAnalyzed: boolean;
  lastSyncedAt?: string;
}

interface PortfolioChecklistProps {
  stats: Stats | null;
  loading: boolean;
  onAction: (action: 'sync' | 'curate' | 'analyze' | 'view') => void;
  isSyncing?: boolean;
  isAnalyzing?: boolean;
}

export function PortfolioChecklist({ 
  stats, 
  loading, 
  onAction,
  isSyncing = false,
  isAnalyzing = false
}: PortfolioChecklistProps) {
  if (loading || !stats) return null;

  const steps = [
    {
      id: 'sync',
      title: '1. Connect & Sync',
      description: 'Import your technical history from GitHub.',
      status: stats.hasRepos ? 'completed' : 'pending',
      icon: LayoutGrid,
      stats: `${stats.repoCount} repositories`,
      actionLabel: stats.hasRepos ? 'Sync Again' : 'Sync Now',
      actionIcon: stats.hasRepos ? RotateCcw : RefreshCw,
      onAction: () => onAction('sync'),
      isProcessing: isSyncing,
      warning: null
    },
    {
      id: 'curate',
      title: '2. Select & Filter',
      description: 'Hide forks, boilerplate, or irrelevant exercises.',
      status: stats.excludedCount > 0 ? 'completed' : (stats.hasRepos ? 'in_progress' : 'pending'),
      icon: EyeOff,
      stats: `${stats.repoCount - stats.excludedCount} selected`,
      actionLabel: 'Filter Repos',
      actionIcon: ArrowRight,
      onAction: () => onAction('curate'),
      warning: null
    },
    {
      id: 'group',
      title: '3. Smart Grouping',
      description: 'Use Magic Auto-Curate to group related repositories.',
      status: stats.projectCount > 0 ? 'completed' : (stats.excludedCount > 0 ? 'in_progress' : 'pending'),
      icon: FolderOpen,
      stats: `${stats.projectCount} groups`,
      actionLabel: 'Group Projects',
      actionIcon: Sparkles,
      onAction: () => onAction('curate'),
      warning: null
    },
    {
      id: 'refine',
      title: '4. Refine Groups',
      description: 'Add or remove members from project groups.',
      status: stats.projectCount > 0 ? 'completed' : 'pending',
      icon: Pencil,
      stats: 'Marina-style efficiency',
      actionLabel: 'Refine Groups',
      actionIcon: ArrowRight,
      onAction: () => onAction('curate'),
      warning: null
    },
    {
      id: 'analyze',
      title: '5. Deep AI Analysis',
      description: 'Generate high-signal content for prospective employers.',
      status: stats.isAnalyzed ? 'completed' : (isAnalyzing ? 'in_progress' : 'pending'),
      icon: Sparkles,
      stats: `${stats.analyzedCount} analyzed`,
      actionLabel: stats.isAnalyzed ? 'Update Analysis' : 'Start Deep Analysis',
      actionIcon: Sparkles,
      onAction: () => onAction('analyze'),
      isProcessing: isAnalyzing,
      progress: stats.repoCount > 0 ? (stats.analyzedCount / (Math.max(1, stats.repoCount - stats.excludedCount))) * 100 : 0,
      warning: null
    }
  ];

  const allCompleted = steps.every(s => s.status === 'completed');

  return (
    <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm mb-8">
      <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-purple-400" />
                  Portfolio Roadmap
                </CardTitle>
                <p className="text-slate-400 text-sm mt-1">
                  Follow these steps to build a high-signal portfolio for employers.
                </p>
              </div>
              <div className="text-right">
                {stats.lastSyncedAt && (
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                    Last Synced: {new Date(stats.lastSyncedAt).toLocaleTimeString()}
                  </p>
                )}
                {allCompleted && (
                  <Badge className="bg-green-500/20 text-green-300 border-green-500/50 mt-1">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    All Set!
                  </Badge>
                )}
              </div>
            </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {steps.map((step, index) => (
          <div 
            key={step.id}
            className={cn(
              "flex items-start gap-4 p-4 rounded-lg border transition-all",
              step.status === 'completed' 
                ? "bg-slate-800/30 border-green-900/30" 
                : step.status === 'in_progress'
                  ? "bg-purple-900/10 border-purple-500/30"
                  : "bg-slate-800/50 border-slate-700"
            )}
          >
            {/* Status Icon */}
            <div className="mt-1">
              {step.status === 'completed' ? (
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              ) : step.status === 'in_progress' ? (
                <div className="w-6 h-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
              ) : (
                <Circle className="w-6 h-6 text-slate-600" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h3 className={cn(
                  "font-medium",
                  step.status === 'completed' ? "text-green-200" : "text-white"
                )}>
                  {step.title}
                </h3>
                {step.stats && (
                  <span className="text-xs text-slate-400 font-mono bg-slate-900/50 px-2 py-1 rounded">
                    {step.stats}
                  </span>
                )}
              </div>
              
              <p className="text-sm text-slate-400 mb-3">
                {step.description}
              </p>

              {step.warning && (
                <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-900/20 p-2 rounded mb-3 border border-amber-900/50">
                  <AlertCircle className="w-3 h-3" />
                  {step.warning}
                </div>
              )}

              {step.progress !== undefined && step.status !== 'completed' && step.progress > 0 && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Progress</span>
                    <span>{Math.round(step.progress)}%</span>
                  </div>
                  <Progress value={step.progress} className="h-1.5 bg-slate-800" />
                </div>
              )}

              <Button 
                variant={step.status === 'completed' ? "ghost" : "default"}
                size="sm"
                onClick={step.onAction}
                disabled={step.isProcessing}
                className={cn(
                  "h-8",
                  step.status === 'completed' 
                    ? "text-slate-400 hover:text-white hover:bg-slate-800" 
                    : "bg-purple-600 hover:bg-purple-700 text-white"
                )}
              >
                <step.actionIcon className={cn(
                  "w-3 h-3 mr-2",
                  step.isProcessing ? "animate-spin" : ""
                )} />
                {step.isProcessing ? 'Processing...' : step.actionLabel}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

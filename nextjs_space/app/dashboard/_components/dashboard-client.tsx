'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  Github, 
  RefreshCw, 
  Sparkles, 
  ExternalLink,
  Settings,
  Eye,
  LayoutGrid,
  FolderOpen,
  Copy,
  Check,
  Share2,
  Briefcase,
  X,
  Pencil,
  EyeOff,
  UserCircle,
  Code2
} from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RepositoryList from '@/app/dashboard/_components/repository-list';
import { PortfolioCuration } from '@/app/dashboard/_components/portfolio-curation';
import { PortfolioChecklist } from '@/app/dashboard/_components/portfolio-checklist';
import EngineeringDNA from '@/components/engineering-dna';
import { WorkflowStepper } from '@/app/dashboard/_components/workflow-stepper';
import { WorkflowStatusIndicator } from '@/app/dashboard/_components/workflow-status';

interface GitHubConnection {
  connected: boolean;
  githubUsername?: string;
  lastSyncedAt?: string;
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export default function DashboardClient() {
  const router = useRouter();
  const [githubToken, setGithubToken] = useState('');
  const [connection, setConnection] = useState<GitHubConnection | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [highlightRepos, setHighlightRepos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('repositories');
  const [triggerAnalyze, setTriggerAnalyze] = useState(false);
  const [syncSummary, setSyncSummary] = useState<{ created: number; updated: number; skipped: number } | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [workflowState, setWorkflowState] = useState<string>('INITIAL');

  useEffect(() => {
    fetchConnection();
    fetchStats();
    fetchSettings();
    fetchHighlightRepos();
    fetchWorkflowState();

    // Listen for portfolio-reset event to refresh connection state
    const handleReset = () => {
      console.log('Portfolio reset detected, refreshing connection...');
      fetchConnection();
      fetchStats();
      fetchWorkflowState();
      setSyncSummary(null);
      setSyncError(null);
    };

    const handlePortfolioUpdate = () => {
      fetchStats();
      fetchWorkflowState();
      fetchHighlightRepos();
    };

    window.addEventListener('portfolio-reset', handleReset);
    window.addEventListener('portfolio-updated', handlePortfolioUpdate);
    return () => {
      window.removeEventListener('portfolio-reset', handleReset);
      window.removeEventListener('portfolio-updated', handlePortfolioUpdate);
    };
  }, []);

  const fetchStats = async () => {
    try {
      console.log('Fetching stats...');
      const response = await fetchWithTimeout(`/api/portfolio/stats?t=${Date.now()}`);
      const data = await response.json();
      console.log('Stats received:', data);
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchConnection = async () => {
    try {
      console.log('Fetching connection...');
      const response = await fetchWithTimeout(`/api/github/connect?t=${Date.now()}`);
      const data = await response.json();
      console.log('Connection received:', data);
      setConnection(data ?? null);
    } catch (error: any) {
      console.error('Failed to fetch connection:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await fetchWithTimeout(`/api/portfolio/settings?t=${Date.now()}`);
      const data = await response.json();
      if (data.settings) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchHighlightRepos = async () => {
    try {
      const response = await fetchWithTimeout(`/api/repositories?t=${Date.now()}`);
      const data = await response.json();
      const repos = data?.repositories ?? [];
      const filtered = repos.filter((r: any) => !r.isExcluded && r?.aiAnalysis?.employerHighlights);
      const sorted = filtered.sort((a: any, b: any) => {
        const aScore = (a.isFeatured ? 1 : 0) * 1000 + (a.stargazersCount ?? 0);
        const bScore = (b.isFeatured ? 1 : 0) * 1000 + (b.stargazersCount ?? 0);
        return bScore - aScore;
      });
      setHighlightRepos(sorted.slice(0, 3));
    } catch (error) {
      console.error('Error fetching highlight repos:', error);
    }
  };

  const fetchWorkflowState = async () => {
    try {
      const response = await fetchWithTimeout(`/api/workflow/status?t=${Date.now()}`);
      const data = await response.json();
      if (data?.currentState) {
        setWorkflowState(data.currentState);
      }
    } catch (error) {
      console.error('Error fetching workflow state:', error);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchConnection(),
        fetchStats(),
        fetchSettings(),
        fetchHighlightRepos(),
        fetchWorkflowState()
      ]);
      // Short delay to ensure DB consistency before UI remounts
      await new Promise(resolve => setTimeout(resolve, 500));
      setDataVersion(prev => prev + 1);
    } catch (error) {
      console.error('Refresh error:', error);
      router.refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleOnboardingAction = (action: 'sync' | 'curate' | 'analyze' | 'view') => {
    if (action === 'sync') {
      handleSync();
    } else if (action === 'curate') {
      setActiveTab('curate');
    } else if (action === 'analyze') {
      setActiveTab('repositories');
      setTriggerAnalyze(true);
    } else if (action === 'view') {
      setPreviewMode(true);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetchWithTimeout('/api/github/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data?.error || 'Failed to connect GitHub');
        return;
      }

      toast.success('GitHub connected successfully!');
      setGithubToken('');
      
      // Auto-sync after connection
      handleSync();
    } catch (error: any) {
      toast.error('Failed to connect GitHub');
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    console.log('Starting sync...');
    
    const syncPromise = fetchWithTimeout(
      '/api/github/sync',
      { method: 'POST' },
      120000
    ).then(async (response) => {
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to sync repositories');
      }
      return data;
    });

    toast.promise(syncPromise, {
      loading: 'Syncing repositories from GitHub...',
      success: (data) => {
        console.log('Sync successful:', data);
        const { createdCount, updatedCount, skippedCount } = data;
        setSyncSummary({ created: createdCount, updated: updatedCount, skipped: skippedCount });
        setSyncError(null);
        refreshData();
        let msg = `Sync complete!`;
        if (createdCount > 0) msg += ` ${createdCount} new.`;
        if (updatedCount > 0) msg += ` ${updatedCount} updated.`;
        if (skippedCount > 0 && createdCount === 0 && updatedCount === 0) msg = "Repositories are already up to date.";
        return msg;
      },
      error: (err) => {
        console.error('Sync failed:', err);
        setSyncSummary(null);
        const isAbort =
          err?.name === 'AbortError' ||
          (typeof err?.message === 'string' && err.message.includes('aborted'));
        const message = isAbort
          ? 'Sync timed out. Try again or check GitHub rate limits.'
          : err.message || 'Failed to sync repositories';
        setSyncError(message);
        return message;
      },
      finally: () => {
        setSyncing(false);
        setLoading(false);
      }
    });
  };


  const handleCopyUrl = () => {
    if (!connection?.githubUsername) return;
    const portfolioUrl = `${window.location.origin}/portfolio/${connection.githubUsername}`;
    navigator.clipboard.writeText(portfolioUrl);
    setCopied(true);
    toast.success('Portfolio URL copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const checklistStats = stats ? {
    ...stats,
    lastSyncedAt: connection?.lastSyncedAt
  } : null;

  const curationState = (() => {
    if (!stats?.hasRepos) return { label: 'No repos', tone: 'slate' };
    if (stats.excludedCount === 0) return { label: 'Not started', tone: 'orange' };
    if (stats.projectCount === 0) return { label: 'Filtering', tone: 'blue' };
    return { label: 'Organizing', tone: 'green' };
  })();

  const repoCount = stats?.repoCount ?? 0;
  const excludedCount = stats?.excludedCount ?? 0;
  const analyzedCount = stats?.analyzedCount ?? 0;
  const projectCount = stats?.projectCount ?? 0;
  const includedCount = Math.max(repoCount - excludedCount, 0);
  const remainingAnalysis = Math.max(includedCount - analyzedCount, 0);

  const toneMap: Record<string, string> = {
    slate: 'border-slate-600 text-slate-200 bg-slate-800/70',
    orange: 'border-amber-500/50 text-amber-300 bg-amber-500/10',
    blue: 'border-cyan-500/50 text-cyan-300 bg-cyan-500/10',
    green: 'border-green-500/50 text-green-300 bg-green-500/10',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800">
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-lg border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Github className="w-8 h-8 text-blue-500" />
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                DevShowcase
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] uppercase tracking-tight",
                  toneMap[curationState.tone] ?? toneMap.slate
                )}
              >
                Curation: {curationState.label}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] uppercase tracking-tight",
                  connection?.connected
                    ? "border-green-500/50 text-green-300 bg-green-500/10"
                    : "border-red-500/50 text-red-300 bg-red-500/10"
                )}
              >
                {connection?.connected ? "Connected to GitHub" : "Not connected"}
              </Badge>
              {connection?.connected && connection?.githubUsername && (
                <Link href={`/portfolio/${connection.githubUsername}`} target="_blank">
                  <Button variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800">
                    <Eye className="w-4 h-4 mr-2" />
                    View Portfolio
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12 relative">
        {refreshing && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl shadow-2xl flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-full border-4 border-blue-600/30 border-t-blue-600 animate-spin" />
              <div className="text-center">
                <p className="text-white font-bold">Syncing Data...</p>
                <p className="text-slate-400 text-xs mt-1">Fetching latest from GitHub & AI</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold text-white">Technical Command Center</h1>
              <Badge variant="outline" className="bg-blue-600/10 text-blue-400 border-blue-600/20 text-[10px] uppercase tracking-tighter">V2.0 Workflows</Badge>
            </div>
            <p className="text-slate-400">Transform your raw code into a professional narrative for prospective employers.</p>
          </div>
          
          <div className="flex flex-col items-end gap-3">
            {connection?.connected && (
              <div className="flex items-center gap-3 bg-slate-800/50 border border-slate-700 p-1.5 pr-4 rounded-full backdrop-blur-sm shadow-xl">
                <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">
                  <Github className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white leading-none">@{connection.githubUsername}</span>
                  <span className="text-[10px] text-slate-500 leading-none mt-1">
                    {connection.lastSyncedAt ? `Synced ${formatDistanceToNow(new Date(connection.lastSyncedAt))} ago` : 'Never synced'}
                  </span>
                </div>
                <div className="w-px h-6 bg-slate-700 mx-1" />
                <button 
                  onClick={handleSync} 
                  disabled={syncing}
                  className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-all flex items-center gap-1.5 disabled:opacity-50 group"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500", syncing && "animate-spin")} />
                  {syncing ? 'Syncing...' : 'Sync'}
                </button>
              </div>
            )}
            
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-lg">
              <button 
                onClick={() => setPreviewMode(false)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                  !previewMode ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                )}
              >
                Workflow Hub
              </button>
              <button 
                onClick={() => setPreviewMode(true)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5",
                  previewMode ? "bg-cyan-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                )}
              >
                <UserCircle className="w-3 h-3" />
                Employer Preview
              </button>
            </div>
          </div>
        </div>

        {!connection?.connected ? (
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 p-8 max-w-2xl">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-blue-600/10 flex items-center justify-center flex-shrink-0">
                <Github className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-white mb-2">Connect GitHub Account</h2>
                <p className="text-slate-400">
                  Connect your GitHub account to sync repositories and generate AI insights.
                  You'll need a personal access token with repo scope.
                </p>
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo,user&description=DevShowcase"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-400 mt-2 text-sm"
                >
                  Create token on GitHub
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <form onSubmit={handleConnect} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token" className="text-slate-200">
                  GitHub Personal Access Token
                </Label>
                <Input
                  id="token"
                  type="password"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e?.target?.value ?? '')}
                  placeholder="ghp_xxxxxxxxxxxxx"
                  className="bg-slate-900/50 border-slate-600 text-white"
                  required
                />
              </div>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={loading}
              >
                {loading ? 'Connecting...' : 'Connect GitHub'}
              </Button>
            </form>
          </Card>
        ) : previewMode ? (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-900/80 border border-slate-800 p-8 rounded-3xl shadow-2xl backdrop-blur-md">
              <div className="flex flex-col md:flex-row gap-8 items-center mb-12 border-b border-slate-800 pb-12">
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-600 to-blue-400 p-1 flex-shrink-0">
                  <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
                    <UserCircle className="w-12 h-12 text-slate-400" />
                  </div>
                </div>
                <div className="text-center md:text-left flex-1">
                  <h2 className="text-4xl font-black text-white mb-2 italic">
                    {settings?.displayName || `@${connection.githubUsername}`}
                  </h2>
                  <p className="text-slate-400 max-w-2xl leading-relaxed">
                    {settings?.bio || "Senior Software Engineer specializing in high-performance distributed systems and AI-driven applications."}
                  </p>
                  {settings?.location && (
                    <p className="text-slate-500 text-sm mt-2 flex items-center justify-center md:justify-start gap-1">
                      <Briefcase className="w-3 h-3" />
                      {settings.location}
                    </p>
                  )}
                  <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-6">
                    <Badge variant="outline" className="bg-slate-800/50 border-slate-700 text-slate-300 py-1.5 px-4 font-mono">{stats.repoCount - stats.excludedCount} Repositories</Badge>
                    <Badge variant="outline" className="bg-slate-800/50 border-slate-700 text-slate-300 py-1.5 px-4 font-mono">{stats.projectCount} Grouped Projects</Badge>
                    <Badge variant="outline" className="bg-slate-800/50 border-slate-700 text-slate-300 py-1.5 px-4 font-mono">{stats.analyzedCount} Deep Analyses</Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-12">
                {highlightRepos.length > 0 && (
                  <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6">
                    <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-blue-500" />
                        <h3 className="text-lg font-semibold text-white">Employer Highlights</h3>
                      </div>
                      <p className="text-sm text-slate-400">Open these first — strongest evidence</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-4">
                      {highlightRepos.map((repo: any, idx: number) => (
                        <div
                          key={repo?.id ?? idx}
                          className="p-4 rounded-xl bg-slate-900/60 border border-slate-700 h-full flex flex-col gap-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Repo</p>
                              <p className="text-base font-semibold text-white line-clamp-1">{repo?.name}</p>
                            </div>
                            <div className="flex items-center gap-1 text-amber-300 text-sm">
                              <Sparkles className="w-4 h-4" />
                              <span>{repo?.stargazersCount ?? 0}</span>
                            </div>
                          </div>
                          {repo?.aiAnalysis?.employerHighlights && (
                            <p className="text-sm text-slate-300 line-clamp-3 leading-relaxed">
                              {repo.aiAnalysis.employerHighlights}
                            </p>
                          )}
                          {repo?.aiAnalysis?.skillsDemonstrated?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {repo.aiAnalysis.skillsDemonstrated.slice(0, 3).map((skill: string, skillIdx: number) => (
                                <span
                                  key={skillIdx}
                                  className="px-2 py-1 rounded-md bg-blue-600/10 border border-blue-600/20 text-xs text-blue-200"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          )}
                          {repo?.htmlUrl && (
                            <a
                              href={repo.htmlUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-cyan-300 hover:text-white underline-offset-4 hover:underline"
                            >
                              View on GitHub
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                    <Sparkles className="w-6 h-6 text-blue-500" />
                    Featured Work
                  </h3>
                  <RepositoryList 
                    key={`preview-repos-${dataVersion}`}
                    previewOnly={true}
                    lastSyncedAt={connection?.lastSyncedAt}
                  />
                </div>
              </div>
            </div>
            
            <div className="text-center">
              <Button 
                variant="outline" 
                onClick={() => setPreviewMode(false)}
                className="border-slate-700 text-slate-400 hover:text-white"
              >
                Back to Workflow Hub
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {syncError && (
              <div className="bg-red-500/10 border border-red-500/40 p-4 rounded-xl flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
                  <X className="w-5 h-5 text-red-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-red-200 font-semibold text-sm">Sync failed</h4>
                    <Button size="sm" variant="ghost" onClick={() => setSyncError(null)} className="text-red-200 hover:bg-red-500/10">
                      Dismiss
                    </Button>
                  </div>
                  <p className="text-red-200 text-sm">{syncError}</p>
                  <Button size="sm" onClick={handleSync} disabled={syncing} className="mt-3 bg-red-600 hover:bg-red-500 text-xs h-8">
                    Retry Sync
                  </Button>
                </div>
              </div>
            )}

            {/* Sync Summary Banner - HIGHEST PROMINENCE */}
            {syncSummary && (syncSummary.created > 0 || syncSummary.updated > 0) && (
              <div className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-500/40 p-5 rounded-2xl flex items-start gap-5 animate-in slide-in-from-top-8 duration-700">
                <div className="w-12 h-12 rounded-2xl bg-green-500/20 flex items-center justify-center flex-shrink-0 border border-green-500/30">
                  <Check className="w-6 h-6 text-green-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-green-100 text-lg">Sync Successful</h4>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSyncSummary(null)}
                      className="text-green-400 hover:bg-green-500/20"
                    >
                      Dismiss
                    </Button>
                  </div>
                  <p className="text-green-300/90 font-medium">
                    {syncSummary.created > 0 && `Discovered ${syncSummary.created} new repositories! `}
                    {syncSummary.updated > 0 && `Synchronized metadata for ${syncSummary.updated} existing items.`}
                  </p>
                  <div className="flex gap-3 mt-4">
                    <Button 
                      size="sm" 
                      onClick={() => setActiveTab('curate')}
                      className="bg-green-600 hover:bg-green-500 text-white font-bold px-6 shadow-lg shadow-green-900/20"
                    >
                      Step 2: Start Curation
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Next Recommended Step Banner */}
            {stats && !syncSummary && (
              <div className="animate-in fade-in duration-1000">
                {!stats.hasRepos ? (
                  <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <RefreshCw className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">Step 1: Get Started</h4>
                        <p className="text-xs text-slate-400">Sync your repositories to begin building your portfolio.</p>
                      </div>
                    </div>
                    <Button onClick={handleSync} disabled={syncing} className="bg-blue-600 hover:bg-blue-700 text-xs h-8">
                      Sync Now
                    </Button>
                  </div>
                ) : excludedCount === 0 || includedCount === 0 ? (
                  <div className="bg-blue-600/10 border border-blue-600/30 p-4 rounded-xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center">
                        <EyeOff className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">Step 2: Curate Your Work</h4>
                        <p className="text-xs text-slate-400">You have {repoCount} repos. Hide the junk to show your best work.</p>
                      </div>
                    </div>
                    <Button onClick={() => setActiveTab('curate')} className="bg-blue-600 hover:bg-blue-700 text-xs h-8">
                      Select & Filter
                    </Button>
                  </div>
                ) : remainingAnalysis > 0 ? (
                  <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">Step 3: Deep AI Analysis</h4>
                        <p className="text-xs text-slate-400">Analyze all included repos to unlock AI grouping suggestions.</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleOnboardingAction('analyze')}
                      disabled={isAnalyzing}
                      className="bg-amber-600 hover:bg-amber-700 text-xs h-8"
                    >
                      {isAnalyzing ? 'Analyzing...' : 'Start Analysis'}
                    </Button>
                  </div>
                ) : projectCount === 0 ? (
                  <div className="bg-cyan-500/10 border border-cyan-500/30 p-4 rounded-xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                        <FolderOpen className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">Step 4: AI Grouping</h4>
                        <p className="text-xs text-slate-400">Use Magic Auto-Curate to group related repos into projects.</p>
                      </div>
                    </div>
                    <Button onClick={() => setActiveTab('curate')} className="bg-cyan-600 hover:bg-cyan-700 text-xs h-8">
                      Smart Grouping
                    </Button>
                  </div>
                ) : (
                  <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Share2 className="w-5 h-5 text-green-400" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">Step 5: Share Portfolio</h4>
                        <p className="text-xs text-slate-400">Your professional showcase is ready. Share your URL with employers.</p>
                      </div>
                    </div>
                    <Button onClick={handleCopyUrl} className="bg-green-600 hover:bg-green-700 text-xs h-8">
                      Copy Public URL
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Workflow Status and Stepper */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <WorkflowStatusIndicator />
              <WorkflowStepper currentState={workflowState} />
            </div>

            {/* Portfolio Overview Stats */}
            {stats && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="bg-slate-800/40 border-slate-700/50 p-4 relative overflow-hidden group hover:border-blue-600/30 transition-all">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Total Work</p>
                    <div className="flex items-end gap-2 mt-1">
                      <span className="text-3xl font-bold text-white">{stats.repoCount}</span>
                      <span className="text-xs text-slate-400 mb-1">Repositories</span>
                    </div>
                  </Card>
                  <Card className="bg-slate-800/40 border-slate-700/50 p-4 relative overflow-hidden group hover:border-cyan-500/30 transition-all">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Visibility</p>
                    <div className="flex items-end gap-2 mt-1">
                      <span className="text-3xl font-bold text-blue-400">{stats.repoCount - stats.excludedCount}</span>
                      <span className="text-xs text-slate-400 mb-1">Selected</span>
                    </div>
                  </Card>
                  <Card className="bg-slate-800/40 border-slate-700/50 p-4 relative overflow-hidden group hover:border-green-500/30 transition-all">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Organization</p>
                    <div className="flex items-end gap-2 mt-1">
                      <span className="text-3xl font-bold text-cyan-400">{stats.projectCount}</span>
                      <span className="text-xs text-slate-400 mb-1">Groups</span>
                    </div>
                  </Card>
                  <Card className="bg-slate-800/40 border-slate-700/50 p-4 relative overflow-hidden group hover:border-amber-500/30 transition-all">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Total Impact</p>
                    <div className="flex items-end gap-2 mt-1">
                      <span className="text-3xl font-bold text-amber-400">{stats.totalStars}</span>
                      <span className="text-xs text-slate-400 mb-1">Stars</span>
                    </div>
                  </Card>
                </div>

                {/* Technical Impact Summary - NEW */}
                {stats.topLanguages?.length > 0 && (
                  <Card className="bg-slate-900/60 border-slate-800 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center">
                        <Code2 className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white">Technical Language Impact</h3>
                        <p className="text-xs text-slate-500">Aggregated breakdown across all visible repositories</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {stats.topLanguages.map((lang: any) => (
                        <div key={lang.name} className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-300 font-medium">{lang.name}</span>
                            <span className="text-slate-500">{Math.round((lang.bytes / stats.topLanguages.reduce((acc: number, l: any) => acc + l.bytes, 0)) * 100)}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-600 rounded-full"
                              style={{ width: `${(lang.bytes / stats.topLanguages[0].bytes) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Readiness Card */}
                  <Card className="bg-slate-900/40 border-slate-800 p-6 flex flex-col items-center justify-center text-center">
                    <div className="relative w-40 h-42 flex items-center justify-center mb-4">
                      <svg className="w-full h-full -rotate-90 scale-110">
                        <circle
                          cx="64"
                          cy="64"
                          r="58"
                          stroke="currentColor"
                          strokeWidth="6"
                          fill="transparent"
                          className="text-slate-800"
                        />
                        <circle
                          cx="64"
                          cy="64"
                          r="58"
                          stroke="currentColor"
                          strokeWidth="6"
                          fill="transparent"
                          strokeDasharray={364.4}
                          strokeDashoffset={364.4 * (1 - (
                            (stats.hasRepos ? 0.2 : 0) + 
                            (stats.excludedCount > 0 ? 0.2 : 0) + 
                            (stats.projectCount > 0 ? 0.3 : 0) + 
                            (stats.isAnalyzed ? 0.3 : 0)
                          ))}
                          className="text-blue-500 transition-all duration-1000 ease-in-out"
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-black text-white leading-none">
                          {Math.round((
                            (stats.hasRepos ? 20 : 0) + 
                            (stats.excludedCount > 0 ? 20 : 0) + 
                            (stats.projectCount > 0 ? 30 : 0) + 
                            (stats.isAnalyzed ? 30 : 0)
                          ))}%
                        </span>
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Ready</span>
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">Portfolio Readiness</h3>
                    <div className="flex flex-wrap justify-center gap-2 mt-2">
                      {!stats.hasRepos && <Badge variant="outline" className="text-[10px] text-red-400 border-red-900/50 bg-red-950/20">Sync Required</Badge>}
                      {stats.hasRepos && stats.excludedCount === 0 && <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-900/50 bg-amber-950/20">Needs Curation</Badge>}
                      {stats.hasRepos && stats.projectCount === 0 && <Badge variant="outline" className="text-[10px] text-cyan-400 border-cyan-900/50 bg-cyan-950/20">Needs Grouping</Badge>}
                      {stats.repoCount - stats.excludedCount > stats.analyzedCount && <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-900/50 bg-blue-950/20">AI Needed</Badge>}
                    </div>
                  </Card>

                  {/* Portfolio Roadmap - Spans 2 columns */}
                  <div className="lg:col-span-2">
                    <PortfolioChecklist 
                      key={`checklist-${dataVersion}`}
                      stats={checklistStats} 
                      loading={!stats || refreshing} 
                      onAction={handleOnboardingAction} 
                      isSyncing={syncing}
                      isAnalyzing={isAnalyzing}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Portfolio URL Card - Compact */}
            <Card className="bg-gradient-to-br from-slate-800/30 to-slate-800/30 backdrop-blur-sm border-slate-800 p-4">
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                    <Briefcase className="w-5 h-5 text-blue-300" />
                  </div>
                  <div className="truncate">
                    <h3 className="font-semibold text-white text-sm">Public Portfolio Live</h3>
                    <code className="text-blue-300 text-xs truncate block mt-0.5">
                      {typeof window !== 'undefined' ? `${window.location.origin}/portfolio/${connection?.githubUsername}` : ''}
                    </code>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleCopyUrl} className="border-slate-700 text-slate-300 h-8">
                    <Copy className="w-3 h-3 mr-2" /> Copy
                  </Button>
                  <Link href={`/portfolio/${connection?.githubUsername}`} target="_blank">
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-8">
                      <Eye className="w-3 h-3 mr-2" /> Preview
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="bg-slate-800/50 border border-slate-700">
                <TabsTrigger value="repositories" className="data-[state=active]:bg-slate-700">
                  <LayoutGrid className="w-4 h-4 mr-2" />
                  All Repositories
                  {stats && (
                    <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-200">
                      {Math.max((stats.repoCount - stats.excludedCount) - stats.analyzedCount, 0)} not analyzed
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="curate" className="data-[state=active]:bg-slate-700">
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Select & Organize
                  {stats && stats.excludedCount > 0 && (
                    <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-blue-700/60 text-blue-50">
                      {stats.excludedCount} hidden
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="dna" className="data-[state=active]:bg-slate-700">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Engineering DNA
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="repositories" className="mt-6">
                {refreshing ? (
                  <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 p-12 flex flex-col items-center justify-center gap-4">
                    <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                    <p className="text-slate-400 font-medium italic">Refreshing repositories...</p>
                  </Card>
                ) : (
                  <RepositoryList 
                    key={`repos-${dataVersion}`}
                    autoTrigger={triggerAnalyze} 
                    onAutoTriggerHandled={() => setTriggerAnalyze(false)}
                    onAnalysisStart={() => setIsAnalyzing(true)}
                    onAnalysisEnd={() => {
                      setIsAnalyzing(false);
                      refreshData();
                    }}
                    lastSyncedAt={connection?.lastSyncedAt}
                  />
                )}
              </TabsContent>
              
              <TabsContent value="curate" className="mt-6">
                {refreshing ? (
                  <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 p-12 flex flex-col items-center justify-center gap-4">
                    <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                    <p className="text-slate-400 font-medium italic">Refreshing curation data...</p>
                  </Card>
                ) : (
                  <PortfolioCuration key={`curate-${dataVersion}`} />
                )}
              </TabsContent>

              <TabsContent value="dna" className="mt-6">
                <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 p-6">
                  {connection?.githubUsername ? (
                    <EngineeringDNA username={connection.githubUsername} />
                  ) : (
                    <div className="text-center py-12 text-slate-400">
                      Please connect your GitHub account to view your Engineering DNA.
                    </div>
                  )}
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Sparkles,
  Star,
  GitFork,
  Clock,
  Code2,
  ExternalLink,
  History,
  XCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Trash2,
  Check,
  FolderPlus,
  FolderOpen,
  ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AIAnalysis {
  complexityScore?: number;
  codeQualityScore?: number;
  projectType?: string;
  summary?: string;
  skillsDemonstrated: string[];
  citations?: Array<{
    claim: string;
    filePath: string;
    lineNumber: number;
    codeSnippet: string;
  }>;
}

interface Repository {
  id: string;
  name: string;
  description?: string;
  htmlUrl: string;
  language?: string;
  stargazersCount: number;
  forksCount: number;
  isPrivate: boolean;
  isFeatured: boolean;
  isExcluded: boolean;
  lastAnalyzedAt?: string;
  createdAt: string;
  updatedAt: string;
  aiAnalysis?: AIAnalysis;
  projectId?: string | null;
}

interface Project {
  id: string;
  name: string;
  description?: string | null;
  isVisible: boolean;
}

interface RepositoryListProps {
  autoTrigger?: boolean;
  onAutoTriggerHandled?: () => void;
  onAnalysisStart?: () => void;
  onAnalysisEnd?: () => void;
  previewOnly?: boolean;
  lastSyncedAt?: string | Date;
}

export default function RepositoryList({ 
  autoTrigger, 
  onAutoTriggerHandled,
  onAnalysisStart,
  onAnalysisEnd,
  previewOnly = false,
  lastSyncedAt
}: RepositoryListProps) {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [repoStatus, setRepoStatus] = useState<Record<string, 'pending' | 'running' | 'completed' | 'failed'>>({});
  const [failedRepos, setFailedRepos] = useState<Set<string>>(new Set());

  const [autoStatus, setAutoStatus] = useState<string | null>(null);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  useEffect(() => {
    console.log('RepositoryList mounted');
    fetchRepositories();
    fetchProjects();
  }, []);

  useEffect(() => {
    console.log('AutoTrigger check:', { autoTrigger, loading, repoCount: repositories.length, hasBulkProgress: !!bulkProgress });
    
    if (autoTrigger) {
      if (loading) {
        setAutoStatus('Waiting for repositories to load...');
      } else if (repositories.length === 0) {
        setAutoStatus('No repositories found to analyze.');
        // Don't clear trigger yet, let user see message? Or clear it?
      } else if (bulkProgress) {
        setAutoStatus('Analysis in progress...');
      } else {
        setAutoStatus('Starting analysis...');
        console.log('Auto-triggering bulk analysis...');
        
        const unanalyzedCount = repositories.filter(r => !r.aiAnalysis).length;
        if (unanalyzedCount > 0) {
          handleBulkAnalyze(true);
        } else {
          toast.info('All repositories are already analyzed!');
          setAutoStatus('All repositories are already analyzed.');
          setTimeout(() => setAutoStatus(null), 3000);
        }
        onAutoTriggerHandled?.();
      }
    } else {
      if (!bulkProgress) setAutoStatus(null);
    }
  }, [autoTrigger, loading, repositories.length, bulkProgress]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      setProjects(data?.projects ?? []);
    } catch (error) {
      console.error('Fetch projects error:', error);
    }
  };

  const fetchRepositories = async () => {
    try {
      console.log('Fetching repositories...');
      const response = await fetch(`/api/repositories?t=${Date.now()}`);
      const data = await response.json();
      console.log('Repositories fetched:', data?.repositories?.length);
      
      let filtered = data?.repositories ?? [];
      if (previewOnly) {
        // In preview mode, only show non-excluded repos
        filtered = filtered.filter((r: Repository) => !r.isExcluded);
      }
      
      setRepositories(filtered);
    } catch (error: any) {
      console.error('Fetch error:', error);
      toast.error('Failed to fetch repositories');
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async (repoId: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/analyze/repository', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repositoryId: repoId }),
      });

      if (!response?.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let partialRead = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        partialRead += decoder.decode(value ?? new Uint8Array(), { stream: true });
        let lines = partialRead.split('\n');
        partialRead = lines.pop() ?? '';

        for (const line of lines ?? []) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed?.status === 'completed') return true;
              if (parsed?.status === 'error') {
                throw new Error(parsed?.message || 'Analysis failed');
              }
            } catch (e: any) {
              if (e.message !== 'Unexpected end of JSON input' && !e.message.includes('Analysis failed')) {
                throw e;
              }
              if (e.message.includes('Analysis failed')) {
                throw e;
              }
            }
          }
        }
      }
      return true;
    } catch (error: any) {
      console.error(`Analysis failed for ${repoId}:`, error);
      throw error;
    }
  };

  const handleAnalyze = async (repoId: string) => {
    setAnalyzing(repoId);
    try {
      await runAnalysis(repoId);
      toast.success('Analysis completed!');
      fetchRepositories();
    } catch (error: any) {
      toast.error(error.message || 'Failed to analyze repository');
    }
    setAnalyzing(null);
  };

  const handleAnalyzeClick = (repoId: string) => {
    handleAnalyze(repoId);
  };

  const handleBulkAnalyze = async (skipConfirm = false, repoIdsToAnalyze?: string[]) => {
    // Refresh repositories to respect the latest hide/show changes before analyzing
    let currentRepos = repositories;
    try {
      const res = await fetch(`/api/repositories?t=${Date.now()}`);
      const data = await res.json();
      let refreshed = data?.repositories ?? [];
      if (previewOnly) {
        refreshed = refreshed.filter((r: Repository) => !r.isExcluded);
      }
      setRepositories(refreshed);
      currentRepos = refreshed;
    } catch (err) {
      console.error('Refresh before bulk analyze failed:', err);
    }

    // Determine which repos to analyze
    let toAnalyze: Repository[];
    if (repoIdsToAnalyze) {
      toAnalyze = currentRepos.filter(r => repoIdsToAnalyze.includes(r.id) && !r.isExcluded);
    } else {
      toAnalyze = currentRepos.filter(r => !r.isExcluded && !r.aiAnalysis);
    }

    if (toAnalyze.length === 0) {
      const unanalyzedCount = repositories.filter(r => !r.aiAnalysis).length;
      if (unanalyzedCount > 0) {
        toast.info(`${unanalyzedCount} repositories are hidden. Go to "Curate Portfolio" to include them.`);
      } else {
        toast.info('All repositories are already analyzed!');
      }
      return;
    }

    if (!skipConfirm) {
      if (!confirm(`This will perform a deep AI analysis on ${toAnalyze.length} repositories. Continue?`)) return;
    }

    onAnalysisStart?.();
    setCancelled(false);
    setBulkProgress({ current: 0, total: toAnalyze.length });
    setFailedRepos(new Set());

    const initialStatus: Record<string, 'pending' | 'running' | 'completed' | 'failed'> = {};
    toAnalyze.forEach(r => { initialStatus[r.id] = 'pending'; });
    setRepoStatus(initialStatus);
    onAutoTriggerHandled?.(); // Clear trigger once started

    let completed = 0;
    let failed = 0;
    for (const repo of toAnalyze) {
      if (cancelled) {
        toast.info(`Analysis cancelled. ${completed}/${toAnalyze.length} completed.`);
        break;
      }

      // Skip if repository became excluded between refresh and execution
      if (repo.isExcluded) {
        continue;
      }

      setRepoStatus(prev => ({ ...prev, [repo.id]: 'running' }));
      setAnalyzing(repo.id);

      try {
        console.log(`Starting bulk analysis for: ${repo.name}`);
        await runAnalysis(repo.id);
        completed++;
        console.log(`Completed bulk analysis for: ${repo.name} (${completed}/${toAnalyze.length})`);
        setRepoStatus(prev => ({ ...prev, [repo.id]: 'completed' }));
      } catch (e) {
        console.error(`Failed to analyze ${repo.name}:`, e);
        failed++;
        setRepoStatus(prev => ({ ...prev, [repo.id]: 'failed' }));
        setFailedRepos(prev => new Set([...prev, repo.id]));
        // Continue with others even if one fails
      }

      setAnalyzing(null);
      // Update progress immediately after each attempt (success or fail)
      setBulkProgress({ current: completed + failed, total: toAnalyze.length });
    }

    if (!cancelled) {
      toast.success(`Bulk analysis completed! (${completed}/${toAnalyze.length} successful, ${failed} failed)`);
    }
    setBulkProgress(null);
    setAnalyzing(null);
    onAnalysisEnd?.();
    fetchRepositories();
  };

  const handleRetryFailed = () => {
    const failedIds = Array.from(failedRepos);
    if (failedIds.length === 0) {
      toast.info('No failed repositories to retry.');
      return;
    }
    handleBulkAnalyze(true, failedIds);
  };

  const handleCancelAnalysis = () => {
    if (confirm('Cancel the current analysis? Progress will be saved for completed repositories.')) {
      setCancelled(true);
    }
  };

  const toggleFeatured = async (repoId: string, currentValue: boolean) => {
    try {
      const response = await fetch('/api/repositories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repositoryId: repoId,
          updates: { isFeatured: !currentValue },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update repository');
      }

      toast.success(currentValue ? 'Removed from featured' : 'Added to featured');
      fetchRepositories();
    } catch (error: any) {
      console.error('Update error:', error);
      if (error.message) {
        toast.error(error.message);
      } else {
        toast.error('Failed to update repository');
      }
    }
  };

  if (loading) {
    return (
      <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 p-8">
        <p className="text-slate-400 text-center">Loading repositories...</p>
      </Card>
    );
  }

  const analyzedCount = repositories.filter(r => !r.isExcluded && r.aiAnalysis).length;
  const pendingCount = repositories.filter(r => !r.isExcluded && !r.aiAnalysis).length;
  const failedCount = failedRepos.size;
  const totalActive = analyzedCount + pendingCount;

  const handleSelectRepo = (repoId: string) => {
    const newSelected = new Set(selectedRepos);
    if (newSelected.has(repoId)) {
      newSelected.delete(repoId);
    } else {
      newSelected.add(repoId);
    }
    setSelectedRepos(newSelected);
    setSelectAll(newSelected.size === repositories.length);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRepos(new Set());
    } else {
      setSelectedRepos(new Set(repositories.map(r => r.id)));
    }
    setSelectAll(!selectAll);
  };

  const handleDeleteSelected = async () => {
    if (selectedRepos.size === 0) {
      toast.error('No repositories selected');
      return;
    }

    if (!confirm(`Delete ${selectedRepos.size} repository${selectedRepos.size !== 1 ? 'ies' : ''}? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch('/api/repositories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repositoryIds: Array.from(selectedRepos) }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message || 'Repositories deleted successfully');
        setSelectedRepos(new Set());
        setSelectAll(false);
        fetchRepositories();
      } else {
        toast.error(data.error || 'Failed to delete repositories');
      }
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error('Failed to delete repositories');
    }
  };

  const handleGroupSelected = async () => {
    if (selectedRepos.size === 0) {
      toast.error('No repositories selected');
      return;
    }

    const projectName = prompt('Enter a name for this project group:');
    if (!projectName || !projectName.trim()) {
      return;
    }

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName.trim(),
          description: '',
          repositoryIds: Array.from(selectedRepos),
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Project created successfully');
        setSelectedRepos(new Set());
        setSelectAll(false);
        fetchRepositories();
        fetchProjects();
      } else {
        toast.error(data.error || 'Failed to create project');
      }
    } catch (error: any) {
      console.error('Group error:', error);
      toast.error('Failed to create project');
    }
  };

  const handleMoveToProject = async (projectId: string | null) => {
    if (selectedRepos.size === 0) {
      toast.error('No repositories selected');
      return;
    }

    if (projectId === 'create-new') {
      setIsCreateProjectDialogOpen(true);
      return;
    }

    try {
      const repoIds = Array.from(selectedRepos);
      const toastId = toast.loading(`Moving ${repoIds.length} repository${repoIds.length !== 1 ? 'ies' : ''}...`);

      // Move each repo to the selected project
      for (const repoId of repoIds) {
        await fetch('/api/repositories', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repositoryId: repoId,
            updates: { projectId },
          }),
        });
      }

      toast.success(`Successfully moved ${repoIds.length} repository${repoIds.length !== 1 ? 'ies' : ''}`, { id: toastId });
      setSelectedRepos(new Set());
      setSelectAll(false);
      setSelectedProjectId(null);
      fetchRepositories();
      fetchProjects();
    } catch (error: any) {
      console.error('Move error:', error);
      toast.error('Failed to move repositories');
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      toast.error('Project name is required');
      return;
    }

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: '',
          repositoryIds: Array.from(selectedRepos),
        }),
      });

      const data = await response.json();

      if (response.ok && data.project) {
        toast.success('Project created successfully');
        setIsCreateProjectDialogOpen(false);
        setNewProjectName('');
        setSelectedRepos(new Set());
        setSelectAll(false);
        fetchRepositories();
        fetchProjects();
      } else {
        toast.error(data.error || 'Failed to create project');
      }
    } catch (error: any) {
      console.error('Create project error:', error);
      toast.error('Failed to create project');
    }
  };

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return null;
    const project = projects.find(p => p.id === projectId);
    return project?.name || null;
  };

  if (repositories?.length === 0) {
    return (
      <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 p-8">
        <p className="text-slate-400 text-center">No repositories found. Click "Sync Now" to fetch your repositories.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {autoStatus && (
        <Card className="bg-purple-500/10 border-purple-500/50 p-4 mb-4 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
          <p className="text-purple-200 font-medium">{autoStatus}</p>
        </Card>
      )}

      {bulkProgress && (
        <Card className="bg-slate-800/50 border-slate-700 p-4 mb-4 animate-in fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-white">Analyzing Repositories...</span>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400">{bulkProgress.current} / {bulkProgress.total}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelAnalysis}
                className="border-red-500/50 text-red-300 hover:bg-red-500/10 h-7 px-3"
              >
                <XCircle className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 transition-all duration-500"
              style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
            />
          </div>
          {failedRepos.size > 0 && (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-red-400">{failedRepos.size} failed</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetryFailed}
                className="border-orange-500/50 text-orange-300 hover:bg-orange-500/10 h-7 px-3"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry Failed
              </Button>
            </div>
          )}
        </Card>
      )}

      <Card className="bg-slate-800/40 border-slate-700 p-4">
        <div className="flex flex-wrap gap-3 items-center text-sm text-slate-200">
          <span className="font-semibold">Analysis status:</span>
          <Badge variant="outline" className="border-green-500/50 text-green-300 bg-green-500/5">
            Completed {analyzedCount}
          </Badge>
          <Badge variant="outline" className="border-amber-500/50 text-amber-300 bg-amber-500/5">
            Pending {pendingCount}
          </Badge>
          <Badge variant="outline" className="border-red-500/50 text-red-300 bg-red-500/5">
            Failed {failedCount}
          </Badge>
          <Badge variant="outline" className="border-blue-500/50 text-blue-300 bg-blue-500/5">
            Total {totalActive}
          </Badge>
          {failedCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRetryFailed}
              className="ml-auto border-orange-500/50 text-orange-300 hover:bg-orange-500/10 h-8"
            >
              Retry failed
            </Button>
          )}
        </div>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white">Your Repositories ({repositories?.length ?? 0})</h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={selectAll}
              onChange={handleSelectAll}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
            />
            Select All
          </label>
          {selectedRepos.size > 0 && (
            <>
              <span className="text-sm text-slate-400">({selectedRepos.size} selected)</span>
              <Select value={selectedProjectId ?? ''} onValueChange={(value) => setSelectedProjectId(value === 'none' ? null : value)}>
                <SelectTrigger className="w-[180px] h-8 border-blue-600/50 text-blue-300 hover:bg-blue-600/10">
                  <SelectValue placeholder="Move to group..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-3 w-3" />
                      No Group
                    </div>
                  </SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-3 w-3" />
                        {project.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProjectId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleMoveToProject(selectedProjectId)}
                  className="border-blue-600/50 text-blue-300 hover:bg-blue-600/10 h-8"
                >
                  <Check className="h-3 w-3 mr-1" />
                  Move
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsCreateProjectDialogOpen(true)}
                className="border-blue-600/50 text-blue-300 hover:bg-blue-600/10 h-8"
              >
                <FolderPlus className="h-3 w-3 mr-1" />
                Create New Group
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDeleteSelected}
                className="border-red-600/50 text-red-300 hover:bg-red-600/10 h-8"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>
      
      <div className="grid gap-4">
        {repositories?.map((repo) => {
          // A repo is "Recently Updated" if its database updatedAt is AFTER the last session sync started
          // OR if it was updated in the last 5 minutes (for immediate feedback)
          const syncThreshold = lastSyncedAt ? new Date(lastSyncedAt).getTime() - 2000 : Date.now() - 5 * 60 * 1000;
          const isRecentlyUpdated = new Date(repo.updatedAt).getTime() > syncThreshold;
          
          return (
            <Card
              key={repo?.id}
              className={cn(
                "bg-slate-800/50 backdrop-blur-sm border-slate-700 p-6 hover:border-purple-500/50 transition-all relative overflow-hidden",
                selectedRepos.has(repo.id) && "border-blue-600/50 ring-1 ring-blue-600/30",
                isRecentlyUpdated && "border-green-500/50 ring-1 ring-green-500/20"
              )}
            >
              {isRecentlyUpdated && (
                <div className="absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 bg-green-500/10 rotate-45 pointer-events-none" />
              )}
              <div className="flex items-start justify-between gap-4 relative z-10">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={selectedRepos.has(repo.id)}
                    onChange={() => handleSelectRepo(repo.id)}
                    className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-white truncate">{repo?.name}</h3>
                    {repoStatus[repo.id] && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          repoStatus[repo.id] === 'running' && "border-blue-500/50 text-blue-300 bg-blue-500/5",
                          repoStatus[repo.id] === 'completed' && "border-green-500/50 text-green-300 bg-green-500/5",
                          repoStatus[repo.id] === 'failed' && "border-red-500/50 text-red-300 bg-red-500/5",
                          repoStatus[repo.id] === 'pending' && "border-slate-500/50 text-slate-400 bg-slate-500/5"
                        )}
                      >
                        {repoStatus[repo.id] === 'running' && <Loader2 className="h-2 w-2 mr-1 animate-spin" />}
                        {repoStatus[repo.id] === 'completed' && <CheckCircle2 className="h-2 w-2 mr-1" />}
                        {repoStatus[repo.id] === 'failed' && <XCircle className="h-2 w-2 mr-1" />}
                        {repoStatus[repo.id]?.toUpperCase()}
                      </Badge>
                    )}
                    {new Date(repo.createdAt).getTime() > Date.now() - 24 * 60 * 60 * 1000 && (
                      <Badge className="bg-green-500/20 text-green-300 border-green-500/50">
                        NEW
                      </Badge>
                    )}
                    {isRecentlyUpdated && (
                      <Badge variant="outline" className="border-green-500/50 text-green-400 bg-green-500/5 text-[10px] animate-pulse">
                        JUST SYNCED
                      </Badge>
                    )}
                    {repo?.isPrivate && (
                      <Badge variant="outline" className="border-slate-600 text-slate-400">
                        Private
                      </Badge>
                    )}
                    {repo?.isFeatured && (
                      <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/50">
                        Featured
                      </Badge>
                    )}
                    {repo.projectId && getProjectName(repo.projectId) && (
                      <Badge variant="outline" className="border-blue-500/50 text-blue-300 bg-blue-500/5">
                        <FolderOpen className="h-2 w-2 mr-1" />
                        {getProjectName(repo.projectId)}
                      </Badge>
                    )}
                  </div>
                  
                  {repo?.description && (
                    <p className="text-slate-400 text-sm mb-3">{repo.description}</p>
                  )}

                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    {repo?.language && (
                      <div className="flex items-center gap-1">
                        <Code2 className="w-4 h-4" />
                        <span>{repo.language}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4" />
                      <span>{repo?.stargazersCount ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <GitFork className="w-4 h-4" />
                      <span>{repo?.forksCount ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-1 ml-auto text-[10px] uppercase tracking-tighter opacity-50">
                      <History className="w-3 h-3" />
                      <span>Updated {new Date(repo.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {repo?.aiAnalysis && (
                    <div className="mt-4 p-4 rounded-lg bg-slate-900/50 border border-slate-700">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-semibold text-blue-300">AI Insights</span>
                      </div>
                      

                      {repo.aiAnalysis.projectType && (
                        <div className="mb-2">
                          <Badge variant="outline" className="border-blue-500/50 text-blue-300">
                            {repo.aiAnalysis.projectType}
                          </Badge>
                        </div>
                      )}

                      {repo.aiAnalysis.summary && (
                        <p className="text-sm text-slate-300 line-clamp-2">{repo.aiAnalysis.summary}</p>
                      )}

                      {repo?.aiAnalysis?.skillsDemonstrated?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {repo.aiAnalysis.skillsDemonstrated.slice(0, 5).map((skill, idx) => (
                            <Badge key={idx} variant="secondary" className="bg-slate-800 text-slate-300 text-xs">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {(() => {
                        const raw = (repo as any)?.aiAnalysis?.citations;
                        const citations = Array.isArray(raw)
                          ? raw
                          : typeof raw === 'string'
                            ? (() => {
                                try {
                                  const parsed = JSON.parse(raw);
                                  return Array.isArray(parsed) ? parsed : [];
                                } catch {
                                  return [];
                                }
                              })()
                            : [];

                        if (citations.length === 0) return null;

                        return (
                        <div className="mt-4 border-t border-slate-700 pt-3">
                          <p className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Evidence ({citations.length})
                          </p>
                          <div className="space-y-2">
                            {citations.slice(0, 3).map((citation, idx) => (
                              <div key={idx} className="bg-slate-900/50 rounded p-2 text-xs">
                                <p className="text-slate-300 mb-1">{citation.claim}</p>
                                <div className="flex items-center gap-2 text-slate-500">
                                  <span className="font-mono text-[10px] bg-slate-800 px-1 rounded">{citation.filePath}:{citation.lineNumber}</span>
                                </div>
                                <code className="block mt-1 text-slate-400 font-mono text-[10px] overflow-hidden text-ellipsis whitespace-nowrap">
                                  {citation.codeSnippet}
                                </code>
                              </div>
                            ))}
                            {citations.length > 3 && (
                              <p className="text-xs text-slate-500 text-center">
                                +{citations.length - 3} more citations
                              </p>
                            )}
                          </div>
                        </div>
                        );
                      })()}

                      {repo?.lastAnalyzedAt && (
                        <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Analyzed {new Date(repo.lastAnalyzedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

                {!previewOnly && (
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleAnalyze(repo?.id ?? '')}
                      disabled={analyzing === repo?.id}
                      className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600"
                    >
                      <Sparkles className="w-4 h-4 mr-1" />
                      {analyzing === repo?.id ? 'Analyzing...' : repo?.aiAnalysis ? 'Re-analyze' : 'Analyze'}
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleFeatured(repo?.id ?? '', repo?.isFeatured ?? false)}
                      className="border-slate-600 text-slate-200 hover:bg-slate-700"
                    >
                      <Star className={`w-4 h-4 mr-1 ${repo?.isFeatured ? 'fill-current' : ''}`} />
                      {repo?.isFeatured ? 'Unfeature' : 'Feature'}
                    </Button>

                    <a href={repo?.htmlUrl} target="_blank" rel="noopener noreferrer">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full text-slate-400 hover:text-slate-200"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </a>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Create Project Dialog */}
      <Dialog open={isCreateProjectDialogOpen} onOpenChange={setIsCreateProjectDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Create New Group</DialogTitle>
            <DialogDescription className="text-slate-400">
              Create a new project group to organize your selected repositories.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name" className="text-slate-300">Group Name</Label>
              <Input
                id="project-name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g., Web Applications"
                className="bg-slate-900 border-slate-700 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateProjectDialogOpen(false);
                setNewProjectName('');
              }}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Create Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

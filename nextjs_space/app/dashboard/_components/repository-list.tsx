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
  History
} from 'lucide-react';
import { toast } from 'sonner';

interface AIAnalysis {
  complexityScore?: number;
  codeQualityScore?: number;
  projectType?: string;
  summary?: string;
  skillsDemonstrated: string[];
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

  const [autoStatus, setAutoStatus] = useState<string | null>(null);

  useEffect(() => {
    console.log('RepositoryList mounted');
    fetchRepositories();
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

  const handleBulkAnalyze = async (skipConfirm = false) => {
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

    // Only analyze repositories that are NOT excluded and NOT already analyzed
    const toAnalyze = currentRepos.filter(r => !r.isExcluded && !r.aiAnalysis);
    
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
    setBulkProgress({ current: 0, total: toAnalyze.length });
    onAutoTriggerHandled?.(); // Clear trigger once started
    
    let completed = 0;
    for (const repo of toAnalyze) {
      // Skip if repository became excluded between refresh and execution
      if (repo.isExcluded) {
        continue;
      }
      try {
        console.log(`Starting bulk analysis for: ${repo.name}`);
        await runAnalysis(repo.id);
        completed++;
        console.log(`Completed bulk analysis for: ${repo.name} (${completed}/${toAnalyze.length})`);
      } catch (e) {
        console.error(`Failed to analyze ${repo.name}:`, e);
        // Continue with others even if one fails
      }
      // Update progress immediately after each attempt (success or fail)
      setBulkProgress({ current: completed, total: toAnalyze.length });
    }

    toast.success(`Bulk analysis completed! (${completed}/${toAnalyze.length} successful)`);
    setBulkProgress(null);
    onAnalysisEnd?.();
    fetchRepositories();
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
            <span className="text-sm text-slate-400">{bulkProgress.current} / {bulkProgress.total}</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-purple-500 transition-all duration-500"
              style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
            />
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Your Repositories ({repositories?.length ?? 0})</h2>
        {/* Bulk button removed to reduce confusion - rely on Checklist or Auto-trigger */}
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
                isRecentlyUpdated && "border-green-500/50 ring-1 ring-green-500/20"
              )}
            >
              {isRecentlyUpdated && (
                <div className="absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 bg-green-500/10 rotate-45 pointer-events-none" />
              )}
              <div className="flex items-start justify-between gap-4 relative z-10">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-white truncate">{repo?.name}</h3>
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
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span className="text-sm font-semibold text-purple-300">AI Insights</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        {repo.aiAnalysis.complexityScore !== undefined && (
                          <div>
                            <p className="text-xs text-slate-500">Complexity</p>
                            <p className="text-lg font-semibold text-white">{repo.aiAnalysis.complexityScore}/100</p>
                          </div>
                        )}
                        {repo.aiAnalysis.codeQualityScore !== undefined && (
                          <div>
                            <p className="text-xs text-slate-500">Code Quality</p>
                            <p className="text-lg font-semibold text-white">{repo.aiAnalysis.codeQualityScore}/100</p>
                          </div>
                        )}
                      </div>

                      {repo.aiAnalysis.projectType && (
                        <div className="mb-2">
                          <Badge variant="outline" className="border-cyan-500/50 text-cyan-300">
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

                      {repo?.lastAnalyzedAt && (
                        <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Analyzed {new Date(repo.lastAnalyzedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}
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
    </div>
  );
}

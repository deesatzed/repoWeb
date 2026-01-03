'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, 
  Star, 
  GitFork, 
  Clock,
  Code2,
  ExternalLink
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
  lastAnalyzedAt?: string;
  aiAnalysis?: AIAnalysis;
}

export default function RepositoryList() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    fetchRepositories();
  }, []);

  const fetchRepositories = async () => {
    try {
      const response = await fetch('/api/repositories');
      const data = await response.json();
      setRepositories(data?.repositories ?? []);
    } catch (error: any) {
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
              if (parsed?.status === 'error') throw new Error(parsed?.message);
            } catch (e) { /* ignore */ }
          }
        }
      }
      return true;
    } catch (error) {
      console.error(`Analysis failed for ${repoId}:`, error);
      return false;
    }
  };

  const handleAnalyze = async (repoId: string) => {
    setAnalyzing(repoId);
    const success = await runAnalysis(repoId);
    if (success) {
      toast.success('Analysis completed!');
      fetchRepositories();
    } else {
      toast.error('Failed to analyze repository');
    }
    setAnalyzing(null);
  };

  const handleBulkAnalyze = async () => {
    const unanalyzed = repositories.filter(r => !r.aiAnalysis);
    if (unanalyzed.length === 0) {
      toast.info('All repositories are already analyzed!');
      return;
    }

    if (!confirm(`This will analyze ${unanalyzed.length} repositories. It may take a few minutes. Continue?`)) return;

    setBulkProgress({ current: 0, total: unanalyzed.length });
    
    let completed = 0;
    for (const repo of unanalyzed) {
      await runAnalysis(repo.id);
      completed++;
      setBulkProgress({ current: completed, total: unanalyzed.length });
    }

    toast.success('Bulk analysis completed!');
    setBulkProgress(null);
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
        throw new Error('Failed to update repository');
      }

      toast.success(currentValue ? 'Removed from featured' : 'Added to featured');
      fetchRepositories();
    } catch (error: any) {
      toast.error('Failed to update repository');
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
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Your Repositories ({repositories?.length ?? 0})</h2>
        {repositories.some(r => !r.aiAnalysis) && (
          <Button 
            onClick={handleBulkAnalyze}
            disabled={!!bulkProgress || loading}
            variant="outline"
            className="border-purple-500/50 text-purple-300 hover:bg-purple-500/10"
          >
            <Sparkles className={`w-4 h-4 mr-2 ${!!bulkProgress ? 'animate-spin' : ''}`} />
            {bulkProgress 
              ? `Analyzing ${bulkProgress.current}/${bulkProgress.total}...` 
              : `Bulk Analyze All (${repositories.filter(r => !r.aiAnalysis).length})`}
          </Button>
        )}
      </div>
      
      <div className="grid gap-4">
        {repositories?.map((repo) => (
          <Card 
            key={repo?.id} 
            className="bg-slate-800/50 backdrop-blur-sm border-slate-700 p-6 hover:border-purple-500/50 transition-all"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-white truncate">{repo?.name}</h3>
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
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

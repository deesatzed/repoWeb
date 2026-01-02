'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { 
  Github, 
  LogOut, 
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
  Briefcase
} from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RepositoryList from './repository-list';
import { PortfolioCuration } from './portfolio-curation';
import EngineeringDNA from '@/components/engineering-dna';

interface GitHubConnection {
  connected: boolean;
  githubUsername?: string;
  lastSyncedAt?: string;
}

export default function DashboardClient() {
  const { data: session } = useSession() || {};
  const router = useRouter();
  const [githubToken, setGithubToken] = useState('');
  const [connection, setConnection] = useState<GitHubConnection | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchConnection();
  }, []);

  const fetchConnection = async () => {
    try {
      const response = await fetch('/api/github/connect');
      const data = await response.json();
      setConnection(data ?? null);
    } catch (error: any) {
      console.error('Failed to fetch connection:', error);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/github/connect', {
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
      fetchConnection();
      
      // Auto-sync after connection
      handleSync();
    } catch (error: any) {
      toast.error('Failed to connect GitHub');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    
    try {
      const response = await fetch('/api/github/sync', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data?.error || 'Failed to sync repositories');
        return;
      }

      toast.success(`Synced ${data?.repoCount ?? 0} repositories!`);
      fetchConnection();
      
      // Refresh the page to show new repos
      router.refresh();
    } catch (error: any) {
      toast.error('Failed to sync repositories');
    } finally {
      setSyncing(false);
    }
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
  };

  const handleCopyUrl = () => {
    if (!connection?.githubUsername) return;
    const portfolioUrl = `${window.location.origin}/portfolio/${connection.githubUsername}`;
    navigator.clipboard.writeText(portfolioUrl);
    setCopied(true);
    toast.success('Portfolio URL copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-slate-900 to-cyan-900">
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-lg border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Github className="w-8 h-8 text-purple-400" />
              <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                DevShowcase
              </span>
            </Link>
            <div className="flex items-center gap-4">
              {connection?.connected && connection?.githubUsername && (
                <Link href={`/portfolio/${connection.githubUsername}`} target="_blank">
                  <Button variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800">
                    <Eye className="w-4 h-4 mr-2" />
                    View Portfolio
                  </Button>
                </Link>
              )}
              <Button 
                variant="ghost" 
                onClick={handleSignOut}
                className="text-slate-200 hover:text-white"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Repository Explorer</h1>
          <p className="text-slate-400">Manage your GitHub portfolio and AI insights</p>
        </div>

        {!connection?.connected ? (
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 p-8 max-w-2xl">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <Github className="w-6 h-6 text-purple-400" />
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
                  className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 mt-2 text-sm"
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
                className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600"
                disabled={loading}
              >
                {loading ? 'Connecting...' : 'Connect GitHub'}
              </Button>
            </form>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <Github className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">GitHub Connected</h3>
                    <p className="text-slate-400 text-sm">
                      @{connection.githubUsername} • Last synced: {connection?.lastSyncedAt ? new Date(connection.lastSyncedAt).toLocaleString() : 'Never'}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleSync}
                  disabled={syncing}
                  className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </Button>
              </div>
            </Card>

            {/* Portfolio URL Card */}
            <Card className="bg-gradient-to-br from-purple-900/50 to-cyan-900/50 backdrop-blur-sm border-purple-700/50 p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-6 h-6 text-purple-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-white">Your Public Portfolio</h3>
                    <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/30 rounded text-green-300 text-xs font-medium">
                      LIVE
                    </span>
                  </div>
                  <p className="text-slate-300 text-sm mb-4">
                    Share this URL on LinkedIn, your resume, or with potential employers. No authentication required for viewers.
                  </p>
                  
                  <div className="flex items-center gap-2 p-3 bg-slate-900/50 rounded-lg border border-slate-700 mb-4">
                    <code className="flex-1 text-purple-300 text-sm truncate">
                      {typeof window !== 'undefined' ? `${window.location.origin}/portfolio/${connection?.githubUsername}` : ''}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCopyUrl}
                      className="text-purple-300 hover:text-purple-200 hover:bg-purple-500/10"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="flex gap-3">
                    <Link href={`/portfolio/${connection?.githubUsername}`} target="_blank" className="flex-1">
                      <Button className="w-full bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600">
                        <Eye className="w-4 h-4 mr-2" />
                        Preview Portfolio
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      onClick={handleCopyUrl}
                      className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            <Tabs defaultValue="repositories" className="w-full">
              <TabsList className="bg-slate-800/50 border border-slate-700">
                <TabsTrigger value="repositories" className="data-[state=active]:bg-slate-700">
                  <LayoutGrid className="w-4 h-4 mr-2" />
                  All Repositories
                </TabsTrigger>
                <TabsTrigger value="curate" className="data-[state=active]:bg-slate-700">
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Curate Portfolio
                </TabsTrigger>
                <TabsTrigger value="dna" className="data-[state=active]:bg-slate-700">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Engineering DNA
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="repositories" className="mt-6">
                <RepositoryList />
              </TabsContent>
              
              <TabsContent value="curate" className="mt-6">
                <PortfolioCuration />
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

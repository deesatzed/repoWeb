'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, FolderOpen, Eye, EyeOff, Trash2, Sparkles, Filter, Check, X, Search, Pencil } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Repository {
  id: string;
  name: string;
  description: string | null;
  language: string | null;
  stargazersCount: number;
  isExcluded: boolean;
  projectId: string | null;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  isVisible: boolean;
  repositories: Repository[];
}

export function PortfolioCuration() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAutoCurating, setIsAutoCurating] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const handleAutoCurate = async () => {
    if (!confirm('This will use AI to automatically organize your portfolio by grouping related repos and hiding junk ones. Existing projects will be preserved. Continue?')) {
      return;
    }

    try {
      setIsAutoCurating(true);
      const toastId = toast.loading('AI is organizing your portfolio...');

      const res = await fetch('/api/curate/auto', {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to auto-curate');

      toast.success(`Done! Created ${data.results.projectsCreated} groups and hid ${data.results.excluded} junk repos.`, { id: toastId });
      loadData();
    } catch (error) {
      console.error('Auto-curate error:', error);
      toast.error('Failed to auto-curate portfolio');
    } finally {
      setIsAutoCurating(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('PortfolioCuration: Loading data...');
      const [reposRes, projectsRes] = await Promise.all([
        fetch(`/api/repositories?t=${Date.now()}`),
        fetch(`/api/projects?t=${Date.now()}`),
      ]);

      if (reposRes.ok) {
        const data = await reposRes.json();
        console.log('PortfolioCuration: Repositories loaded', data.repositories?.length);
        setRepositories(data.repositories || []);
      }

      if (projectsRes.ok) {
        const data = await projectsRes.json();
        console.log('PortfolioCuration: Projects loaded', data.projects?.length);
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load portfolio data');
    } finally {
      setLoading(false);
    }
  };

  const toggleRepoExclusion = async (repoId: string, currentExcluded: boolean) => {
    try {
      const res = await fetch('/api/repositories/toggle-exclude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repositoryId: repoId,
          isExcluded: !currentExcluded,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.details || data.error || 'Failed to update');
      }

      setRepositories(prev =>
        prev.map(repo =>
          repo.id === repoId ? { ...repo, isExcluded: !currentExcluded } : repo
        )
      );

      toast.success(!currentExcluded ? 'Repository hidden' : 'Repository visible');
    } catch (error) {
      console.error('Error toggling repository:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update repository');
    }
  };

  const createProject = async () => {
    if (!newProjectName.trim()) {
      toast.error('Project name is required');
      return;
    }

    if (selectedRepos.size === 0) {
      toast.error('Select at least one repository');
      return;
    }

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName,
          description: newProjectDescription,
          repositoryIds: Array.from(selectedRepos),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create project');
      }

      toast.success('Project created successfully');
      setNewProjectName('');
      setNewProjectDescription('');
      setSelectedRepos(new Set());
      setIsCreateDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create project');
    }
  };

  const deleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? Repositories will not be deleted.')) {
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete project');
      }

      toast.success('Project deleted');
      loadData();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete project');
    }
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setNewProjectName(project.name);
    setNewProjectDescription(project.description || '');
    setSelectedRepos(new Set(project.repositories.map(r => r.id)));
    setIsEditDialogOpen(true);
  };

  const updateProject = async () => {
    if (!editingProject) return;
    if (!newProjectName.trim()) {
      toast.error('Project name is required');
      return;
    }

    try {
      const res = await fetch(`/api/projects/${editingProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName,
          description: newProjectDescription,
          repositoryIds: Array.from(selectedRepos),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update project');
      }

      toast.success('Project updated successfully');
      setEditingProject(null);
      setIsEditDialogOpen(false);
      setNewProjectName('');
      setNewProjectDescription('');
      setSelectedRepos(new Set());
      loadData();
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update project');
    }
  };

  const analyzeProject = async (projectId: string) => {
    const toastId = toast.loading('Analyzing project with AI...');

    try {
      const res = await fetch('/api/analyze/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      if (!res.ok) throw new Error('Failed to start analysis');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            
            if (data.status === 'completed') {
              toast.success('Project analysis completed!', { id: toastId });
              loadData();
              return;
            } else if (data.status === 'error') {
              throw new Error(data.message);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error analyzing project:', error);
      toast.error('Failed to analyze project', { id: toastId });
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [filterLanguage, setFilterLanguage] = useState<string | null>(null);

  const languages = Array.from(new Set(repositories.map(r => r.language).filter(Boolean))) as string[];

  const filteredRepos = repositories.filter(repo => {
    const matchesSearch = repo.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (repo.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesLanguage = !filterLanguage || repo.language === filterLanguage;
    return matchesSearch && matchesLanguage;
  });

  const handleBulkToggleExclusion = async (exclude: boolean) => {
    const selectedIds = Array.from(selectedRepos);
    if (selectedIds.length === 0) return;

    const toastId = toast.loading(`${exclude ? 'Hiding' : 'Showing'} ${selectedIds.length} repositories...`);
    
    try {
      // Process in sequence to avoid SQLite busy errors, or parallelize if backend handles it
      for (const repoId of selectedIds) {
        await fetch('/api/repositories/toggle-exclude', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repositoryId: repoId,
            isExcluded: exclude,
          }),
        });
      }
      
      toast.success(`Successfully ${exclude ? 'hidden' : 'shown'} ${selectedIds.length} repositories.`, { id: toastId });
      setSelectedRepos(new Set());
      loadData();
    } catch (error) {
      console.error('Bulk update error:', error);
      toast.error('Failed to update some repositories', { id: toastId });
    }
  };

  const ungroupedRepos = filteredRepos.filter(r => !r.projectId && !r.isExcluded);
  const excludedRepos = filteredRepos.filter(r => r.isExcluded);
  const groupedRepos = filteredRepos.filter(r => !!r.projectId && !r.isExcluded);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground italic">Gathering your technical history...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">1. Select & Organize</h2>
          <p className="text-slate-400 mt-1 max-w-2xl">
            Choose your best work. Hide forks or boilerplate. Group related repos into projects (e.g. Frontend + Backend).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            onClick={handleAutoCurate}
            disabled={isAutoCurating || loading}
            className="border-purple-500/50 text-purple-300 hover:bg-purple-500/10"
          >
            <Sparkles className={`h-4 w-4 mr-2 ${isAutoCurating ? 'animate-spin' : ''}`} />
            {isAutoCurating ? 'Organizing...' : 'Magic Auto-Curate'}
          </Button>

          <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (!open) {
              setNewProjectName('');
              setNewProjectDescription('');
              setSelectedRepos(new Set());
            }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-purple-600 hover:bg-purple-700">
                <Plus className="h-4 w-4 mr-2" />
                Create Project Group
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800 text-white">
              <DialogHeader>
                <DialogTitle>Create Project Group</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Combine related repositories into a single logical project for your portfolio.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="project-name" className="text-slate-300">Project Name</Label>
                  <Input
                    id="project-name"
                    placeholder="e.g. Patient Management System"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="project-description" className="text-slate-300">Description (Optional)</Label>
                  <Textarea
                    id="project-description"
                    placeholder="Describe the overall project and why it matters..."
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    rows={3}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Select Repositories to Group</Label>
                  <div className="mt-2 space-y-2 max-h-60 overflow-y-auto border border-slate-700 rounded-md p-3 bg-slate-950">
                    {repositories.filter(r => !r.isExcluded && (!r.projectId)).map(repo => (
                      <div key={repo.id} className="flex items-center space-x-3 p-1 hover:bg-slate-900 rounded">
                        <Checkbox
                          id={`select-${repo.id}`}
                          checked={selectedRepos.has(repo.id)}
                          onCheckedChange={(checked) => {
                            const newSet = new Set(selectedRepos);
                            if (checked) newSet.add(repo.id);
                            else newSet.delete(repo.id);
                            setSelectedRepos(newSet);
                          }}
                        />
                        <label htmlFor={`select-${repo.id}`} className="text-sm cursor-pointer flex-1 text-slate-300">
                          {repo.name}
                          {repo.language && (
                            <Badge variant="outline" className="ml-2 border-slate-700 text-slate-500">
                              {repo.language}
                            </Badge>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="border-slate-700 text-slate-300">
                  Cancel
                </Button>
                <Button onClick={createProject} className="bg-purple-600 hover:bg-purple-700">Create Project</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            if (!open) {
              setEditingProject(null);
              setNewProjectName('');
              setNewProjectDescription('');
              setSelectedRepos(new Set());
            }
          }}>
            <DialogContent className="bg-slate-900 border-slate-800 text-white">
              <DialogHeader>
                <DialogTitle>Edit Project Group</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Add or remove repositories from this project group.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="edit-project-name" className="text-slate-300">Project Name</Label>
                  <Input
                    id="edit-project-name"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-project-description" className="text-slate-300">Description (Optional)</Label>
                  <Textarea
                    id="edit-project-description"
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    rows={3}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Repositories in Group</Label>
                  <div className="mt-2 space-y-2 max-h-60 overflow-y-auto border border-slate-700 rounded-md p-3 bg-slate-950">
                    {repositories.filter(r => !r.isExcluded && (!r.projectId || r.projectId === editingProject?.id)).map(repo => (
                      <div key={repo.id} className="flex items-center space-x-3 p-1 hover:bg-slate-900 rounded">
                        <Checkbox
                          id={`edit-select-${repo.id}`}
                          checked={selectedRepos.has(repo.id)}
                          onCheckedChange={(checked) => {
                            const newSet = new Set(selectedRepos);
                            if (checked) newSet.add(repo.id);
                            else newSet.delete(repo.id);
                            setSelectedRepos(newSet);
                          }}
                        />
                        <label htmlFor={`edit-select-${repo.id}`} className="text-sm cursor-pointer flex-1 text-slate-300">
                          {repo.name}
                          {repo.language && (
                            <Badge variant="outline" className="ml-2 border-slate-700 text-slate-500">
                              {repo.language}
                            </Badge>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="border-slate-700 text-slate-300">
                  Cancel
                </Button>
                <Button onClick={updateProject} className="bg-purple-600 hover:bg-purple-700">Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="bg-slate-800/30 border-slate-700">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input 
              placeholder="Search repositories..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-900 border-slate-700 text-white"
            />
          </div>
          <div className="flex gap-2">
            <select 
              value={filterLanguage || ''} 
              onChange={(e) => setFilterLanguage(e.target.value || null)}
              className="bg-slate-900 border border-slate-700 text-white text-sm rounded-md px-3 py-2 outline-none"
            >
              <option value="">All Languages</option>
              {languages.map(lang => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
            {selectedRepos.size > 0 && (
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => handleBulkToggleExclusion(true)}
                  className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                >
                  <EyeOff className="h-4 w-4 mr-1" /> Hide {selectedRepos.size}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => handleBulkToggleExclusion(false)}
                  className="border-green-500/50 text-green-400 hover:bg-green-500/10"
                >
                  <Check className="h-4 w-4 mr-1" /> Show {selectedRepos.size}
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setSelectedRepos(new Set())}
                  className="text-slate-400"
                >
                  Clear
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="available" className="w-full">
        <TabsList className="bg-slate-900 border-slate-800">
          <TabsTrigger value="available" className="data-[state=active]:bg-slate-800">
            Selected ({ungroupedRepos.length + groupedRepos.length})
          </TabsTrigger>
          <TabsTrigger value="hidden" className="data-[state=active]:bg-slate-800">
            Hidden ({excludedRepos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="space-y-6 mt-4">
          {projects.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Project Groups
              </h3>
              <div className="grid gap-4">
                {projects.map(project => (
                  <Card key={project.id} className="bg-slate-800/40 border-slate-700 overflow-hidden">
                    <div className="p-4 border-b border-slate-700 bg-slate-800/20 flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-lg text-white">{project.name}</h4>
                          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40">Project</Badge>
                        </div>
                        {project.description && (
                          <p className="text-sm text-slate-400 mt-1">{project.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditProject(project)}
                          className="border-slate-700 text-slate-300 hover:bg-slate-700"
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit Group
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => analyzeProject(project.id)}
                          className="border-slate-700 text-slate-300 hover:bg-slate-700"
                        >
                          <Sparkles className="h-4 w-4 mr-2 text-purple-400" />
                          Deep Analysis
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteProject(project.id)}
                          className="text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="p-4 flex flex-wrap gap-3">
                      {project.repositories.map(repo => (
                        <div key={repo.id} className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-md border border-slate-700/50">
                          <span className="text-sm text-slate-200 font-medium">{repo.name}</span>
                          {repo.language && <span className="text-xs text-slate-500">• {repo.language}</span>}
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              {projects.length > 0 ? 'Remaining Repositories' : 'Individual Repositories'}
            </h3>
            <div className="grid gap-3">
              {ungroupedRepos.map(repo => (
                <Card key={repo.id} className="bg-slate-800/30 border-slate-700 hover:border-slate-600 transition-colors">
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Checkbox
                        id={`check-${repo.id}`}
                        checked={selectedRepos.has(repo.id)}
                        onCheckedChange={(checked) => {
                          const newSet = new Set(selectedRepos);
                          if (checked) newSet.add(repo.id);
                          else newSet.delete(repo.id);
                          setSelectedRepos(newSet);
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <label htmlFor={`check-${repo.id}`} className="font-semibold text-white truncate cursor-pointer">
                            {repo.name}
                          </label>
                          {repo.language && (
                            <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px] h-4">
                              {repo.language}
                            </Badge>
                          )}
                        </div>
                        {repo.description && (
                          <p className="text-sm text-slate-500 truncate mt-0.5">{repo.description}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleRepoExclusion(repo.id, false)}
                      className="text-slate-500 hover:text-slate-300"
                    >
                      <EyeOff className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
              {ungroupedRepos.length === 0 && (
                <p className="text-center py-8 text-slate-500 italic border border-dashed border-slate-800 rounded-lg">
                  No individual repositories found matching filters.
                </p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="hidden" className="space-y-4 mt-4">
          <div className="grid gap-3">
            {excludedRepos.map(repo => (
              <Card key={repo.id} className="bg-slate-900/50 border-slate-800 opacity-60 hover:opacity-100 transition-opacity">
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Checkbox
                      id={`check-hidden-${repo.id}`}
                      checked={selectedRepos.has(repo.id)}
                      onCheckedChange={(checked) => {
                        const newSet = new Set(selectedRepos);
                        if (checked) newSet.add(repo.id);
                        else newSet.delete(repo.id);
                        setSelectedRepos(newSet);
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <label htmlFor={`check-hidden-${repo.id}`} className="font-semibold text-slate-400 truncate cursor-pointer line-through">
                          {repo.name}
                        </label>
                        {repo.language && (
                          <Badge variant="outline" className="border-slate-800 text-slate-600 text-[10px] h-4">
                            {repo.language}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleRepoExclusion(repo.id, true)}
                    className="text-slate-500 hover:text-green-400"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
            {excludedRepos.length === 0 && (
              <p className="text-center py-12 text-slate-600 italic">
                No hidden repositories.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

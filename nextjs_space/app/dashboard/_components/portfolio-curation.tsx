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
import { Plus, FolderOpen, Eye, EyeOff, Trash2, Sparkles } from 'lucide-react';

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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reposRes, projectsRes] = await Promise.all([
        fetch('/api/repositories'),
        fetch('/api/projects'),
      ]);

      if (reposRes.ok) {
        const data = await reposRes.json();
        setRepositories(data.repositories || []);
      }

      if (projectsRes.ok) {
        const data = await projectsRes.json();
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

      if (!res.ok) throw new Error('Failed to update');

      setRepositories(prev =>
        prev.map(repo =>
          repo.id === repoId ? { ...repo, isExcluded: !currentExcluded } : repo
        )
      );

      toast.success(!currentExcluded ? 'Repository excluded' : 'Repository included');
    } catch (error) {
      console.error('Error toggling repository:', error);
      toast.error('Failed to update repository');
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

      if (!res.ok) throw new Error('Failed to create project');

      toast.success('Project created successfully');
      setNewProjectName('');
      setNewProjectDescription('');
      setSelectedRepos(new Set());
      setIsCreateDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Failed to create project');
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

      if (!res.ok) throw new Error('Failed to delete project');

      toast.success('Project deleted');
      loadData();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
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

  const ungroupedRepos = repositories.filter(r => !r.projectId && !r.isExcluded);
  const excludedRepos = repositories.filter(r => r.isExcluded);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Curate Your Portfolio</h2>
          <p className="text-muted-foreground mt-1">
            Select which repositories to showcase and group related projects
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Project Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Project Group</DialogTitle>
              <DialogDescription>
                Group related repositories into a single project (e.g., different versions of the same app)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="project-name">Project Name</Label>
                <Input
                  id="project-name"
                  placeholder="E-commerce Platform"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="project-description">Description (Optional)</Label>
                <Textarea
                  id="project-description"
                  placeholder="A full-stack e-commerce solution with React and Node.js..."
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div>
                <Label>Select Repositories to Group</Label>
                <div className="mt-2 space-y-2 max-h-60 overflow-y-auto border rounded-md p-3">
                  {ungroupedRepos.map(repo => (
                    <div key={repo.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`select-${repo.id}`}
                        checked={selectedRepos.has(repo.id)}
                        onCheckedChange={(checked) => {
                          const newSet = new Set(selectedRepos);
                          if (checked) {
                            newSet.add(repo.id);
                          } else {
                            newSet.delete(repo.id);
                          }
                          setSelectedRepos(newSet);
                        }}
                      />
                      <label
                        htmlFor={`select-${repo.id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {repo.name}
                        {repo.language && (
                          <Badge variant="outline" className="ml-2">
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
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createProject}>Create Project</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Projects */}
      {projects.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Project Groups ({projects.length})
          </h3>
          {projects.map(project => (
            <Card key={project.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {project.name}
                      {project.isVisible ? (
                        <Eye className="h-4 w-4 text-green-500" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </CardTitle>
                    {project.description && (
                      <CardDescription className="mt-1">{project.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => analyzeProject(project.id)}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Analyze
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteProject(project.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {project.repositories.length} repositories grouped:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {project.repositories.map(repo => (
                      <Badge key={repo.id} variant="secondary">
                        {repo.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Ungrouped Repositories */}
      {ungroupedRepos.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Individual Repositories ({ungroupedRepos.length})</h3>
          <div className="grid gap-4">
            {ungroupedRepos.map(repo => (
              <Card key={repo.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{repo.name}</h4>
                        {repo.language && (
                          <Badge variant="outline">{repo.language}</Badge>
                        )}
                      </div>
                      {repo.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {repo.description}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleRepoExclusion(repo.id, repo.isExcluded)}
                    >
                      <EyeOff className="h-4 w-4 mr-2" />
                      Hide
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Excluded Repositories */}
      {excludedRepos.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-muted-foreground">
            Hidden Repositories ({excludedRepos.length})
          </h3>
          <div className="grid gap-4 opacity-60">
            {excludedRepos.map(repo => (
              <Card key={repo.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{repo.name}</h4>
                        {repo.language && (
                          <Badge variant="outline">{repo.language}</Badge>
                        )}
                      </div>
                      {repo.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {repo.description}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleRepoExclusion(repo.id, repo.isExcluded)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Show
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {repositories.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">
              No repositories found. Sync your GitHub repositories first.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

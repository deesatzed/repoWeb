import fs from 'fs';
import path from 'path';
import { encrypt, decrypt } from './encryption';

export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
}

export interface GitHubConnection {
  id: string;
  userId: string;
  githubUsername: string;
  githubToken: string;
  lastSyncedAt?: string;
  createdAt: string;
}

export interface Repository {
  id: string;
  userId: string;
  name: string;
  fullName: string;
  description?: string;
  language?: string;
  stargazersCount: number;
  forksCount: number;
  openIssuesCount: number;
  size: number;
  defaultBranch: string;
  topics: string[];
  htmlUrl: string;
  isPrivate: boolean;
  isFork: boolean;
  createdAt: string;
  updatedAt: string;
  pushedAt?: string;
  isExcluded: boolean;
  isFeatured: boolean;
  projectId?: string;
  readmeContent?: string;
  languages?: Record<string, number>;
  lastAnalyzedAt?: string;
  aiAnalysis?: {
    projectType?: string;
    summary?: string;
    techStack: string[];
    keyFeatures: string[];
    skillsDemonstrated: string[];
    keyResults?: string[];
    novelApproaches?: string;
    architecturePatterns: string[];
    hasTests: boolean;
    hasDocumentation: boolean;
    hasCiCd: boolean;
    contributionPattern?: string;
    // Legacy fields for backward compatibility
    strengths?: string[];
    employerHighlights?: string;
    complexityScore?: number;
    codeQualityScore?: number;
  };
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isVisible: boolean;
  createdAt: string;
}

export interface PortfolioSettings {
  userId: string;
  displayName?: string;
  bio?: string;
  location?: string;
  hidePrivateRepoNames?: boolean;
  workflowState?: string;
}

export interface WorkflowState {
  userId: string;
  currentState: string;
  lastUpdated: string;
}

export interface ProjectAnalysis {
  projectId: string;
  technicalSkills: string[];
  designDecisions: string;
  novelApproaches: string;
  testingStrategy: string;
  problemsSolved: string;
  skillDemonstration: string;
  architectureInsights: string;
  techStack: string[];
  updatedAt: string;
}

export interface CodeAssetOccurrence {
  id: string;
  codeAssetId: string;
  repositoryId?: string;
  repoName: string;
  filePath: string;
  createdAt: string;
}

export interface CodeAsset {
  id: string;
  fingerprint: string;
  name: string;
  type: string;
  content: string;
  language: string;
  complexity: number;
  frequency: number;
  valueScore: number;
  occurrences: CodeAssetOccurrence[];
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioData {
  users: User[];
  githubConnections: GitHubConnection[];
  repositories: Repository[];
  projects: Project[];
  settings: PortfolioSettings[];
  workflowStates: WorkflowState[];
  projectAnalyses: ProjectAnalysis[];
  codeAssets: CodeAsset[];
  codeAssetOccurrences: CodeAssetOccurrence[];
}

const DATA_FILE = path.join(process.cwd(), 'data', 'portfolio.json');

export class JSONStorage {
  private data: PortfolioData = {
    users: [],
    githubConnections: [],
    repositories: [],
    projects: [],
    settings: [],
    workflowStates: [],
    projectAnalyses: [],
    codeAssets: [],
    codeAssetOccurrences: []
  };

  constructor() {
    this.ensureDataDirectory();
    this.loadData();
  }

  private ensureDataDirectory() {
    const dataDir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  private loadData() {
    if (fs.existsSync(DATA_FILE)) {
      try {
        const content = fs.readFileSync(DATA_FILE, 'utf-8');
        this.data = JSON.parse(content);
      } catch (error) {
        console.error('Error loading data:', error);
        // Initialize with empty data
      }
    }
  }

  private saveData() {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Error saving data:', error);
      throw error;
    }
  }

  // User methods
  async upsertUser(userData: Omit<User, 'createdAt'>) {
    const existing = this.data.users.find(u => u.id === userData.id);
    if (existing) {
      Object.assign(existing, userData);
    } else {
      this.data.users.push({
        ...userData,
        createdAt: new Date().toISOString()
      });
    }
    this.saveData();
    return this.data.users.find(u => u.id === userData.id)!;
  }

  async getUserById(userId: string) {
    return this.data.users.find(u => u.id === userId);
  }

  // GitHub Connection methods
  async upsertGitHubConnection(connectionData: Omit<GitHubConnection, 'createdAt'>) {
    const existing = this.data.githubConnections.find(c => c.userId === connectionData.userId);
    if (existing) {
      Object.assign(existing, connectionData);
    } else {
      this.data.githubConnections.push({
        ...connectionData,
        createdAt: new Date().toISOString()
      });
    }
    this.saveData();
    return this.data.githubConnections.find(c => c.userId === connectionData.userId)!;
  }

  async getGitHubConnection(userId: string) {
    return this.data.githubConnections.find(c => c.userId === userId);
  }

  // Repository methods
  async upsertRepository(repoData: Omit<Repository, 'createdAt'>) {
    const existing = this.data.repositories.find(r => r.id === repoData.id);
    if (existing) {
      Object.assign(existing, repoData);
    } else {
      this.data.repositories.push({
        ...repoData,
        createdAt: new Date().toISOString()
      });
    }
    this.saveData();
    return this.data.repositories.find(r => r.id === repoData.id)!;
  }

  async getRepositories(userId: string) {
    return this.data.repositories.filter(r => r.userId === userId);
  }

  async updateRepository(repoId: string, updates: Partial<Repository>) {
    const repo = this.data.repositories.find(r => r.id === repoId);
    if (repo) {
      Object.assign(repo, updates);
      this.saveData();
      return repo;
    }
    return null;
  }

  async deleteRepository(repoId: string) {
    const index = this.data.repositories.findIndex(r => r.id === repoId);
    if (index !== -1) {
      this.data.repositories.splice(index, 1);
      this.saveData();
      return true;
    }
    return false;
  }

  async deleteRepositories(repoIds: string[]) {
    const initialCount = this.data.repositories.length;
    this.data.repositories = this.data.repositories.filter(r => !repoIds.includes(r.id));
    const deletedCount = initialCount - this.data.repositories.length;
    if (deletedCount > 0) {
      this.saveData();
    }
    return deletedCount;
  }

  // Project methods
  async createProject(projectData: Omit<Project, 'id' | 'createdAt'>) {
    const project: Project = {
      ...projectData,
      id: `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    this.data.projects.push(project);
    this.saveData();
    return project;
  }

  async getProjects(userId: string) {
    return this.data.projects.filter(p => p.userId === userId);
  }

  async getProjectById(projectId: string) {
    return this.data.projects.find(p => p.id === projectId);
  }

  async updateProject(projectId: string, updates: Partial<Project>) {
    const project = this.data.projects.find(p => p.id === projectId);
    if (project) {
      Object.assign(project, updates);
      this.saveData();
      return project;
    }
    return null;
  }

  async deleteProject(projectId: string) {
    const index = this.data.projects.findIndex(p => p.id === projectId);
    if (index !== -1) {
      this.data.projects.splice(index, 1);
      // Also remove projectId from repositories
      this.data.repositories.forEach(r => {
        if (r.projectId === projectId) {
          r.projectId = undefined;
        }
      });
      this.saveData();
      return true;
    }
    return false;
  }

  // Settings methods
  async upsertSettings(settingsData: PortfolioSettings) {
    const existing = this.data.settings.find(s => s.userId === settingsData.userId);
    if (existing) {
      Object.assign(existing, settingsData);
    } else {
      this.data.settings.push(settingsData);
    }
    this.saveData();
    return this.data.settings.find(s => s.userId === settingsData.userId)!;
  }

  async getSettings(userId: string) {
    return this.data.settings.find(s => s.userId === userId);
  }

  // Workflow methods
  async upsertWorkflowState(stateData: WorkflowState) {
    const existing = this.data.workflowStates.find(w => w.userId === stateData.userId);
    if (existing) {
      Object.assign(existing, stateData);
    } else {
      this.data.workflowStates.push(stateData);
    }
    this.saveData();
    return this.data.workflowStates.find(w => w.userId === stateData.userId)!;
  }

  async getWorkflowState(userId: string) {
    return this.data.workflowStates.find(w => w.userId === userId);
  }

  // Project Analysis methods
  async upsertProjectAnalysis(analysisData: Omit<ProjectAnalysis, 'updatedAt'>) {
    const existing = this.data.projectAnalyses.find(a => a.projectId === analysisData.projectId);
    if (existing) {
      Object.assign(existing, analysisData, { updatedAt: new Date().toISOString() });
    } else {
      this.data.projectAnalyses.push({
        ...analysisData,
        updatedAt: new Date().toISOString()
      });
    }
    this.saveData();
    return this.data.projectAnalyses.find(a => a.projectId === analysisData.projectId)!;
  }

  async getProjectAnalysis(projectId: string) {
    return this.data.projectAnalyses.find(a => a.projectId === projectId);
  }

  // Code Asset methods
  async getCodeAssets(repoNames: string[]) {
    const assets = this.data.codeAssets.filter(asset =>
      asset.occurrences.some(occ => repoNames.includes(occ.repoName))
    ).map(asset => ({
      ...asset,
      occurrences: asset.occurrences.filter(occ => repoNames.includes(occ.repoName))
    })).sort((a, b) => b.valueScore - a.valueScore).slice(0, 100);
    return assets;
  }

  // Reset user data
  async resetUserData(userId: string) {
    this.data.repositories = this.data.repositories.filter(r => r.userId !== userId);
    this.data.projects = this.data.projects.filter(p => p.userId !== userId);
    this.data.settings = this.data.settings.filter(s => s.userId !== userId);
    this.data.githubConnections = this.data.githubConnections.filter(c => c.userId !== userId);
    this.data.workflowStates = this.data.workflowStates.filter(w => w.userId !== userId);
    this.data.codeAssets = [];
    this.saveData();
  }

  // Export/Import
  async exportData(userId: string) {
    const userData = {
      user: this.data.users.find(u => u.id === userId),
      githubConnection: this.data.githubConnections.find(c => c.userId === userId),
      repositories: this.data.repositories.filter(r => r.userId === userId),
      projects: this.data.projects.filter(p => p.userId === userId),
      settings: this.data.settings.find(s => s.userId === userId),
      workflowState: this.data.workflowStates.find(w => w.userId === userId)
    };
    return userData;
  }

  async importData(userId: string, importData: any) {
    // Upsert user
    if (importData.user) {
      await this.upsertUser(importData.user);
    }
    // Upsert connection
    if (importData.githubConnection) {
      await this.upsertGitHubConnection(importData.githubConnection);
    }
    // Upsert repositories
    if (importData.repositories) {
      for (const repo of importData.repositories) {
        await this.upsertRepository(repo);
      }
    }
    // Upsert projects
    if (importData.projects) {
      for (const project of importData.projects) {
        await this.createProject(project);
      }
    }
    // Upsert settings
    if (importData.settings) {
      await this.upsertSettings(importData.settings);
    }
    // Upsert workflow
    if (importData.workflowState) {
      await this.upsertWorkflowState(importData.workflowState);
    }
  }
}

export const db = new JSONStorage();

import { Octokit } from '@octokit/rest';
import { decrypt } from './encryption';

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  private: boolean;
  fork: boolean;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  watchers_count: number;
  size: number;
  default_branch: string;
  topics: string[];
  created_at: string;
  updated_at: string;
  pushed_at: string | null;
}

export interface GitHubLanguages {
  [language: string]: number;
}

export class GitHubService {
  private octokit: Octokit;

  constructor(encryptedToken: string) {
    const token = decrypt(encryptedToken);
    this.octokit = new Octokit({ auth: token });
  }

  async getAuthenticatedUser() {
    try {
      const { data } = await this.octokit.users.getAuthenticated();
      return data;
    } catch (error: any) {
      console.error('Failed to get authenticated user:', error?.message);
      throw new Error('Failed to authenticate with GitHub');
    }
  }

  async getRepositoryFiles(owner: string, repo: string, path: string = '', maxFiles: number = 10): Promise<Array<{ path: string; content: string; sha: string }>> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
      });

      if (!Array.isArray(data)) {
        return [];
      }

      const files: Array<{ path: string; content: string; sha: string }> = [];
      let count = 0;

      for (const item of data) {
        if (count >= maxFiles) break;

        if (item.type === 'file' && !item.name.match(/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|pdf|zip|tar|gz)$/i)) {
          try {
            const { data: fileData } = await this.octokit.repos.getContent({
              owner,
              repo,
              path: item.path,
            });

            if ('content' in fileData && typeof fileData.content === 'string') {
              const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
              files.push({
                path: item.path,
                content: content.substring(0, 3000),
                sha: fileData.sha,
              });
              count++;
            }
          } catch (err) {
            console.warn(`Failed to fetch file ${item.path}:`, err);
          }
        }
      }

      return files;
    } catch (error: any) {
      console.error('Failed to fetch repository files:', error?.message);
      return [];
    }
  }

  async getUserRepositories(username: string): Promise<GitHubRepo[]> {
    try {
      const repos: GitHubRepo[] = [];
      let page = 1;
      const perPage = 100;

      while (true) {
        const { data } = await this.octokit.repos.listForAuthenticatedUser({
          per_page: perPage,
          page,
          sort: 'updated',
          direction: 'desc',
        });

        if (data?.length === 0) break;
        repos.push(...(data as GitHubRepo[]));
        if (data?.length < perPage) break;
        page++;
      }

      return repos;
    } catch (error: any) {
      console.error('Failed to fetch repositories:', error?.message);
      throw new Error('Failed to fetch repositories from GitHub');
    }
  }

  async getRepositoryLanguages(owner: string, repo: string): Promise<GitHubLanguages> {
    try {
      const { data } = await this.octokit.repos.listLanguages({ owner, repo });
      return data ?? {};
    } catch (error: any) {
      console.error(`Failed to fetch languages for ${owner}/${repo}:`, error?.message);
      return {};
    }
  }

  async getRepositoryReadme(owner: string, repo: string): Promise<string | null> {
    try {
      const { data } = await this.octokit.repos.getReadme({ owner, repo });
      if (data?.content) {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }
      return null;
    } catch (error: any) {
      console.error(`Failed to fetch README for ${owner}/${repo}:`, error?.message);
      return null;
    }
  }

  async getRepositoryContents(owner: string, repo: string, path: string = '') {
    try {
      const { data } = await this.octokit.repos.getContent({ owner, repo, path });
      return data;
    } catch (error: any) {
      console.error(`Failed to fetch contents for ${owner}/${repo}/${path}:`, error?.message);
      return null;
    }
  }

  async getRepositoryCommitActivity(owner: string, repo: string) {
    try {
      const { data } = await this.octokit.repos.getCommitActivityStats({ owner, repo });
      return data ?? [];
    } catch (error: any) {
      console.error(`Failed to fetch commit activity for ${owner}/${repo}:`, error?.message);
      return [];
    }
  }
}

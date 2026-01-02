export function toPublicRepository(repo: any, settings: any) {
  const parseJsonArray = (val: string | string[] | null | undefined) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try {
      return JSON.parse(val || '[]');
    } catch {
      return [];
    }
  };

  const base = {
    ...repo,
    githubId: repo?.githubId?.toString() ?? '0',
    topics: parseJsonArray(repo.topics),
  };

  if (base.aiAnalysis) {
    base.aiAnalysis = {
      ...base.aiAnalysis,
      techStack: parseJsonArray(base.aiAnalysis.techStack),
      keyFeatures: parseJsonArray(base.aiAnalysis.keyFeatures),
      strengths: parseJsonArray(base.aiAnalysis.strengths),
      architecturePatterns: parseJsonArray(base.aiAnalysis.architecturePatterns),
      skillsDemonstrated: parseJsonArray(base.aiAnalysis.skillsDemonstrated),
    };
  }

  if (repo?.isPrivate && settings?.hidePrivateRepoNames) {
    return {
      ...base,
      name: 'Private Repository',
      fullName: 'Private Repository',
      description: 'This is a private repository',
      htmlUrl: '',
      homepage: '',
      topics: [],
      readmeContent: null,
    };
  }

  return base;
}

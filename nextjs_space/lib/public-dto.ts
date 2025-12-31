export function toPublicRepository(repo: any, settings: any) {
  const base = {
    ...repo,
    githubId: repo?.githubId?.toString() ?? '0',
  };

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

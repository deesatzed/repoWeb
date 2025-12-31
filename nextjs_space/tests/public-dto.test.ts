import assert from 'node:assert/strict';
import test from 'node:test';

import { toPublicRepository } from '../lib/public-dto';

test('toPublicRepository masks private repo when hidePrivateRepoNames is enabled', () => {
  const repo = {
    githubId: 123n,
    name: 'secret-repo',
    fullName: 'org/secret-repo',
    description: 'secret',
    htmlUrl: 'https://github.com/org/secret-repo',
    homepage: 'https://internal',
    topics: ['a'],
    readmeContent: 'top secret',
    isPrivate: true,
  };

  const settings = { hidePrivateRepoNames: true };
  const out = toPublicRepository(repo, settings);

  assert.equal(out.githubId, '123');
  assert.equal(out.name, 'Private Repository');
  assert.equal(out.fullName, 'Private Repository');
  assert.equal(out.description, 'This is a private repository');
  assert.equal(out.htmlUrl, '');
  assert.equal(out.homepage, '');
  assert.deepEqual(out.topics, []);
  assert.equal(out.readmeContent, null);
});

test('toPublicRepository keeps fields for public repo', () => {
  const repo = {
    githubId: 456n,
    name: 'public-repo',
    isPrivate: false,
    htmlUrl: 'https://github.com/x/public-repo',
  };

  const settings = { hidePrivateRepoNames: true };
  const out = toPublicRepository(repo, settings);

  assert.equal(out.githubId, '456');
  assert.equal(out.name, 'public-repo');
  assert.equal(out.htmlUrl, 'https://github.com/x/public-repo');
});

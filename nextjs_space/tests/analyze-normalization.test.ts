import assert from 'node:assert/strict';
import test from 'node:test';
import { describe, mock } from 'node:test';

import { RepositoryAnalysisSchema } from '../lib/analysis-schemas';

// Mock the normalizeContributionPattern function extracted from the route
const normalizeContributionPattern = (val: any): 'Solo Project' | 'Team Collaboration' | 'Open Source' => {
  if (!val) return 'Solo Project';
  const v = String(val).toLowerCase();
  if (v.includes('team')) return 'Team Collaboration';
  if (v.includes('open')) return 'Open Source';
  return 'Solo Project';
};

describe('contributionPattern normalization', () => {
  test('normalizes "Solo" to "Solo Project"', () => {
    const result = normalizeContributionPattern('Solo');
    assert.equal(result, 'Solo Project');
  });

  test('normalizes "solo" (lowercase) to "Solo Project"', () => {
    const result = normalizeContributionPattern('solo');
    assert.equal(result, 'Solo Project');
  });

  test('normalizes "Team" to "Team Collaboration"', () => {
    const result = normalizeContributionPattern('Team');
    assert.equal(result, 'Team Collaboration');
  });

  test('normalizes "team collaboration" to "Team Collaboration"', () => {
    const result = normalizeContributionPattern('team collaboration');
    assert.equal(result, 'Team Collaboration');
  });

  test('normalizes "Open Source" to "Open Source"', () => {
    const result = normalizeContributionPattern('Open Source');
    assert.equal(result, 'Open Source');
  });

  test('normalizes "open" to "Open Source"', () => {
    const result = normalizeContributionPattern('open');
    assert.equal(result, 'Open Source');
  });

  test('handles null/undefined by returning "Solo Project"', () => {
    assert.equal(normalizeContributionPattern(null), 'Solo Project');
    assert.equal(normalizeContributionPattern(undefined), 'Solo Project');
  });

  test('handles empty string by returning "Solo Project"', () => {
    assert.equal(normalizeContributionPattern(''), 'Solo Project');
  });
});

describe('RepositoryAnalysisSchema with normalized contributionPattern', () => {
  test('accepts "Solo Project" after normalization', () => {
    const analysis = {
      complexityScore: 75,
      codeQualityScore: 80,
      projectType: 'Production-Grade System',
      techStack: ['Next.js', 'TypeScript'],
      keyFeatures: ['Feature 1'],
      strengths: ['Strength 1'],
      architecturePatterns: ['Pattern 1'],
      summary: 'Test summary',
      employerHighlights: 'Test highlight',
      skillsDemonstrated: ['Skill 1'],
      linesOfCode: 1000,
      fileCount: 50,
      hasTests: true,
      hasDocumentation: true,
      hasCiCd: true,
      contributionPattern: 'Solo Project',
    };
    const result = RepositoryAnalysisSchema.safeParse(analysis);
    assert.equal(result.success, true);
  });

  test('accepts "Team Collaboration" after normalization', () => {
    const analysis = {
      complexityScore: 75,
      codeQualityScore: 80,
      projectType: 'Production-Grade System',
      techStack: ['Next.js', 'TypeScript'],
      keyFeatures: ['Feature 1'],
      strengths: ['Strength 1'],
      architecturePatterns: ['Pattern 1'],
      summary: 'Test summary',
      employerHighlights: 'Test highlight',
      skillsDemonstrated: ['Skill 1'],
      linesOfCode: 1000,
      fileCount: 50,
      hasTests: true,
      hasDocumentation: true,
      hasCiCd: true,
      contributionPattern: 'Team Collaboration',
    };
    const result = RepositoryAnalysisSchema.safeParse(analysis);
    assert.equal(result.success, true);
  });

  test('accepts "Open Source" after normalization', () => {
    const analysis = {
      complexityScore: 75,
      codeQualityScore: 80,
      projectType: 'Production-Grade System',
      techStack: ['Next.js', 'TypeScript'],
      keyFeatures: ['Feature 1'],
      strengths: ['Strength 1'],
      architecturePatterns: ['Pattern 1'],
      summary: 'Test summary',
      employerHighlights: 'Test highlight',
      skillsDemonstrated: ['Skill 1'],
      linesOfCode: 1000,
      fileCount: 50,
      hasTests: true,
      hasDocumentation: true,
      hasCiCd: true,
      contributionPattern: 'Open Source',
    };
    const result = RepositoryAnalysisSchema.safeParse(analysis);
    assert.equal(result.success, true);
  });

  test('rejects invalid contributionPattern values', () => {
    const analysis = {
      complexityScore: 75,
      codeQualityScore: 80,
      projectType: 'Production-Grade System',
      techStack: ['Next.js', 'TypeScript'],
      keyFeatures: ['Feature 1'],
      strengths: ['Strength 1'],
      architecturePatterns: ['Pattern 1'],
      summary: 'Test summary',
      employerHighlights: 'Test highlight',
      skillsDemonstrated: ['Skill 1'],
      linesOfCode: 1000,
      fileCount: 50,
      hasTests: true,
      hasDocumentation: true,
      hasCiCd: true,
      contributionPattern: 'Invalid Value',
    };
    const result = RepositoryAnalysisSchema.safeParse(analysis);
    assert.equal(result.success, false);
  });
});

describe('LLM response normalization flow', () => {
  test('normalizes and validates complete LLM response', () => {
    const llmResponse = {
      complexityScore: 85,
      codeQualityScore: 90,
      projectType: 'Production-Grade System',
      techStack: ['React', 'Node.js'],
      keyFeatures: ['Real-time updates', 'Authentication'],
      strengths: ['Clean architecture', 'Good test coverage'],
      architecturePatterns: ['MVC', 'Repository pattern'],
      summary: 'A well-structured full-stack application',
      employerHighlights: 'Demonstrates strong full-stack skills',
      skillsDemonstrated: ['React', 'Node.js', 'TypeScript'],
      linesOfCode: 5000,
      fileCount: 120,
      hasTests: true,
      hasDocumentation: true,
      hasCiCd: true,
      contributionPattern: 'Solo', // Raw LLM output
    };

    const normalizedAnalysis = {
      ...llmResponse,
      contributionPattern: normalizeContributionPattern(llmResponse.contributionPattern),
    };

    const result = RepositoryAnalysisSchema.safeParse(normalizedAnalysis);
    assert.equal(result.success, true);
    assert.equal(result.data?.contributionPattern, 'Solo Project');
  });

  test('handles missing contributionPattern field', () => {
    const llmResponse = {
      complexityScore: 85,
      codeQualityScore: 90,
      projectType: 'Production-Grade System',
      techStack: ['React', 'Node.js'],
      keyFeatures: ['Real-time updates', 'Authentication'],
      strengths: ['Clean architecture', 'Good test coverage'],
      architecturePatterns: ['MVC', 'Repository pattern'],
      summary: 'A well-structured full-stack application',
      employerHighlights: 'Demonstrates strong full-stack skills',
      skillsDemonstrated: ['React', 'Node.js', 'TypeScript'],
      linesOfCode: 5000,
      fileCount: 120,
      hasTests: true,
      hasDocumentation: true,
      hasCiCd: true,
      // contributionPattern missing
    };

    const normalizedAnalysis = {
      ...llmResponse,
      contributionPattern: normalizeContributionPattern((llmResponse as any).contributionPattern),
    };

    const result = RepositoryAnalysisSchema.safeParse(normalizedAnalysis);
    assert.equal(result.success, true);
    assert.equal(result.data?.contributionPattern, 'Solo Project');
  });
});

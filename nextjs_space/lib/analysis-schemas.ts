import { z } from 'zod';

export const RepositoryAnalysisSchema = z.object({
  complexityScore: z.number().min(0).max(100),
  codeQualityScore: z.number().min(0).max(100),
  projectType: z.string().min(1),
  techStack: z.array(z.string()).default([]),
  keyFeatures: z.array(z.string()).default([]),
  strengths: z.array(z.string()).default([]),
  architecturePatterns: z.array(z.string()).default([]),
  summary: z.string().min(1),
  employerHighlights: z.string().min(1),
  skillsDemonstrated: z.array(z.string()).default([]),
  linesOfCode: z.number().int().nonnegative().nullable().optional(),
  fileCount: z.number().int().nonnegative().nullable().optional(),
  hasTests: z.boolean(),
  hasDocumentation: z.boolean(),
  hasCiCd: z.boolean(),
  contributionPattern: z.enum(['Solo Project', 'Team Collaboration', 'Open Source']),
  citations: z.array(z.object({
    claim: z.string(),
    filePath: z.string(),
    lineNumber: z.number().int().nonnegative(),
    codeSnippet: z.string().max(500),
  })).default([]),
});

export type RepositoryAnalysis = z.infer<typeof RepositoryAnalysisSchema>;

export const ProjectAnalysisSchema = z.object({
  technicalSkills: z.array(z.string()).default([]),
  designDecisions: z.string().nullable(),
  novelApproaches: z.string().nullable(),
  testingStrategy: z.string().nullable(),
  problemsSolved: z.string().nullable(),
  skillDemonstration: z.string().nullable(),
  architectureInsights: z.string().nullable(),
  techStack: z.array(z.string()).default([]),
});

export type ProjectAnalysis = z.infer<typeof ProjectAnalysisSchema>;

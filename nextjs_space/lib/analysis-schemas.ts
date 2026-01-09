import { z } from 'zod';

export const RepositoryAnalysisSchema = z.object({
  projectType: z.string().min(1),
  summary: z.string().min(1),
  techStack: z.array(z.string()).default([]),
  keyFeatures: z.array(z.string()).default([]),
  skillsDemonstrated: z.array(z.string()).default([]),
  keyResults: z.array(z.string()).default([]),
  novelApproaches: z.string().optional(),
  architecturePatterns: z.array(z.string()).default([]),
  hasTests: z.boolean(),
  hasDocumentation: z.boolean(),
  hasCiCd: z.boolean(),
  contributionPattern: z.enum(['Solo Project', 'Team Collaboration', 'Open Source']),
  // Legacy fields (optional for backward compatibility)
  strengths: z.array(z.string()).default([]).optional(),
  employerHighlights: z.string().optional(),
  complexityScore: z.number().optional(),
  codeQualityScore: z.number().optional(),
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

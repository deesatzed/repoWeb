import { z } from 'zod';

export const RepositoryAnalysisSchema = z.object({
  displayTitle: z.string().min(1).optional(),
  projectType: z.string().min(1).default('Software Project'),
  summary: z.string().min(1).default('No summary provided.'),
  techStack: z.array(z.string()).default([]),
  keyFeatures: z.array(z.string()).default([]),
  skillsDemonstrated: z.array(z.string()).default([]),
  keyResults: z.array(z.string()).default([]),
  novelApproaches: z.string().optional(),
  architecturePatterns: z.array(z.string()).default([]),
  hasTests: z.boolean().default(false),
  hasDocumentation: z.boolean().default(false),
  hasCiCd: z.boolean().default(false),
  contributionPattern: z
    .enum(['Solo Project', 'Team Collaboration', 'Open Source'])
    .default('Solo Project'),
  // Legacy fields (optional for backward compatibility)
  strengths: z.array(z.string()).default([]).optional(),
  employerHighlights: z.string().optional(),
  complexityScore: z.number().optional(),
  codeQualityScore: z.number().optional(),
});

export type RepositoryAnalysis = z.infer<typeof RepositoryAnalysisSchema>;

export const WhitepaperSchema = z.object({
  title: z.string().min(1),
  abstract: z.string().min(1),
  sections: z.array(z.object({
    heading: z.string().min(1),
    content: z.string().min(1),
    subsections: z.array(z.object({
      heading: z.string().optional(),
      content: z.string().min(1),
    })).optional(),
  })),
  technicalSpecs: z.object({
    architecture: z.string().min(1),
    designPatterns: z.array(z.string()).default([]),
    keyAlgorithms: z.array(z.string()).default([]),
    dataStructures: z.array(z.string()).default([]),
    performanceCharacteristics: z.string().optional(),
    securityConsiderations: z.string().optional(),
    scalabilityApproach: z.string().optional(),
  }),
  implementationNotes: z.array(z.object({
    topic: z.string().min(1),
    details: z.string().min(1),
    codeReferences: z.array(z.string()).default([]),
  })).default([]),
  tradeoffs: z.array(z.object({
    decision: z.string().min(1),
    alternatives: z.array(z.string()).default([]),
    rationale: z.string().min(1),
  })).default([]),
  generatedAt: z.string().default(() => new Date().toISOString()),
});

export type Whitepaper = z.infer<typeof WhitepaperSchema>;

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


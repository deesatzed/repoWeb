import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { z } from 'zod';
import { PortfolioWorkflowState } from '@prisma/client';

export const dynamic = 'force-dynamic';

// Backup schema validation
const BackupSchema = z.object({
  version: z.string(),
  exportedAt: z.string(),
  userId: z.string(),
  userEmail: z.string().optional(),
  settings: z
    .object({
      workflowState: z.nativeEnum(PortfolioWorkflowState).optional(),
      stateTransitionLog: z.any().optional(),
      displayName: z.string().optional().nullable(),
      bio: z.string().optional().nullable(),
      location: z.string().optional().nullable(),
      website: z.string().optional().nullable(),
      twitter: z.string().optional().nullable(),
      linkedin: z.string().optional().nullable(),
      theme: z.string().optional(),
      accentColor: z.string().optional(),
      featuredSection: z.any().optional(),
    })
    .optional()
    .nullable(),
  repositories: z.array(
    z.object({
      githubId: z.string(),
      name: z.string(),
      fullName: z.string(),
      isExcluded: z.boolean().optional(),
      isFeatured: z.boolean().optional(),
      sortOrder: z.number().optional(),
      customCategory: z.string().optional().nullable(),
      aiAnalysis: z.any().optional().nullable(),
    })
  ),
  projects: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional().nullable(),
      displayOrder: z.number().optional(),
      isVisible: z.boolean().optional(),
      repositories: z.array(
        z.object({
          id: z.string().optional(),
          fullName: z.string(),
        })
      ),
      aiAnalysis: z.any().optional().nullable(),
    })
  ),
});

/**
 * POST /api/portfolio/restore
 *
 * Restores portfolio data from JSON backup.
 * User requirement: "Should have a downloadable and uploadable json file"
 *
 * Strategy:
 * 1. Validate backup format
 * 2. Restore portfolio settings
 * 3. Match backup repos to current repos by githubId
 * 4. Restore AI analysis, exclusions, and metadata
 * 5. Restore projects and re-link repositories
 * 6. Restore workflow state
 */
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const userId = session.user.id;

    // Validate backup structure
    let backup;
    try {
      backup = BackupSchema.parse(body);
    } catch (validationError: any) {
      return NextResponse.json(
        {
          error: 'Invalid backup format',
          details: validationError.errors || validationError.message,
        },
        { status: 400 }
      );
    }

    const results = {
      settingsRestored: false,
      repositoriesMatched: 0,
      repositoriesUnmatched: 0,
      analysisRestored: 0,
      projectsRestored: 0,
      workflowStateRestored: false,
    };

    // 1. Restore Portfolio Settings
    if (backup.settings) {
      const settingsData: any = {
        displayName: backup.settings.displayName,
        bio: backup.settings.bio,
        location: backup.settings.location,
        website: backup.settings.website,
        twitter: backup.settings.twitter,
        linkedin: backup.settings.linkedin,
        theme: backup.settings.theme || 'dark',
        accentColor: backup.settings.accentColor || '#8B5CF6',
        workflowState: backup.settings.workflowState || 'INITIAL',
        stateTransitionLog: backup.settings.stateTransitionLog
          ? JSON.stringify(backup.settings.stateTransitionLog)
          : null,
        featuredSection: backup.settings.featuredSection
          ? JSON.stringify(backup.settings.featuredSection)
          : null,
      };

      await prisma.portfolioSettings.upsert({
        where: { userId },
        update: settingsData,
        create: {
          userId,
          ...settingsData,
        },
      });

      results.settingsRestored = true;
      results.workflowStateRestored = !!backup.settings.workflowState;
    }

    // 2. Fetch current repositories (must be synced from GitHub first)
    const currentRepos = await prisma.repository.findMany({
      where: {
        githubConnection: { userId },
      },
    });

    const repoMap = new Map(
      currentRepos.map((repo) => [repo.githubId.toString(), repo])
    );

    // 3. Restore repository metadata and AI analysis
    for (const backupRepo of backup.repositories) {
      const currentRepo = repoMap.get(backupRepo.githubId);

      if (!currentRepo) {
        results.repositoriesUnmatched++;
        continue;
      }

      results.repositoriesMatched++;

      // Restore repo metadata
      await prisma.repository.update({
        where: { id: currentRepo.id },
        data: {
          isExcluded: backupRepo.isExcluded ?? false,
          isFeatured: backupRepo.isFeatured ?? false,
          sortOrder: backupRepo.sortOrder ?? 0,
          customCategory: backupRepo.customCategory,
        },
      });

      // Restore AI analysis if exists
      if (backupRepo.aiAnalysis) {
        const analysisData = {
          complexityScore: backupRepo.aiAnalysis.complexityScore,
          codeQualityScore: backupRepo.aiAnalysis.codeQualityScore,
          projectType: backupRepo.aiAnalysis.projectType,
          techStack: JSON.stringify(backupRepo.aiAnalysis.techStack || []),
          keyFeatures: JSON.stringify(backupRepo.aiAnalysis.keyFeatures || []),
          strengths: JSON.stringify(backupRepo.aiAnalysis.strengths || []),
          architecturePatterns: JSON.stringify(
            backupRepo.aiAnalysis.architecturePatterns || []
          ),
          summary: backupRepo.aiAnalysis.summary,
          employerHighlights: backupRepo.aiAnalysis.employerHighlights,
          skillsDemonstrated: JSON.stringify(
            backupRepo.aiAnalysis.skillsDemonstrated || []
          ),
          linesOfCode: backupRepo.aiAnalysis.linesOfCode,
          fileCount: backupRepo.aiAnalysis.fileCount,
          hasTests: backupRepo.aiAnalysis.hasTests ?? false,
          hasDocumentation: backupRepo.aiAnalysis.hasDocumentation ?? false,
          hasCiCd: backupRepo.aiAnalysis.hasCiCd ?? false,
          contributionPattern: backupRepo.aiAnalysis.contributionPattern,
          citations: JSON.stringify(backupRepo.aiAnalysis.citations || []),
        };

        await prisma.aIAnalysis.upsert({
          where: { repositoryId: currentRepo.id },
          update: analysisData,
          create: {
            repositoryId: currentRepo.id,
            ...analysisData,
          },
        });

        results.analysisRestored++;
      }
    }

    // 4. Restore Projects
    // First, clear existing projects to avoid conflicts
    await prisma.project.deleteMany({
      where: { userId },
    });

    for (const backupProject of backup.projects) {
      // Match repositories by fullName
      const repoIds = backupProject.repositories
        .map((r) => {
          const matchedRepo = currentRepos.find((cr) => cr.fullName === r.fullName);
          return matchedRepo?.id;
        })
        .filter((id): id is string => !!id);

      const project = await prisma.project.create({
        data: {
          userId,
          name: backupProject.name,
          description: backupProject.description,
          displayOrder: backupProject.displayOrder ?? 0,
          isVisible: backupProject.isVisible ?? true,
          repositories: {
            connect: repoIds.map((id) => ({ id })),
          },
        },
      });

      // Restore project AI analysis if exists
      if (backupProject.aiAnalysis) {
        await prisma.projectAnalysis.create({
          data: {
            projectId: project.id,
            technicalSkills: JSON.stringify(
              backupProject.aiAnalysis.technicalSkills || []
            ),
            techStack: JSON.stringify(backupProject.aiAnalysis.techStack || []),
            designDecisions: backupProject.aiAnalysis.designDecisions,
            novelApproaches: backupProject.aiAnalysis.novelApproaches,
            testingStrategy: backupProject.aiAnalysis.testingStrategy,
            problemsSolved: backupProject.aiAnalysis.problemsSolved,
            skillDemonstration: backupProject.aiAnalysis.skillDemonstration,
            architectureInsights: backupProject.aiAnalysis.architectureInsights,
          },
        });
      }

      results.projectsRestored++;
    }

    return NextResponse.json({
      success: true,
      message: 'Portfolio restored successfully',
      results,
      backupMetadata: {
        version: backup.version,
        exportedAt: backup.exportedAt,
        originalUserId: backup.userId,
        originalEmail: backup.userEmail,
      },
    });
  } catch (error: any) {
    console.error('Restore error:', error);
    return NextResponse.json(
      { error: 'Failed to restore backup', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

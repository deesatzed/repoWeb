import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/portfolio/backup
 *
 * Creates a complete JSON backup of user's portfolio data.
 * User requirement: "Should have a downloadable and uploadable json file"
 *
 * Includes:
 * - Portfolio settings (with workflow state)
 * - GitHub connection info (username only, NOT token)
 * - Repositories (with AI analysis)
 * - Projects (with groupings and AI analysis)
 * - Metadata (export timestamp, version)
 */
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch all portfolio data
    const [settings, githubConnection, repositories, projects] = await Promise.all([
      prisma.portfolioSettings.findUnique({
        where: { userId },
      }),
      prisma.gitHubConnection.findUnique({
        where: { userId },
        select: {
          githubUsername: true,
          lastSyncedAt: true,
          // Explicitly exclude token from backup for security
        },
      }),
      prisma.repository.findMany({
        where: {
          githubConnection: { userId },
        },
        include: {
          aiAnalysis: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.project.findMany({
        where: { userId },
        include: {
          repositories: {
            select: {
              id: true,
              name: true,
              fullName: true,
            },
          },
          aiAnalysis: true,
        },
        orderBy: { displayOrder: 'asc' },
      }),
    ]);

    // Serialize BigInt fields to strings
    const serializedRepositories = repositories.map((repo) => ({
      ...repo,
      githubId: repo.githubId.toString(),
      aiAnalysis: repo.aiAnalysis
        ? {
            ...repo.aiAnalysis,
            // Parse JSON string fields back to arrays
            techStack: JSON.parse(repo.aiAnalysis.techStack || '[]'),
            keyFeatures: JSON.parse(repo.aiAnalysis.keyFeatures || '[]'),
            strengths: JSON.parse(repo.aiAnalysis.strengths || '[]'),
            architecturePatterns: JSON.parse(repo.aiAnalysis.architecturePatterns || '[]'),
            skillsDemonstrated: JSON.parse(repo.aiAnalysis.skillsDemonstrated || '[]'),
            citations: JSON.parse(repo.aiAnalysis.citations || '[]'),
          }
        : null,
    }));

    const serializedProjects = projects.map((proj) => ({
      ...proj,
      aiAnalysis: proj.aiAnalysis
        ? {
            ...proj.aiAnalysis,
            technicalSkills: JSON.parse(proj.aiAnalysis.technicalSkills || '[]'),
            techStack: JSON.parse(proj.aiAnalysis.techStack || '[]'),
          }
        : null,
    }));

    const backup = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      userId,
      userEmail: session.user.email,
      settings: settings
        ? {
            ...settings,
            featuredSection: settings.featuredSection
              ? JSON.parse(settings.featuredSection)
              : null,
            stateTransitionLog: settings.stateTransitionLog
              ? JSON.parse(settings.stateTransitionLog as string)
              : null,
          }
        : null,
      githubConnection,
      repositories: serializedRepositories,
      projects: serializedProjects,
      metadata: {
        repositoryCount: repositories.length,
        projectCount: projects.length,
        analyzedCount: repositories.filter((r) => r.aiAnalysis).length,
        currentWorkflowState: settings?.workflowState || 'INITIAL',
      },
    };

    // Return JSON with proper headers for download
    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="portfolio-backup-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error: any) {
    console.error('Backup error:', error);
    return NextResponse.json(
      { error: 'Failed to create backup', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

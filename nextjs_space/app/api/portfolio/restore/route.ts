import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const SINGLE_USER_ID = 'single-user';

/**
 * POST /api/portfolio/restore
 * Restores portfolio data from JSON backup.
 */
export async function POST(request: Request) {
  try {
    const backup = await request.json();

    if (!backup || !backup.version) {
      return NextResponse.json(
        { error: 'Invalid backup format' },
        { status: 400 }
      );
    }

    const results = {
      settingsRestored: false,
      repositoriesRestored: 0,
      projectsRestored: 0,
    };

    // Restore settings
    if (backup.settings) {
      await db.upsertSettings({
        userId: SINGLE_USER_ID,
        ...backup.settings,
      });
      results.settingsRestored = true;
    }

    // Restore repositories
    if (backup.repositories && Array.isArray(backup.repositories)) {
      for (const repo of backup.repositories) {
        await db.upsertRepository({
          ...repo,
          userId: SINGLE_USER_ID,
        });
        results.repositoriesRestored++;
      }
    }

    // Restore projects
    if (backup.projects && Array.isArray(backup.projects)) {
      for (const project of backup.projects) {
        await db.createProject({
          ...project,
          userId: SINGLE_USER_ID,
        });
        results.projectsRestored++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Portfolio restored successfully',
      results,
      backupMetadata: {
        version: backup.version,
        exportedAt: backup.exportedAt,
      },
    });
  } catch (error: any) {
    console.error('Restore error:', error);
    return NextResponse.json(
      { error: 'Failed to restore backup', details: error?.message },
      { status: 500 }
    );
  }
}

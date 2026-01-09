import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/storage';
import { auth } from '@/lib/auth';

const SINGLE_USER_ID = 'single-user';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { repositoryId, isExcluded } = await req.json();

    if (!repositoryId) {
      return NextResponse.json({ error: 'Repository ID is required' }, { status: 400 });
    }

    // Verify ownership
    const repositories = await db.getRepositories(SINGLE_USER_ID);
    const existingRepo = repositories.find(r => r.id === repositoryId);

    if (!existingRepo) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }

    // Update repository
    const repository = await db.updateRepository(repositoryId, { isExcluded: isExcluded ?? false });

    return NextResponse.json({ repository });
  } catch (error) {
    console.error('Error toggling repository exclusion:', error);
    return NextResponse.json(
      { error: 'Failed to update repository' },
      { status: 500 }
    );
  }
}

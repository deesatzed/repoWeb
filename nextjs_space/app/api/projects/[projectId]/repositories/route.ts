import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/storage';

const SINGLE_USER_ID = 'single-user';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { repositoryId } = await req.json();
    const { projectId } = await params;

    if (!repositoryId) {
      return NextResponse.json({ error: 'Repository ID is required' }, { status: 400 });
    }

    // Verify project ownership
    const project = await db.getProjectById(projectId);
    if (!project || project.userId !== SINGLE_USER_ID) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify repository ownership
    const repositories = await db.getRepositories(SINGLE_USER_ID);
    const repository = repositories.find(r => r.id === repositoryId);
    if (!repository) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }

    // Add repository to project
    const updatedRepository = await db.updateRepository(repositoryId, { projectId });

    return NextResponse.json({ repository: updatedRepository });
  } catch (error) {
    console.error('Error adding repository to project:', error);
    return NextResponse.json(
      { error: 'Failed to add repository to project' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const repositoryId = searchParams.get('repositoryId');
    const { projectId } = await params;

    if (!repositoryId) {
      return NextResponse.json({ error: 'Repository ID is required' }, { status: 400 });
    }

    // Verify project ownership
    const project = await db.getProjectById(projectId);
    if (!project || project.userId !== SINGLE_USER_ID) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Remove repository from project
    const updatedRepository = await db.updateRepository(repositoryId, { projectId: undefined });

    return NextResponse.json({ repository: updatedRepository });
  } catch (error) {
    console.error('Error removing repository from project:', error);
    return NextResponse.json(
      { error: 'Failed to remove repository from project' },
      { status: 500 }
    );
  }
}

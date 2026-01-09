import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/storage';

const SINGLE_USER_ID = 'single-user';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { name, description, repositoryIds, isVisible } = await req.json();
    const { projectId } = await params;

    // Verify project ownership
    const existingProject = await db.getProjectById(projectId);
    if (!existingProject || existingProject.userId !== SINGLE_USER_ID) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Update project
    const project = await db.updateProject(projectId, {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(isVisible !== undefined && { isVisible }),
    });

    // Update repository associations if provided
    if (repositoryIds !== undefined) {
      const repositories = await db.getRepositories(SINGLE_USER_ID);
      
      // Remove all existing associations
      for (const repo of repositories) {
        if (repo.projectId === projectId) {
          await db.updateRepository(repo.id, { projectId: undefined });
        }
      }

      // Add new associations
      for (const repoId of repositoryIds) {
        await db.updateRepository(repoId, { projectId });
      }
    }

    // Fetch updated project with repositories
    const updatedRepositories = await db.getRepositories(SINGLE_USER_ID);
    const updatedProject = {
      ...project,
      repositories: updatedRepositories.filter(r => r.projectId === projectId),
    };

    return NextResponse.json({ project: updatedProject });
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    // Verify project ownership
    const existingProject = await db.getProjectById(projectId);
    if (!existingProject || existingProject.userId !== SINGLE_USER_ID) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Delete project (repositories will be unlinked)
    await db.deleteProject(projectId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}

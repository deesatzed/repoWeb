import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/storage';

const SINGLE_USER_ID = 'single-user';

export async function GET(req: NextRequest) {
  try {
    const projects = await db.getProjects(SINGLE_USER_ID);
    const repositories = await db.getRepositories(SINGLE_USER_ID);

    const projectsWithRepos = projects.map(project => ({
      ...project,
      repositories: repositories.filter(repo => repo.projectId === project.id),
    }));

    return NextResponse.json({ projects: projectsWithRepos });
  } catch (error: any) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, description, repositoryIds } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const project = await db.createProject({
      userId: SINGLE_USER_ID,
      name,
      description,
      isVisible: true,
    });

    // Link repositories to project if provided
    if (repositoryIds && repositoryIds.length > 0) {
      for (const repoId of repositoryIds) {
        await db.updateRepository(repoId, { projectId: project.id });
      }
    }

    // Fetch updated project with repositories
    const repositories = await db.getRepositories(SINGLE_USER_ID);
    const updatedProject = {
      ...project,
      repositories: repositories.filter(repo => repo.projectId === project.id),
    };

    return NextResponse.json({ project: updatedProject });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}

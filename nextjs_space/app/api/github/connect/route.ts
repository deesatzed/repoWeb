export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { GitHubService } from '@/lib/github-api';
import { transitionWorkflowState } from '@/lib/workflow-state';

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!dbUser) {
      const isDev = process.env.NODE_ENV !== 'production';
      return NextResponse.json(
        {
          error: 'Unauthorized',
          ...(isDev
            ? {
                details: 'Session user not found in DB (stale session). Sign out and sign in again.',
                sessionUserId: session.user.id,
              }
            : null),
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { githubToken } = body ?? {};

    if (!githubToken) {
      return NextResponse.json(
        { error: 'GitHub token is required' },
        { status: 400 }
      );
    }

    // Verify token and get username
    const encryptedToken = encrypt(githubToken);
    const githubService = new GitHubService(encryptedToken);
    
    let githubUser;
    try {
      githubUser = await githubService.getAuthenticatedUser();
    } catch (error: any) {
      return NextResponse.json(
        { error: 'Invalid GitHub token' },
        { status: 400 }
      );
    }

    // Store or update GitHub connection
    const connection = await prisma.gitHubConnection.upsert({
      where: { userId: session.user.id },
      update: {
        githubUsername: githubUser?.login ?? '',
        githubToken: encryptedToken,
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        githubUsername: githubUser?.login ?? '',
        githubToken: encryptedToken,
      },
    });

    // Transition workflow state to CONNECTED
    await transitionWorkflowState(
      session.user.id,
      'CONNECTED',
      `Connected GitHub account: ${githubUser?.login}`
    );

    return NextResponse.json({
      success: true,
      githubUsername: githubUser?.login,
    });
  } catch (error: any) {
    console.error('GitHub connect error:', error);

    const isDev = process.env.NODE_ENV !== 'production';
    return NextResponse.json(
      {
        error: 'Failed to connect GitHub account',
        ...(isDev
          ? {
              details: error?.message ?? String(error),
              code: error?.code,
            }
          : null),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!dbUser) {
      const isDev = process.env.NODE_ENV !== 'production';
      return NextResponse.json(
        {
          error: 'Unauthorized',
          ...(isDev
            ? {
                details: 'Session user not found in DB (stale session). Sign out and sign in again.',
                sessionUserId: session.user.id,
              }
            : null),
        },
        { status: 401 }
      );
    }

    const connection = await prisma.gitHubConnection.findUnique({
      where: { userId: session.user.id },
    });

    if (!connection) {
      return NextResponse.json(
        { connected: false },
        { status: 200 }
      );
    }

    return NextResponse.json({
      connected: true,
      githubUsername: connection.githubUsername,
      lastSyncedAt: connection.lastSyncedAt,
    });
  } catch (error: any) {
    console.error('GitHub connection check error:', error);

    const isDev = process.env.NODE_ENV !== 'production';
    return NextResponse.json(
      {
        error: 'Failed to check GitHub connection',
        ...(isDev
          ? {
              details: error?.message ?? String(error),
              code: error?.code,
            }
          : null),
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { GitHubService } from '@/lib/github-api';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    return NextResponse.json({
      success: true,
      githubUsername: githubUser?.login,
    });
  } catch (error: any) {
    console.error('GitHub connect error:', error);
    return NextResponse.json(
      { error: 'Failed to connect GitHub account' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    return NextResponse.json(
      { error: 'Failed to check GitHub connection' },
      { status: 500 }
    );
  }
}

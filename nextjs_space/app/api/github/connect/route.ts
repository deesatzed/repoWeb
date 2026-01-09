export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';
import { encrypt } from '@/lib/encryption';
import { GitHubService } from '@/lib/github-api';

const SINGLE_USER_ID = 'single-user';

export async function POST(request: Request) {
  try {
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

    // Ensure user exists
    await db.upsertUser({ id: SINGLE_USER_ID, email: 'single-user@local' });

    // Store or update GitHub connection
    await db.upsertGitHubConnection({
      id: `conn_${SINGLE_USER_ID}`,
      userId: SINGLE_USER_ID,
      githubUsername: githubUser?.login ?? '',
      githubToken: encryptedToken,
    });

    return NextResponse.json({
      success: true,
      githubUsername: githubUser?.login,
    });
  } catch (error: any) {
    console.error('GitHub connect error:', error);
    return NextResponse.json(
      { error: 'Failed to connect GitHub account', details: error?.message },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const connection = await db.getGitHubConnection(SINGLE_USER_ID);

    if (!connection) {
      return NextResponse.json({ connected: false }, { status: 200 });
    }

    return NextResponse.json({
      connected: true,
      githubUsername: connection.githubUsername,
      lastSyncedAt: connection.lastSyncedAt,
    });
  } catch (error: any) {
    console.error('GitHub connection check error:', error);
    return NextResponse.json(
      { error: 'Failed to check GitHub connection', details: error?.message },
      { status: 500 }
    );
  }
}

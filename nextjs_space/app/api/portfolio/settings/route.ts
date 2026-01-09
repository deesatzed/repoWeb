export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';

const SINGLE_USER_ID = 'single-user';

export async function GET(request: Request) {
  try {
    const settings = await db.getSettings(SINGLE_USER_ID);

    if (!settings) {
      // Create default settings
      const newSettings = await db.upsertSettings({
        userId: SINGLE_USER_ID,
        hidePrivateRepoNames: false,
      });
      return NextResponse.json({ settings: newSettings });
    }

    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error('Fetch settings error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings', details: error?.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const updates = body ?? {};

    const settings = await db.upsertSettings({
      userId: SINGLE_USER_ID,
      hidePrivateRepoNames: updates.hidePrivateRepoNames ?? false,
      displayName: updates.displayName,
      bio: updates.bio,
      location: updates.location,
    });

    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error('Update settings error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings', details: error?.message },
      { status: 500 }
    );
  }
}

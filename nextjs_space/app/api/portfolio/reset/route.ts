import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/storage';

const SINGLE_USER_ID = 'single-user';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const confirm = String(body?.confirm ?? '');

    if (confirm !== 'NUKE') {
      return NextResponse.json(
        { error: 'Confirmation required' },
        { status: 400 }
      );
    }

    // Reset all data for single user
    await db.resetUserData(SINGLE_USER_ID);

    return NextResponse.json({ ok: true, message: 'Portfolio reset successfully' });
  } catch (error) {
    console.error('Error resetting portfolio:', error);
    return NextResponse.json(
      { error: 'Failed to reset portfolio' },
      { status: 500 }
    );
  }
}

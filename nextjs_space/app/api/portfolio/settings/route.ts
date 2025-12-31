export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/db';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await prisma.portfolioSettings.findUnique({
      where: { userId: session.user.id },
    });

    if (!settings) {
      // Create default settings
      const newSettings = await prisma.portfolioSettings.create({
        data: {
          userId: session.user.id,
        },
      });
      return NextResponse.json({ settings: newSettings });
    }

    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error('Fetch settings error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const updates = body ?? {};

    const settings = await prisma.portfolioSettings.upsert({
      where: { userId: session.user.id },
      update: updates,
      create: {
        userId: session.user.id,
        ...updates,
      },
    });

    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error('Update settings error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}

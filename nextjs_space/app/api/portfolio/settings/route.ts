export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';

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

    // Parse featuredSection if it exists
    const parsedSettings = {
      ...settings,
      featuredSection: settings.featuredSection ? JSON.parse(settings.featuredSection) : null,
    };

    return NextResponse.json({ settings: parsedSettings });
  } catch (error: any) {
    console.error('Fetch settings error:', error);
    const isDev = process.env.NODE_ENV !== 'production';
    return NextResponse.json(
      {
        error: 'Failed to fetch settings',
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
    const updates = body ?? {};

    // Stringify featuredSection if it's an object
    if (updates.featuredSection && typeof updates.featuredSection === 'object') {
      updates.featuredSection = JSON.stringify(updates.featuredSection);
    }

    const settings = await prisma.portfolioSettings.upsert({
      where: { userId: session.user.id },
      update: updates,
      create: {
        userId: session.user.id,
        ...updates,
      },
    });

    const parsedSettings = {
      ...settings,
      featuredSection: settings.featuredSection ? JSON.parse(settings.featuredSection) : null,
    };

    return NextResponse.json({ settings: parsedSettings });
  } catch (error: any) {
    console.error('Update settings error:', error);
    const isDev = process.env.NODE_ENV !== 'production';
    return NextResponse.json(
      {
        error: 'Failed to update settings',
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

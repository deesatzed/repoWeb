import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';

const SINGLE_USER_ID = 'single-user';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { hash: string } }
) {
  try {
    const hash = params.hash;

    if (!hash || !hash.startsWith('wp-')) {
      return NextResponse.json(
        { error: 'Invalid hash format' },
        { status: 400 }
      );
    }

    const repositories = await db.getRepositories(SINGLE_USER_ID);
    const repository = repositories.find(r => r.whitepaperHash === hash);

    if (!repository) {
      return NextResponse.json(
        { error: 'Whitepaper not found or invalid hash' },
        { status: 404 }
      );
    }

    if (!repository.protectedWhitepaper) {
      return NextResponse.json(
        { error: 'Protected whitepaper not generated yet' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      repository: {
        name: repository.name,
        displayName: repository.displayName,
        fullName: repository.fullName,
        description: repository.description,
        language: repository.language,
        htmlUrl: repository.htmlUrl,
      },
      whitepaper: repository.protectedWhitepaper,
    });
  } catch (error: any) {
    console.error('Protected whitepaper fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch protected whitepaper' },
      { status: 500 }
    );
  }
}

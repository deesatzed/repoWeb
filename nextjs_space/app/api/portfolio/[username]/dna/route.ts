
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { username: string } }
) {
  try {
    const username = params.username;

    // 1. Find the user and their repositories
    const user = await prisma.user.findFirst({
      where: {
        githubConnection: {
          githubUsername: {
            equals: username,
            mode: 'insensitive',
          },
        },
      },
      include: {
        githubConnection: {
          include: {
            repositories: {
              where: {
                isExcluded: false,
                isPrivate: false, // Only show DNA for public repos by default for now
              },
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.githubConnection) {
      return new NextResponse('User not found', { status: 404 });
    }

    const repoNames = user.githubConnection.repositories.map((r) => r.name);
    
    // Also include 'nextjs_space' for the demo if it's the owner (hack for local demo)
    // In a real app, we'd map this properly.
    if (username.toLowerCase() === 'o2satz' || username.toLowerCase() === 'demo') {
        repoNames.push('nextjs_space');
    }

    if (repoNames.length === 0) {
      return NextResponse.json({ assets: [] });
    }

    // 2. Fetch Code Assets linked to these repositories
    // We join via CodeAssetOccurrence.repoName
    const assets = await prisma.codeAsset.findMany({
      where: {
        occurrences: {
          some: {
            repoName: {
              in: repoNames,
            },
          },
        },
      },
      include: {
        occurrences: {
          where: {
            repoName: {
              in: repoNames,
            },
          },
          select: {
            repoName: true,
            filePath: true,
          },
        },
      },
      orderBy: {
        valueScore: 'desc',
      },
      take: 100, // Limit to top 100 diamonds
    });

    // 3. Transform for public consumption (Privacy: NO raw content)
    const publicAssets = assets.map((asset: typeof assets[0]) => ({
      id: asset.id,
      name: asset.name,
      type: asset.type,
      language: asset.language,
      complexity: asset.complexity,
      frequency: asset.frequency,
      valueScore: asset.valueScore,
      occurrences: asset.occurrences,
      // content: asset.content // REDACTED
    }));

    return NextResponse.json({ assets: publicAssets });
  } catch (error) {
    console.error('[DNA_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

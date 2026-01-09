
import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs/promises';
import { db } from '@/lib/storage';

const SINGLE_USER_ID = 'single-user';

export const dynamic = 'force-dynamic';

const PORTFOLIO_ROOT = process.env.PORTFOLIO_DATA_DIR
  ? path.resolve(process.env.PORTFOLIO_DATA_DIR)
  : path.join(process.cwd(), 'data', 'portfolio');

async function loadPortfolioJson(username: string) {
  try {
    const filePath = path.join(PORTFOLIO_ROOT, username, 'portfolio.json');
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    const jsonPortfolio = await loadPortfolioJson(username);
    if (jsonPortfolio) {
      return NextResponse.json({ assets: jsonPortfolio.assets ?? [] });
    }

    // 1. Find the user and their repositories
    const connection = await db.getGitHubConnection(SINGLE_USER_ID);
    if (!connection || connection.githubUsername !== username) {
      return new NextResponse('User not found', { status: 404 });
    }

    const repositories = await db.getRepositories(SINGLE_USER_ID);
    const repoNames = repositories
      .filter(r => !r.isExcluded && !r.isPrivate)
      .map(r => r.name);
    
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
    const assets = await db.getCodeAssets(repoNames);

    console.log(`[DNA_API] Found ${assets.length} assets`);

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


import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const username = 'deesatzed';
  
  // Check total assets
  const totalAssets = await prisma.codeAsset.count();
  console.log(`Total CodeAssets in DB: ${totalAssets}`);

  // Check repositories for user
  const user = await prisma.user.findFirst({
    where: {
      githubConnection: {
        githubUsername: {
          equals: username,
        },
      },
    },
    include: {
      githubConnection: {
        include: {
          repositories: {
            select: { name: true, isPrivate: true, isExcluded: true }
          }
        }
      }
    }
  });

  if (user?.githubConnection) {
    const repos = user.githubConnection.repositories;
    console.log(`Total repos for ${username}: ${repos.length}`);
    const publicRepos = repos.filter((r: any) => !r.isPrivate);
    console.log(`Public repos: ${publicRepos.length}`);
    const privateRepos = repos.filter((r: any) => r.isPrivate);
    console.log(`Private repos: ${privateRepos.length}`);
    
    // Check if any assets are linked to these repos
    const repoNames = repos.map((r: any) => r.name);
    const linkedAssets = await prisma.codeAssetOccurrence.count({
      where: {
        repoName: { in: repoNames }
      }
    });
    console.log(`Assets linked to user's repos: ${linkedAssets}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

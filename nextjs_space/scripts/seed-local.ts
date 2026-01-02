
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding local database for deesatzed...');

  // 1. Create User
  const email = 'wayne@example.com';
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password: hashedPassword,
      name: 'Wayne Satz',
      image: 'https://avatars.githubusercontent.com/u/10826353?v=4',
    },
  });

  console.log('User created:', user.id);

  // 2. Create GitHub Connection
  const connection = await prisma.gitHubConnection.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      githubUsername: 'deesatzed',
      githubToken: 'mock-token',
      lastSyncedAt: new Date(),
    },
  });

  console.log('GitHub Connection created');

  // 3. Create Repositories
  const repo1 = await prisma.repository.create({
    data: {
      githubConnectionId: connection.id,
      githubId: 123456789n,
      name: 'nextjs_space',
      fullName: 'deesatzed/nextjs_space',
      htmlUrl: 'https://github.com/deesatzed/nextjs_space',
      isPrivate: false,
      isFork: false,
      isExcluded: false,
      defaultBranch: 'main',
      topics: '[]',
      description: 'A portfolio showcase using Next.js',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  });

  const repo2 = await prisma.repository.create({
    data: {
      githubConnectionId: connection.id,
      githubId: 987654321n,
      name: 'demo-project',
      fullName: 'deesatzed/demo-project',
      htmlUrl: 'https://github.com/deesatzed/demo-project',
      isPrivate: false,
      isFork: false,
      isExcluded: false,
      defaultBranch: 'main',
      topics: '[]',
      description: 'A demo project',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  });

  console.log('Repositories created');

  // 4. Create Code Assets (Engineering DNA)
  // Asset 1: React Component
  const asset1 = await prisma.codeAsset.create({
    data: {
      fingerprint: 'sha256-hash-1',
      name: 'DashboardClient',
      type: 'component',
      content: 'export default function DashboardClient() { ... }',
      language: 'TypeScript',
      complexity: 15,
      frequency: 5,
      valueScore: 45.0, // (15^2) / (5+1) = 225 / 6 = 37.5
      occurrences: {
        create: {
          repoName: 'nextjs_space',
          filePath: 'app/dashboard/_components/dashboard-client.tsx',
          repositoryId: repo1.id,
        }
      }
    }
  });

  // Asset 2: Utility Function
  const asset2 = await prisma.codeAsset.create({
    data: {
      fingerprint: 'sha256-hash-2',
      name: 'calculateComplexity',
      type: 'function',
      content: 'function calculateComplexity() { ... }',
      language: 'TypeScript',
      complexity: 8,
      frequency: 12,
      valueScore: 10.0,
      occurrences: {
        create: {
          repoName: 'nextjs_space',
          filePath: 'lib/analysis.ts',
          repositoryId: repo1.id,
        }
      }
    }
  });

    // Asset 3: Python Script
  const asset3 = await prisma.codeAsset.create({
    data: {
      fingerprint: 'sha256-hash-3',
      name: 'process_data',
      type: 'function',
      content: 'def process_data(): ...',
      language: 'Python',
      complexity: 25,
      frequency: 2,
      valueScore: 208.33,
      occurrences: {
        create: {
          repoName: 'demo-project',
          filePath: 'scripts/process.py',
          repositoryId: repo2.id,
        }
      }
    }
  });

  console.log('Code Assets created');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

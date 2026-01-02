
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const username = 'deesatzed';
  console.log(`Checking for GitHub connection with username: ${username}`);

  const connection = await prisma.gitHubConnection.findFirst({
    where: { githubUsername: username },
    include: {
      user: true,
      repositories: {
        select: { id: true, name: true }
      }
    }
  });

  if (connection) {
    console.log('✅ Found Connection!');
    console.log(`User ID: ${connection.userId}`);
    console.log(`GitHub Username: ${connection.githubUsername}`);
    console.log(`Linked User Name: ${connection.user.name}`);
    console.log(`Repository Count: ${connection.repositories.length}`);
  } else {
    console.log('❌ Connection not found for username:', username);
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

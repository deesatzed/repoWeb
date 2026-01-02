
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: { githubConnection: true }
  });
  console.log('Users found:', users.length);
  users.forEach(u => {
    console.log(`- User: ${u.name} (${u.email})`);
    console.log(`  GitHub: ${u.githubConnection?.githubUsername || 'Not connected'}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());

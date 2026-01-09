import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DashboardClient from './_components/dashboard-client';

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect('/auth/signin?callbackUrl=/dashboard');
  }

  return <DashboardClient />;
}

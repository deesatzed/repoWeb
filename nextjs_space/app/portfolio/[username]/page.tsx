import { notFound } from 'next/navigation';
import PortfolioClient from './_components/portfolio-client';

export const dynamic = 'force-dynamic';

interface PortfolioPageProps {
  params: { username: string };
}

async function getPortfolioData(username: string) {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/portfolio/${username}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error: any) {
    console.error('Failed to fetch portfolio:', error);
    return null;
  }
}

export async function generateMetadata({ params }: PortfolioPageProps) {
  const data = await getPortfolioData(params?.username ?? '');

  if (!data) {
    return {
      title: 'Portfolio Not Found',
    };
  }

  return {
    title: `${data?.githubUsername ?? 'Developer'}'s Portfolio | DevShowcase`,
    description: `Check out ${data?.githubUsername ?? 'this developer'}'s impressive GitHub portfolio with AI-powered insights`,
  };
}

export default async function PortfolioPage({ params }: PortfolioPageProps) {
  const data = await getPortfolioData(params?.username ?? '');

  if (!data) {
    notFound();
  }

  return <PortfolioClient data={data} />;
}

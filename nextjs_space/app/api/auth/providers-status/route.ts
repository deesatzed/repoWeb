import { NextResponse } from 'next/server';

export async function GET() {
  // Check if OAuth providers are properly configured
  const githubConfigured = 
    process.env.GITHUB_CLIENT_ID && 
    process.env.GITHUB_CLIENT_ID !== 'placeholder-github-client-id' &&
    process.env.GITHUB_CLIENT_SECRET && 
    process.env.GITHUB_CLIENT_SECRET !== 'placeholder-github-client-secret';

  const googleConfigured = 
    process.env.GOOGLE_CLIENT_ID && 
    process.env.GOOGLE_CLIENT_ID !== 'placeholder-google-client-id' &&
    process.env.GOOGLE_CLIENT_SECRET && 
    process.env.GOOGLE_CLIENT_SECRET !== 'placeholder-google-client-secret';

  return NextResponse.json({
    github: githubConfigured,
    google: googleConfigured,
  });
}

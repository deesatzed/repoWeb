import { NextResponse } from 'next/server';

// Signup not needed in single-user mode
export async function POST(request: Request) {
  return NextResponse.json(
    { message: 'Single-user mode - signup not required. Use the dashboard directly.' },
    { status: 200 }
  );
}

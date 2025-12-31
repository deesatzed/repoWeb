import { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import bcrypt from 'bcryptjs';
import prisma from './db';
import { encrypt } from './encryption';

// Check if OAuth providers are properly configured
const isGitHubConfigured = 
  process.env.GITHUB_CLIENT_ID && 
  process.env.GITHUB_CLIENT_ID !== 'placeholder-github-client-id' &&
  process.env.GITHUB_CLIENT_SECRET && 
  process.env.GITHUB_CLIENT_SECRET !== 'placeholder-github-client-secret';

const isGoogleConfigured = 
  process.env.GOOGLE_CLIENT_ID && 
  process.env.GOOGLE_CLIENT_ID !== 'placeholder-google-client-id' &&
  process.env.GOOGLE_CLIENT_SECRET && 
  process.env.GOOGLE_CLIENT_SECRET !== 'placeholder-google-client-secret';

// Build providers array conditionally
const providers: any[] = [];

// Only add GitHub provider if properly configured
if (isGitHubConfigured) {
  providers.push(
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'read:user user:email repo',
        },
      },
      allowDangerousEmailAccountLinking: true,
    })
  );
}

// Only add Google provider if properly configured
if (isGoogleConfigured) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    })
  );
}

// Always add credentials provider (email/password)
providers.push(
  CredentialsProvider({
    name: 'credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        throw new Error('Invalid credentials');
      }

      const user = await prisma.user.findUnique({
        where: { email: credentials.email },
      });

      if (!user || !user?.password) {
        throw new Error('Invalid credentials');
      }

      const isCorrectPassword = await bcrypt.compare(
        credentials.password,
        user.password
      );

      if (!isCorrectPassword) {
        throw new Error('Invalid credentials');
      }

      return {
        id: user.id,
        email: user.email ?? '',
        name: user.name ?? '',
        image: user.image ?? undefined,
      };
    },
  })
);

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
  },
  providers: providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      // Auto-create GitHubConnection when user signs in with GitHub
      if (account?.provider === 'github' && account?.access_token && user?.email) {
        try {
          // Find the user in database
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email },
            include: { githubConnection: true },
          });

          if (dbUser) {
            // Get GitHub username from profile
            const githubUsername = (profile as any)?.login || user.name || '';

            // Check if GitHubConnection already exists
            if (!dbUser.githubConnection) {
              // Create new GitHubConnection with encrypted token
              const encryptedToken = encrypt(account.access_token);
              
              await prisma.gitHubConnection.create({
                data: {
                  userId: dbUser.id,
                  githubUsername,
                  githubToken: encryptedToken,
                },
              });
            } else {
              // Update existing GitHubConnection with new token
              const encryptedToken = encrypt(account.access_token);
              
              await prisma.gitHubConnection.update({
                where: { id: dbUser.githubConnection.id },
                data: {
                  githubToken: encryptedToken,
                  githubUsername,
                  lastSyncedAt: null, // Reset to trigger re-sync
                },
              });
            }
          }
        } catch (error) {
          console.error('Error creating GitHubConnection:', error);
          // Don't fail sign-in if GitHub connection fails
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session?.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

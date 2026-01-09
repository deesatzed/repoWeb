import type { NextAuthConfig } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

// Single-user mode - simplified auth that always succeeds
const SINGLE_USER = {
  id: 'single-user',
  email: 'user@portfolio.local',
  name: 'Portfolio User',
};

export const authOptions: NextAuthConfig = {
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials): Promise<any> {
        const email = String(credentials?.email ?? '').trim().toLowerCase();
        const password = String(credentials?.password ?? '');

        const adminEmail = String(process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
        const adminPassword = String(process.env.ADMIN_PASSWORD ?? '');
        const adminPasswordHash = String(process.env.ADMIN_PASSWORD_HASH ?? '');

        // In production, fail closed if not configured.
        if (process.env.NODE_ENV === 'production' && (!adminEmail || (!adminPassword && !adminPasswordHash))) {
          return null;
        }

        // If admin creds are configured, enforce them.
        if (adminEmail) {
          if (email !== adminEmail) return null;

          if (adminPasswordHash) {
            const ok = await bcrypt.compare(password, adminPasswordHash);
            if (!ok) return null;
          } else if (adminPassword) {
            if (password !== adminPassword) return null;
          } else {
            return null;
          }

          return {
            ...SINGLE_USER,
            email: adminEmail,
          };
        }

        // Dev-only fallback.
        return SINGLE_USER;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
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

import { PrismaAdapter } from '@next-auth/prisma-adapter';
import type { AuthOptions } from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: { signIn: '/' },
  providers: [
    EmailProvider({
      from: process.env.MAGIC_EMAIL_FROM ?? 'no-reply@dune.local',
      sendVerificationRequest: async ({ identifier, url }) => {
        console.info(`Magic link for ${identifier}: ${url}`);
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role ?? 'ADULT';
        token.sub = user.id;
      }
      if (!token.role && token.sub) {
        const dbUser = await prisma.user.findUnique({ where: { id: token.sub } });
        token.role = dbUser?.role ?? 'ADULT';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = (token.role as string) ?? 'ADULT';
      }
      const secret = process.env.JWT_SECRET ?? process.env.NEXTAUTH_SECRET;
      if (secret && token.sub) {
        session.apiToken = jwt.sign(
          {
            sub: token.sub,
            role: token.role,
            email: token.email
          },
          secret,
          { expiresIn: '1h' }
        );
      }
      return session;
    }
  },
  events: {
    async createUser({ user }) {
      await prisma.profile.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          display: user.email?.split('@')[0] ?? 'Utilisateur',
          status: 'online',
          nightStart: 1380,
          nightEnd: 300
        }
      });
      await prisma.wallet.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id, coins: 500 }
      });
    }
  }
};

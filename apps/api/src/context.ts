import type { inferAsyncReturnType } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma.js';

export type AuthClaims = {
  sub: string;
  role?: string;
  email?: string;
};

export async function createContext({ req }: CreateExpressContextOptions) {
  const header = req.headers.authorization;
  let userId: string | null = null;
  let role: string | null = null;

  if (header?.startsWith('Bearer ')) {
    const token = header.split(' ')[1];
    try {
      const secret = process.env.JWT_SECRET ?? process.env.NEXTAUTH_SECRET;
      if (!secret) {
        throw new Error('JWT secret missing');
      }
      const decoded = jwt.verify(token, secret) as AuthClaims;
      if (decoded.sub) {
        userId = decoded.sub;
        role = decoded.role ?? null;
      }
    } catch (err) {
      console.warn('Invalid auth token', err);
    }
  }

  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        include: {
          profile: true,
          wallet: true
        }
      })
    : null;

  return {
    prisma,
    user,
    role: role ?? user?.role ?? null
  };
}

export type AppContext = inferAsyncReturnType<typeof createContext>;

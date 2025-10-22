import { randomUUID } from 'node:crypto';
import { addMinutes } from 'date-fns';
import { z } from 'zod';
import { router, procedure } from '../trpc.js';

export const authRouter = router({
  loginMagic: procedure
    .input(
      z.object({
        email: z.string().email(),
        locale: z.string().optional()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const email = input.email.toLowerCase();
      const expires = addMinutes(new Date(), 15);
      const token = randomUUID();

      const user = await ctx.prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          role: 'ADULT'
        }
      });

      await ctx.prisma.profile.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          display: email.split('@')[0],
          status: 'offline'
        }
      });

      await ctx.prisma.wallet.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id, coins: 500 }
      });

      await ctx.prisma.verificationToken.create({
        data: {
          identifier: email,
          token,
          expires
        }
      });

      const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
      const url = `${baseUrl}/api/auth/callback/email?token=${token}&email=${encodeURIComponent(email)}`;

      console.info(`Magic link for ${email}: ${url}`);

      return {
        ok: true,
        expires,
        message: 'Magic link generated. Check server logs to continue login.'
      };
    })
});

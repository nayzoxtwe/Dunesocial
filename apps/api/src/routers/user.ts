import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc.js';

const profileInput = z.object({
  display: z.string().min(2).max(40),
  bio: z.string().max(160).optional(),
  status: z.enum(['online', 'offline', 'busy']).optional(),
  nightStart: z.number().min(0).max(1440).nullable().optional(),
  nightEnd: z.number().min(0).max(1440).nullable().optional()
});

export const userRouter = router({
  me: authenticatedProcedure.query(async ({ ctx }) => {
    const friends = await ctx.prisma.friend.findMany({
      where: { OR: [{ aId: ctx.user.id }, { bId: ctx.user.id }], state: 'ACCEPTED' },
      include: { A: { include: { profile: true } }, B: { include: { profile: true } } }
    });

    const wallet = await ctx.prisma.wallet.upsert({
      where: { userId: ctx.user.id },
      update: {},
      create: { userId: ctx.user.id, coins: 500 }
    });

    return {
      user: ctx.user,
      profile: ctx.user.profile,
      wallet,
      friends: friends.map((friend) => {
        const other = friend.aId === ctx.user.id ? friend.B : friend.A;
        return {
          id: other.id,
          display: other.profile?.display ?? other.email,
          status: other.profile?.status ?? 'offline'
        };
      })
    };
  }),
  updateProfile: authenticatedProcedure.input(profileInput).mutation(async ({ ctx, input }) => {
    const profile = await ctx.prisma.profile.upsert({
      where: { userId: ctx.user.id },
      update: {
        display: input.display,
        bio: input.bio,
        status: input.status ?? ctx.user.profile?.status ?? 'online',
        nightStart: input.nightStart ?? ctx.user.profile?.nightStart ?? null,
        nightEnd: input.nightEnd ?? ctx.user.profile?.nightEnd ?? null
      },
      create: {
        userId: ctx.user.id,
        display: input.display,
        bio: input.bio,
        status: input.status ?? 'online',
        nightStart: input.nightStart ?? null,
        nightEnd: input.nightEnd ?? null
      }
    });

    return profile;
  })
});

import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc.js';
import { broadcastPresence } from '../utils/presence.js';

export const presenceRouter = router({
  set: authenticatedProcedure
    .input(z.object({ status: z.enum(['online', 'offline', 'busy']) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.profile.upsert({
        where: { userId: ctx.user.id },
        update: {
          status: input.status,
          lastActiveAt: new Date()
        },
        create: {
          userId: ctx.user.id,
          display: ctx.user.profile?.display ?? ctx.user.email.split('@')[0],
          status: input.status,
          lastActiveAt: new Date()
        }
      });

      await broadcastPresence(ctx.prisma, ctx.user.id, input.status);

      return { status: input.status };
    })
});

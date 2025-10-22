import { z } from 'zod';
import { emitToUser } from '../socket.js';
import { authenticatedProcedure, router } from '../trpc.js';

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

      emitToUser(ctx.user.id, 'presence:update', { userId: ctx.user.id, status: input.status });

      return { status: input.status };
    })
});

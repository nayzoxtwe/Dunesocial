import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc.js';

const minutesSchema = z.number().int().min(0).max(1439);

export const parentRouter = router({
  setNightWindow: authenticatedProcedure
    .input(
      z.object({
        childId: z.string(),
        start: minutesSchema,
        end: minutesSchema
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'PARENT') {
        throw new Error('Only parents can adjust night mode');
      }

      const child = await ctx.prisma.user.findUnique({ where: { id: input.childId }, include: { profile: true } });
      if (!child || child.role !== 'TEEN') {
        throw new Error('Child not found or not a teen');
      }

      const link = await ctx.prisma.parentalLink.upsert({
        where: { childId_parentId: { childId: input.childId, parentId: ctx.user.id } },
        update: {
          nightStart: input.start,
          nightEnd: input.end
        },
        create: {
          childId: input.childId,
          parentId: ctx.user.id,
          nightStart: input.start,
          nightEnd: input.end,
          teenCoinCap: 1000
        }
      });

      await ctx.prisma.profile.upsert({
        where: { userId: input.childId },
        update: {
          nightStart: input.start,
          nightEnd: input.end
        },
        create: {
          userId: input.childId,
          display: child.email.split('@')[0],
          status: 'offline',
          nightStart: input.start,
          nightEnd: input.end
        }
      });

      return link;
    })
});

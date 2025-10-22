import { startOfMonth } from 'date-fns';
import { z } from 'zod';
import { emitToUser } from '../socket.js';
import { authenticatedProcedure, router } from '../trpc.js';

const TEEN_CAP = 1000;

export const walletRouter = router({
  get: authenticatedProcedure.query(async ({ ctx }) => {
    const wallet = await ctx.prisma.wallet.upsert({
      where: { userId: ctx.user.id },
      update: {},
      create: { userId: ctx.user.id, coins: 500 }
    });

    const transfers = await ctx.prisma.transfer.findMany({
      where: {
        OR: [{ fromId: ctx.user.id }, { toId: ctx.user.id }]
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return { wallet, transfers };
  }),
  transfer: authenticatedProcedure
    .input(
      z.object({
        toId: z.string(),
        coins: z.number().int().min(1),
        memo: z.string().max(120).optional()
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.toId === ctx.user.id) {
        throw new Error('Cannot transfer to self');
      }

      const [senderWallet, recipientWallet, recipient] = await Promise.all([
        ctx.prisma.wallet.upsert({
          where: { userId: ctx.user.id },
          update: {},
          create: { userId: ctx.user.id, coins: 500 }
        }),
        ctx.prisma.wallet.upsert({
          where: { userId: input.toId },
          update: {},
          create: { userId: input.toId, coins: 500 }
        }),
        ctx.prisma.user.findUnique({ where: { id: input.toId } })
      ]);

      if (!recipient) {
        throw new Error('Recipient not found');
      }

      if (senderWallet.coins < input.coins) {
        throw new Error('Insufficient balance');
      }

      if (ctx.user.role === 'TEEN') {
        const monthStart = startOfMonth(new Date());
        const totalSent = await ctx.prisma.transfer.aggregate({
          where: {
            fromId: ctx.user.id,
            createdAt: { gte: monthStart }
          },
          _sum: { coins: true }
        });
        const alreadySent = totalSent._sum.coins ?? 0;
        if (alreadySent + input.coins > TEEN_CAP) {
          throw new Error('Teen monthly cap exceeded');
        }
      }

      const [updatedSender, updatedRecipient, transfer] = await ctx.prisma.$transaction([
        ctx.prisma.wallet.update({
          where: { userId: ctx.user.id },
          data: { coins: { decrement: input.coins } }
        }),
        ctx.prisma.wallet.update({
          where: { userId: input.toId },
          data: { coins: { increment: input.coins } }
        }),
        ctx.prisma.transfer.create({
          data: {
            fromId: ctx.user.id,
            toId: input.toId,
            coins: input.coins,
            memo: input.memo
          }
        })
      ]);

      emitToUser(ctx.user.id, 'wallet:update', { balance: updatedSender.coins });
      emitToUser(input.toId, 'wallet:update', { balance: updatedRecipient.coins });

      return {
        balance: updatedSender.coins,
        recipientBalance: updatedRecipient.coins,
        transfer
      };
    })
});

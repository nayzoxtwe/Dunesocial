import { createHmac, randomUUID } from 'node:crypto';
import QRCode from 'qrcode';
import { addMinutes } from 'date-fns';
import { z } from 'zod';
import { emitToUser } from '../socket.js';
import { authenticatedProcedure, router } from '../trpc.js';
import { getConversationSummary } from '../utils/conversation.js';

const secret = () => {
  const value = process.env.QR_SECRET ?? process.env.JWT_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!value) {
    throw new Error('QR secret missing');
  }
  return value;
};

export const friendsRouter = router({
  issueQR: authenticatedProcedure.mutation(async ({ ctx }) => {
    const profile = ctx.user.profile ??
      (await ctx.prisma.profile.upsert({
        where: { userId: ctx.user.id },
        update: {},
        create: {
          userId: ctx.user.id,
          display: ctx.user.email.split('@')[0],
          status: 'online'
        }
      }));

    const device = await ctx.prisma.device.upsert({
      where: { userId: ctx.user.id },
      update: { pubKey: randomUUID() },
      create: {
        userId: ctx.user.id,
        pubKey: randomUUID()
      }
    });

    const payload = {
      uid: ctx.user.id,
      display: profile.display,
      pubKey: device.pubKey,
      ts: new Date().toISOString()
    };

    const payloadString = JSON.stringify(payload);
    const signature = createHmac('sha256', secret()).update(payloadString).digest('hex');

    const expiresAt = addMinutes(new Date(), 10);

    await ctx.prisma.qRInvite.create({
      data: {
        ownerId: ctx.user.id,
        payload: payloadString,
        signature,
        expiresAt
      }
    });

    const qrValue = JSON.stringify({ payload: payloadString, signature });
    const qrPng = await QRCode.toDataURL(qrValue);

    return { qrPng, payload: payloadString, signature, expiresAt };
  }),
  acceptQR: authenticatedProcedure
    .input(
      z.object({
        payload: z.string(),
        signature: z.string()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const expected = createHmac('sha256', secret()).update(input.payload).digest('hex');
      if (expected !== input.signature) {
        throw new Error('Invalid QR signature');
      }

      const parsed = JSON.parse(input.payload) as { uid: string; display: string; pubKey: string };
      if (!parsed.uid || parsed.uid === ctx.user.id) {
        throw new Error('Invalid QR payload');
      }

      const invite = await ctx.prisma.qRInvite.findFirst({
        where: { payload: input.payload, signature: input.signature }
      });

      if (!invite || invite.expiresAt < new Date()) {
        throw new Error('QR code expired');
      }

      const [aId, bId] = [ctx.user.id, parsed.uid].sort();
      const dmKey = `${aId}:${bId}`;

      const existing = await ctx.prisma.friend.findFirst({ where: { aId, bId } });

      if (existing) {
        if (existing.state !== 'ACCEPTED') {
          await ctx.prisma.friend.update({ where: { id: existing.id }, data: { state: 'ACCEPTED' } });
        }
      } else {
        await ctx.prisma.friend.create({
          data: {
            aId,
            bId,
            state: 'ACCEPTED'
          }
        });
      }

      const conversation = await ctx.prisma.conversation.upsert({
        where: { dmKey },
        update: {},
        create: {
          type: 'DM',
          createdBy: ctx.user.id,
          dmKey,
          members: {
            createMany: {
              data: [
                { userId: aId, role: 'member' },
                { userId: bId, role: 'member' }
              ],
              skipDuplicates: true
            }
          }
        },
        include: {
          members: true
        }
      });

      const [selfSummary, otherSummary] = await Promise.all([
        getConversationSummary(ctx.prisma, conversation.id, ctx.user.id),
        getConversationSummary(ctx.prisma, conversation.id, parsed.uid)
      ]);

      if (selfSummary) {
        emitToUser(ctx.user.id, 'conversation:created', selfSummary);
      }
      if (otherSummary) {
        emitToUser(parsed.uid, 'conversation:created', otherSummary);
      }

      return { ok: true, conversationId: conversation.id };
    })
});

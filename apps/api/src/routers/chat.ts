import { z } from 'zod';
import { emitToConversation, emitToUser } from '../socket.js';
import { authenticatedProcedure, router } from '../trpc.js';
import {
  getConversationSummary,
  listConversationSummaries
} from '../utils/conversation.js';

const messageKinds = ['text', 'image', 'gif', 'sticker', 'voice'] as const;

export const chatRouter = router({
  createDM: authenticatedProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const otherUser = await ctx.prisma.user.findUnique({ where: { id: input.userId }, include: { profile: true } });
      if (!otherUser) {
        throw new Error('User not found');
      }

      const [aId, bId] = [ctx.user.id, otherUser.id].sort();
      const dmKey = `${aId}:${bId}`;

      await ctx.prisma.friend.upsert({
        where: { aId_bId: { aId, bId } },
        update: { state: 'ACCEPTED' },
        create: { aId, bId, state: 'ACCEPTED' }
      });

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
                { userId: ctx.user.id, role: 'member' },
                { userId: otherUser.id, role: 'member' }
              ],
              skipDuplicates: true
            }
          }
        }
      });

      const [selfSummary, otherSummary] = await Promise.all([
        getConversationSummary(ctx.prisma, conversation.id, ctx.user.id),
        getConversationSummary(ctx.prisma, conversation.id, otherUser.id)
      ]);

      if (selfSummary) {
        emitToUser(ctx.user.id, 'conversation:created', selfSummary);
      }
      if (otherSummary) {
        emitToUser(otherUser.id, 'conversation:created', otherSummary);
      }

      return { id: conversation.id };
    }),
  list: authenticatedProcedure.query(async ({ ctx }) => {
    return listConversationSummaries(ctx.prisma, ctx.user.id);
  }),
  history: authenticatedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        cursor: z.string().nullish(),
        limit: z.number().min(1).max(50).default(20)
      })
    )
    .query(async ({ ctx, input }) => {
      const messages = await ctx.prisma.message.findMany({
        where: { convId: input.conversationId },
        take: input.limit,
        skip: input.cursor ? 1 : 0,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: {
            include: { profile: true }
          }
        }
      });

      const nextCursor = messages.length === input.limit ? messages[messages.length - 1]?.id : undefined;

      return {
        items: messages.reverse().map((message) => ({
          id: message.id,
          createdAt: message.createdAt,
          kind: message.kind,
          text: message.text,
          mediaUrl: message.mediaUrl,
          sender: {
            id: message.sender.id,
            display: message.sender.profile?.display ?? message.sender.email
          }
        })),
        nextCursor
      };
    }),
  send: authenticatedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        kind: z.enum(messageKinds).default('text'),
        text: z.string().max(4000).optional(),
        mediaUrl: z.string().url().optional()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.member.findFirst({
        where: {
          convId: input.conversationId,
          userId: ctx.user.id
        }
      });

      if (!member) {
        throw new Error('Not a conversation member');
      }

      const message = await ctx.prisma.message.create({
        data: {
          convId: input.conversationId,
          senderId: ctx.user.id,
          kind: input.kind,
          text: input.text,
          mediaUrl: input.mediaUrl
        },
        include: {
          sender: {
            include: { profile: true }
          }
        }
      });

      await ctx.prisma.conversation.update({
        where: { id: input.conversationId },
        data: { updatedAt: new Date() }
      });

      emitToConversation(input.conversationId, 'message:new', {
        id: message.id,
        conversationId: input.conversationId,
        kind: message.kind,
        text: message.text,
        mediaUrl: message.mediaUrl,
        createdAt: message.createdAt,
        sender: {
          id: message.sender.id,
          display: message.sender.profile?.display ?? message.sender.email
        }
      });

      return { id: message.id };
    })
});

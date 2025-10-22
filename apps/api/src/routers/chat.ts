import { z } from 'zod';
import { emitToConversation } from '../socket.js';
import { authenticatedProcedure, router } from '../trpc.js';

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
              ]
            }
          }
        }
      });

      return { id: conversation.id };
    }),
  list: authenticatedProcedure.query(async ({ ctx }) => {
    const conversations = await ctx.prisma.conversation.findMany({
      where: {
        members: {
          some: { userId: ctx.user.id }
        }
      },
      include: {
        members: {
          include: {
            user: {
              include: { profile: true }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              include: { profile: true }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return conversations.map((conversation) => {
      const lastMessage = conversation.messages[0];
      const otherMember = conversation.members.find((member) => member.userId !== ctx.user.id);
      return {
        id: conversation.id,
        type: conversation.type,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              text: lastMessage.text,
              createdAt: lastMessage.createdAt,
              sender: {
                id: lastMessage.sender.id,
                display: lastMessage.sender.profile?.display ?? lastMessage.sender.email
              }
            }
          : null,
        participant: otherMember
          ? {
              id: otherMember.user.id,
              display: otherMember.user.profile?.display ?? otherMember.user.email,
              status: otherMember.user.profile?.status ?? 'offline'
            }
          : null
      };
    });
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

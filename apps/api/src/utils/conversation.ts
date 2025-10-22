import type { PrismaClient } from '@prisma/client';

export type ConversationSummary = {
  id: string;
  type: string;
  lastMessage: {
    id: string;
    text: string | null;
    createdAt: Date;
    sender: { id: string; display: string };
  } | null;
  participant: {
    id: string;
    display: string;
    status: string | null;
  } | null;
};

type ConversationWithRelations = NonNullable<
  Awaited<ReturnType<typeof fetchConversationWithRelations>>
>;

async function fetchConversationWithRelations(prisma: PrismaClient, id: string) {
  return prisma.conversation.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: {
            include: {
              profile: true
            }
          }
        }
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          sender: {
            include: {
              profile: true
            }
          }
        }
      }
    }
  });
}

function toSummary(conversation: ConversationWithRelations, viewerId: string): ConversationSummary {
  const lastMessage = conversation.messages[0];
  const otherMember = conversation.members.find((member) => member.userId !== viewerId);

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
}

export async function getConversationSummary(
  prisma: PrismaClient,
  conversationId: string,
  viewerId: string
): Promise<ConversationSummary | null> {
  const conversation = await fetchConversationWithRelations(prisma, conversationId);
  if (!conversation) {
    return null;
  }
  return toSummary(conversation, viewerId);
}

export async function listConversationSummaries(prisma: PrismaClient, viewerId: string) {
  const conversations = await prisma.conversation.findMany({
    where: {
      members: {
        some: { userId: viewerId }
      }
    },
    include: {
      members: {
        include: {
          user: {
            include: {
              profile: true
            }
          }
        }
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          sender: {
            include: {
              profile: true
            }
          }
        }
      }
    },
    orderBy: { updatedAt: 'desc' }
  });

  return conversations.map((conversation) => toSummary(conversation, viewerId));
}

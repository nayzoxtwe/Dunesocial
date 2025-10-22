import type { PrismaClient } from '@prisma/client';
import { emitToUser } from '../socket.js';

export type PresenceStatus = 'online' | 'offline' | 'busy';

export async function broadcastPresence(
  prisma: PrismaClient,
  userId: string,
  status: PresenceStatus
) {
  const recipients = new Set<string>();
  recipients.add(userId);

  const friends = await prisma.friend.findMany({
    where: {
      state: 'ACCEPTED',
      OR: [{ aId: userId }, { bId: userId }]
    }
  });

  for (const friend of friends) {
    recipients.add(friend.aId === userId ? friend.bId : friend.aId);
  }

  const memberships = await prisma.member.findMany({
    where: { userId },
    select: { convId: true }
  });

  if (memberships.length > 0) {
    const otherMembers = await prisma.member.findMany({
      where: {
        convId: { in: memberships.map((membership) => membership.convId) },
        NOT: { userId }
      },
      select: { userId: true }
    });
    for (const member of otherMembers) {
      recipients.add(member.userId);
    }
  }

  for (const recipient of recipients) {
    emitToUser(recipient, 'presence:update', { userId, status });
  }
}

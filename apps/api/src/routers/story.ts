import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { addHours } from 'date-fns';
import { z } from 'zod';
import { broadcast } from '../socket.js';
import { authenticatedProcedure, router } from '../trpc.js';

const storiesDir = path.resolve(process.cwd(), 'uploads', 'stories');

export const storyRouter = router({
  post: authenticatedProcedure
    .input(
      z.object({
        dataUrl: z.string().regex(/^data:.+;base64,/, 'Invalid data URL')
      })
    )
    .mutation(async ({ ctx, input }) => {
      await mkdir(storiesDir, { recursive: true });
      const [meta, base64] = input.dataUrl.split(',');
      const ext = meta.includes('image/png') ? 'png' : meta.includes('image/gif') ? 'gif' : 'jpg';
      const buffer = Buffer.from(base64, 'base64');
      const id = randomUUID();
      const filename = `${id}.${ext}`;
      const filePath = path.join(storiesDir, filename);
      await writeFile(filePath, buffer);

      const expiresAt = addHours(new Date(), 24);

      const story = await ctx.prisma.story.create({
        data: {
          userId: ctx.user.id,
          mediaUrl: `/uploads/stories/${filename}`,
          expiresAt
        }
      });

      broadcast('story:new', { id: story.id, mediaUrl: story.mediaUrl, userId: story.userId, expiresAt });

      return story;
    }),
  feed: authenticatedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const friends = await ctx.prisma.friend.findMany({
      where: { OR: [{ aId: ctx.user.id }, { bId: ctx.user.id }], state: 'ACCEPTED' }
    });
    const friendIds = new Set<string>([ctx.user.id]);
    for (const friend of friends) {
      friendIds.add(friend.aId === ctx.user.id ? friend.bId : friend.aId);
    }

    const stories = await ctx.prisma.story.findMany({
      where: {
        userId: { in: Array.from(friendIds) },
        expiresAt: { gt: now }
      },
      orderBy: { createdAt: 'desc' }
    });

    return stories;
  })
});

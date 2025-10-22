import './prisma.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { createServer } from 'node:http';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { Server as SocketIOServer } from 'socket.io';
import cron from 'node-cron';
import jwt from 'jsonwebtoken';
import { appRouter } from './router.js';
import { createContext } from './context.js';
import { prisma } from './prisma.js';
import { broadcast, emitToConversation, emitToUser, registerSocket } from './socket.js';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000'],
    credentials: true
  }
});
registerSocket(io);

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000'], credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext
  })
);

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token ?? socket.handshake.headers.authorization?.split(' ')[1];
  if (!token) {
    return next(new Error('Unauthorized'));
  }
  try {
    const secret = process.env.JWT_SECRET ?? process.env.NEXTAUTH_SECRET;
    if (!secret) {
      throw new Error('JWT secret missing');
    }
    const decoded = jwt.verify(token, secret) as { sub: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      include: {
        profile: true
      }
    });
    if (!user) {
      return next(new Error('Unauthorized'));
    }
    (socket.data as { userId: string }).userId = user.id;
    await prisma.profile.upsert({
      where: { userId: user.id },
      update: { status: 'online', lastActiveAt: new Date() },
      create: {
        userId: user.id,
        display: user.email.split('@')[0],
        status: 'online',
        nightStart: 1380,
        nightEnd: 300,
        lastActiveAt: new Date()
      }
    });
    next();
  } catch (err) {
    next(err as Error);
  }
});

io.on('connection', async (socket) => {
  const { userId } = socket.data as { userId: string };
  socket.join(`user:${userId}`);

  const memberships = await prisma.member.findMany({ where: { userId } });
  memberships.forEach((membership) => {
    socket.join(`conversation:${membership.convId}`);
  });

  socket.on('typing', (payload: { conversationId: string }) => {
    emitToConversation(payload.conversationId, 'typing', { userId });
  });

  socket.on('sendMessage', async (payload: { conversationId: string; text?: string; kind?: string }) => {
    const conversation = await prisma.conversation.findUnique({ where: { id: payload.conversationId } });
    if (!conversation) return;
    const message = await prisma.message.create({
      data: {
        convId: payload.conversationId,
        senderId: userId,
        kind: (payload.kind as any) ?? 'text',
        text: payload.text
      },
      include: {
        sender: { include: { profile: true } }
      }
    });
    await prisma.conversation.update({ where: { id: payload.conversationId }, data: { updatedAt: new Date() } });
    emitToConversation(payload.conversationId, 'message:new', {
      id: message.id,
      conversationId: payload.conversationId,
      kind: message.kind,
      text: message.text,
      createdAt: message.createdAt,
      sender: {
        id: message.sender.id,
        display: message.sender.profile?.display ?? message.sender.email
      }
    });
  });

  socket.on('presence', async (payload: { status: 'online' | 'offline' | 'busy' }) => {
    await prisma.profile.upsert({
      where: { userId },
      update: { status: payload.status, lastActiveAt: new Date() },
      create: {
        userId,
        display: userId,
        status: payload.status,
        lastActiveAt: new Date()
      }
    });
    emitToUser(userId, 'presence:update', { userId, status: payload.status });
  });

  socket.on('disconnect', async () => {
    await prisma.profile.upsert({
      where: { userId },
      update: { status: 'offline', lastActiveAt: new Date() },
      create: {
        userId,
        display: userId,
        status: 'offline',
        lastActiveAt: new Date()
      }
    });
  });
});

cron.schedule('*/10 * * * *', async () => {
  const now = new Date();
  const expired = await prisma.story.findMany({ where: { expiresAt: { lt: now } } });
  if (expired.length) {
    await prisma.story.deleteMany({ where: { id: { in: expired.map((story) => story.id) } } });
    broadcast('story:expired', expired.map((story) => story.id));
  }
});

const port = Number(process.env.PORT ?? 4000);
httpServer.listen(port, () => {
  console.log(`API ready on http://localhost:${port}`);
});

import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction([
    prisma.message.deleteMany(),
    prisma.member.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.friend.deleteMany(),
    prisma.story.deleteMany(),
    prisma.wallet.deleteMany(),
    prisma.profile.deleteMany(),
    prisma.user.deleteMany()
  ]);

  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'moi@dune.local',
        role: Role.ADULT,
        profile: {
          create: {
            display: 'Moi',
            status: 'online',
            nightStart: 1380,
            nightEnd: 300
          }
        },
        wallet: { create: { coins: 900 } }
      },
      include: { profile: true, wallet: true }
    }),
    prisma.user.create({
      data: {
        email: 'nova@dune.local',
        role: Role.ADULT,
        profile: {
          create: {
            display: 'Nova',
            status: 'online'
          }
        },
        wallet: { create: { coins: 650 } }
      },
      include: { profile: true, wallet: true }
    }),
    prisma.user.create({
      data: {
        email: 'eden@dune.local',
        role: Role.TEEN,
        profile: {
          create: {
            display: 'Eden',
            status: 'offline',
            nightStart: 1380,
            nightEnd: 300
          }
        },
        wallet: { create: { coins: 400 } }
      },
      include: { profile: true, wallet: true }
    })
  ]);

  const [moi, nova, eden] = users;

  await prisma.friend.create({
    data: {
      aId: moi.id < nova.id ? moi.id : nova.id,
      bId: moi.id < nova.id ? nova.id : moi.id,
      state: 'ACCEPTED'
    }
  });

  const conversation = await prisma.conversation.create({
    data: {
      type: 'DM',
      createdBy: moi.id,
      dmKey: [moi.id, nova.id].sort().join(':'),
      members: {
        create: [
          { userId: moi.id },
          { userId: nova.id }
        ]
      },
      messages: {
        create: [
          {
            senderId: moi.id,
            kind: 'text',
            text: 'Bienvenue sur Dune Messenger!'
          },
          {
            senderId: nova.id,
            kind: 'text',
            text: 'On se retrouve dans le salon violet.'
          }
        ]
      }
    }
  });

  await prisma.transfer.create({
    data: {
      fromId: moi.id,
      toId: nova.id,
      coins: 80,
      memo: 'Pour les stickers premium'
    }
  });

  await prisma.parentalLink.create({
    data: {
      childId: eden.id,
      parentId: moi.id,
      nightStart: 1380,
      nightEnd: 300,
      teenCoinCap: 1000
    }
  });

  console.log('Seeded users:', users.map((user) => `${user.profile?.display} <${user.email}>`).join(', '));
  console.log('Conversation created with id:', conversation.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

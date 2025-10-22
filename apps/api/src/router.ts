import { router } from './trpc.js';
import { authRouter } from './routers/auth.js';
import { chatRouter } from './routers/chat.js';
import { friendsRouter } from './routers/friends.js';
import { parentRouter } from './routers/parent.js';
import { presenceRouter } from './routers/presence.js';
import { storyRouter } from './routers/story.js';
import { userRouter } from './routers/user.js';
import { walletRouter } from './routers/wallet.js';

export const appRouter = router({
  auth: authRouter,
  user: userRouter,
  friends: friendsRouter,
  chat: chatRouter,
  story: storyRouter,
  wallet: walletRouter,
  parent: parentRouter,
  presence: presenceRouter
});

export type AppRouter = typeof appRouter;

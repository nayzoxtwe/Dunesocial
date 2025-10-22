import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { AppContext } from './context.js';

const t = initTRPC.context<AppContext>().create({ transformer: superjson });

export const router = t.router;
export const procedure = t.procedure;

export const authenticatedProcedure = procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const moderatorProcedure = authenticatedProcedure.use(({ ctx, next }) => {
  if (ctx.role !== 'PARENT' && ctx.role !== 'ADULT') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next();
});

import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '@dune/proto';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function createTrpcClient(token?: string) {
  return createTRPCProxyClient<AppRouter>({
    transformer: superjson,
    links: [
      httpBatchLink({
        url: `${apiBase}/trpc`,
        headers() {
          return token
            ? {
                Authorization: `Bearer ${token}`
              }
            : {};
        },
        fetch(url, options) {
          return fetch(url, { ...options, credentials: 'include' });
        }
      })
    ]
  });
}

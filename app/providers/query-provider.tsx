"use client";

import { QueryClient, QueryClientProvider, isServer } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        gcTime: 5 * 60 * 1000, // 5 minutes cache
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;
let browserQueryClientScope: string | undefined;

function getQueryClient(scope: string) {
  if (isServer) {
    return makeQueryClient();
  } else {
    if (!browserQueryClient || browserQueryClientScope !== scope) {
      browserQueryClient = makeQueryClient();
      browserQueryClientScope = scope;
    }
    return browserQueryClient;
  }
}

export default function QueryProvider({
  children,
  cacheScope,
}: {
  children: React.ReactNode;
  cacheScope: string;
}) {
  const queryClient = getQueryClient(cacheScope);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

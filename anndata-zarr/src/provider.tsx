import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

export function AnndataProvider({ children }: { children: React.JSX.Element[] }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

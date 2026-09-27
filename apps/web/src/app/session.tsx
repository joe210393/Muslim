import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createServices } from "../services/create-services";
import type { Services } from "../services/types";
import type { PublicUser } from "@mf/contracts";

const ServicesContext = createContext<Services | null>(null);
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });

export function useServices() {
  const services = useContext(ServicesContext);
  if (!services) throw new Error("服務尚未就緒");
  return services;
}

export function useSession() {
  const services = useServices();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["me", services.mode], queryFn: () => services.me() });
  async function setUser(user: PublicUser | null) {
    client.setQueryData(["me", services.mode], user);
    await client.invalidateQueries({ predicate: (item) => item.queryKey[0] !== "me" });
  }
  return { user: query.data ?? null, loading: query.isLoading, refresh: () => query.refetch(), setUser };
}

export function Providers({ children }: { children: ReactNode }) {
  const [services, setServices] = useState<Services | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    createServices().then(setServices).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "無法啟動"));
  }, []);
  if (error) return <p className="p-6 text-rose-700">{error}</p>;
  if (!services) return <p className="p-6 text-stone-600">系統載入中…</p>;
  return (
    <ServicesContext.Provider value={services}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ServicesContext.Provider>
  );
}

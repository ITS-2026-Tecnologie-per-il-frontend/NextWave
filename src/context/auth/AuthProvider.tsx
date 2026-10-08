import { useMemo, useState, type ReactNode } from "react";
import { AuthContext } from "./AuthContext.ts";
import { useAuth } from "../../hooks/useAuth.ts";
import { getSupabase } from "../../services/cloud/supabase.ts";
import { createCloudRepository } from "../../services/cloud/cloudRepository.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

export function AuthProvider({
  children,
  client: suppliedClient,
}: {
  children: ReactNode;
  client?: SupabaseClient;
}) {
  const [client] = useState(() => suppliedClient ?? getSupabase());
  const repository = useMemo(() => createCloudRepository(client), [client]);
  const state = useAuth(client);
  const value = useMemo(
    () => ({ ...state, client, repository }),
    [state, client, repository],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

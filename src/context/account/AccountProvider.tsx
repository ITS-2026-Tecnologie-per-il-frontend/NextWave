import type { ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CloudRepository } from "../../services/cloud/cloudRepository.ts";
import { AccountContext } from "./AccountContext.ts";
import { useAccountData } from "../../hooks/useAccountData.ts";

export function AccountProvider({
  client,
  repository,
  children,
}: {
  client: SupabaseClient;
  repository: CloudRepository;
  children: ReactNode;
}) {
  const value = useAccountData(client, repository);
  return (
    <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
  );
}

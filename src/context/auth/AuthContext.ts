import { createContext } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CloudRepository } from "../../services/cloud/cloudRepository.ts";
import type { useAuth } from "../../hooks/useAuth.ts";

export const AuthContext = createContext<
  | (ReturnType<typeof useAuth> & {
      client: SupabaseClient;
      repository: CloudRepository;
    })
  | null
>(null);

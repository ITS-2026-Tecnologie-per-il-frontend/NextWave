import { createContext } from "react";
import type { useAccountData } from "../../hooks/useAccountData.ts";

export const AccountContext = createContext<ReturnType<
  typeof useAccountData
> | null>(null);

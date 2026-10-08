import { useContext } from "react";
import { AccountContext } from "../context/account/AccountContext.ts";

export function useAccount() {
  const value = useContext(AccountContext);
  if (!value) throw new Error("AccountProvider mancante.");
  return value;
}

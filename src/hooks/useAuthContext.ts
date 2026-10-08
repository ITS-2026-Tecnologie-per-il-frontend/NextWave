import { useContext } from "react";
import { AuthContext } from "../context/auth/AuthContext.ts";

export function useAuthContext() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider mancante.");
  return value;
}

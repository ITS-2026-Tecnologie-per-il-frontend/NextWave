import { getErrorMessage } from "../domain/shared/errors.ts";
import type { SupabaseClient, Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
export function useAuth(client: SupabaseClient) {
  const [state, setState] = useState<{
    session: Session | null;
    loading: boolean;
    error: string;
  }>({
    session: null,
    loading: true,
    error: "",
  });
  useEffect(() => {
    let alive = true;
    let receivedEvent = false;
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      receivedEvent = true;
      if (alive) setState({ session, loading: false, error: "" });
    });
    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (alive && !receivedEvent)
          setState({
            session: data.session,
            loading: false,
            error: getErrorMessage(error, ""),
          });
      })
      .catch((error) => {
        if (alive)
          setState({
            session: null,
            loading: false,
            error: getErrorMessage(error),
          });
      });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [client]);
  return state;
}

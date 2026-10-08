import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CloudRepository } from "../services/cloud/cloudRepository.ts";
import type { Dashboard, ProfileChanges } from "../types/models.ts";
import { getErrorMessage } from "../domain/shared/errors.ts";
import { rome } from "../domain/shared/time.ts";

export function useAccountData(
  client: SupabaseClient,
  repository: CloudRepository,
) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [now, setNow] = useState(Date.now());
  const offset = useRef(0);
  const alive = useRef(true);
  const request = useRef(0);
  const currentData = useRef<Dashboard | null>(null);
  const mutation = useRef(false);
  const notify = useCallback((message: string) => setToast(message), []);
  const refresh = useCallback(async () => {
    const id = ++request.current;
    let result: Dashboard;
    try {
      result = await repository.dashboard();
    } catch (error) {
      if (!alive.current || id !== request.current) return;
      throw error;
    }
    if (!alive.current || id !== request.current) return;
    offset.current = Date.parse(result.serverTime) - Date.now();
    currentData.current = result;
    setData(result);
    setNow(Date.now());
    setError("");
    return result;
  }, [repository]);
  useEffect(() => {
    alive.current = true;
    const load = () => {
      void refresh().catch((error) => {
        if (alive.current) setError(getErrorMessage(error));
      });
    };
    load();
    const timer = setInterval(load, 30000);
    window.addEventListener("focus", load);
    return () => {
      alive.current = false;
      request.current++;
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [refresh]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const mutate = useCallback(
    async (action: () => Promise<unknown>, message?: string) => {
      if (mutation.current) throw new Error("Attendi il salvataggio in corso.");
      mutation.current = true;
      setBusy(true);
      try {
        await action();
        if (!alive.current) return;
        await refresh();
        if (message && alive.current) notify(message);
      } finally {
        mutation.current = false;
        if (alive.current) setBusy(false);
      }
    },
    [refresh, notify],
  );
  const patchProfile = useCallback(
    (values: ProfileChanges) => {
      const profile = currentData.current?.profile;
      if (!profile)
        return Promise.reject(new Error("Profilo non ancora disponibile."));
      if (values.accountType)
        return mutate(() => repository.setAccountType(values.accountType!));
      return mutate(() => repository.saveProfile({ ...profile, ...values }));
    },
    [mutate, repository],
  );
  const signOut = useCallback(async () => {
    const { error } = await client.auth.signOut();
    if (error) notify(getErrorMessage(error));
  }, [client, notify]);
  const serverNow = now + offset.current;
  const clock = useMemo(() => rome(new Date(serverNow)), [serverNow]);
  return useMemo(
    () => ({
      data,
      error,
      busy,
      toast,
      serverNow,
      clock,
      repository,
      refresh,
      mutate,
      patchProfile,
      signOut,
      notify,
    }),
    [
      data,
      error,
      busy,
      toast,
      serverNow,
      clock,
      repository,
      refresh,
      mutate,
      patchProfile,
      signOut,
      notify,
    ],
  );
}

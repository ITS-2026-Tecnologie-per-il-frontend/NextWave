import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type {
  AuthChangeEvent,
  Session,
  SupabaseClient,
} from "@supabase/supabase-js";
import type { CloudRepository } from "../../src/services/cloud/cloudRepository.ts";
import type { Dashboard } from "../../src/types/models.ts";
import { AuthProvider } from "../../src/context/auth/AuthProvider.tsx";
import { AccountProvider } from "../../src/context/account/AccountProvider.tsx";
import { AppearanceProvider } from "../../src/context/appearance/AppearanceProvider.tsx";
import { useAuthContext } from "../../src/hooks/useAuthContext.ts";
import { useAccount } from "../../src/hooks/useAccount.ts";
import { useCustomStyle } from "../../src/hooks/useCustomStyle.ts";
import { createProfile } from "../../src/services/demo/demoProfileStorage.ts";
import { rome } from "../../src/domain/shared/time.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function AuthProbe() {
  const { session, error } = useAuthContext();
  return (
    <output>
      {session?.user.id ?? "nessun account"}
      {error}
    </output>
  );
}
test("il context auth mantiene l’evento più recente anche se la lettura iniziale fallisce e rimuove la sottoscrizione", async () => {
  const pending = deferred<{
    data: { session: Session | null };
    error: null;
  }>();
  let emit!: (event: AuthChangeEvent, session: Session | null) => void;
  const unsubscribe = vi.fn();
  const client = {
    auth: {
      getSession: vi.fn(() => pending.promise),
      onAuthStateChange: vi.fn((callback: typeof emit) => {
        emit = callback;
        return { data: { subscription: { unsubscribe } } };
      }),
    },
  } as unknown as SupabaseClient;
  const view = render(
    <AuthProvider client={client}>
      <div>
        <AuthProbe />
      </div>
    </AuthProvider>,
  );
  const session: Session = {
    access_token: "test",
    refresh_token: "test",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: "current-user",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-10-08T00:00:00Z",
    },
  };
  await act(async () => emit("SIGNED_IN", session));
  await act(async () => pending.reject(new Error("lettura obsoleta")));
  expect(screen.getByRole("status").textContent).toBe("current-user");
  await act(async () => emit("SIGNED_OUT", null));
  expect(screen.getByRole("status").textContent).toBe("nessun account");
  view.unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

function AccountProbe() {
  const { data, error } = useAccount();
  return (
    <>
      <output>{data?.profile.name ?? "caricamento"}</output>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
test("una risposta o un errore obsoleto non sovrascrive i dati più recenti del context account", async () => {
  const first = deferred<Dashboard>();
  const second = deferred<Dashboard>();
  const dashboard = vi
    .fn()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const client = { auth: {} } as unknown as SupabaseClient;
  const repository = { dashboard } as unknown as CloudRepository;
  render(
    <AccountProvider client={client} repository={repository}>
      <AccountProbe />
    </AccountProvider>,
  );
  fireEvent.focus(window);
  await act(async () =>
    second.resolve({
      serverTime: new Date().toISOString(),
      clock: rome(),
      profile: { ...createProfile(), name: "Dati recenti" },
      tracks: [],
      favorites: [],
    }),
  );
  expect(screen.getByRole("status").textContent).toBe("Dati recenti");
  await act(async () => first.reject(new Error("errore obsoleto")));
  expect(screen.getByRole("status").textContent).toBe("Dati recenti");
  expect(screen.queryByRole("alert")).toBeNull();
});

function ThemeEditor() {
  const appearance = useCustomStyle();
  return (
    <button
      onClick={() =>
        appearance.applyStyle({ ...appearance.style, buttons: "#ff0000" }, true)
      }
    >
      Cambia colore globale
    </button>
  );
}
function ThemeReader({ label }: { label: string }) {
  const appearance = useCustomStyle();
  return <output aria-label={label}>{appearance.style.buttons}</output>;
}
test("un aggiornamento dal discendente si propaga ai consumatori del context e ai token applicati", () => {
  render(
    <AppearanceProvider>
      <ThemeReader label="menu" />
      <div>
        <ThemeReader label="pagina" />
        <ThemeEditor />
      </div>
    </AppearanceProvider>,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Cambia colore globale" }),
  );
  expect(screen.getByLabelText("menu").textContent).toBe("#ff0000");
  expect(screen.getByLabelText("pagina").textContent).toBe("#ff0000");
  expect(
    document.documentElement.style.getPropertyValue("--custom-button"),
  ).toBe("#ff0000");
});

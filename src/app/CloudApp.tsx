import { useState } from "react";
import { getSupabase } from "../services/supabase.ts";
import { createCloudRepository } from "../services/cloudRepository.ts";
import { useAuth } from "../hooks/useAuth.ts";
import Auth from "../pages/Auth.tsx";
import { Account } from "./CloudAccount.tsx";

export default function CloudApp() {
  const [client] = useState(getSupabase);
  const [repository] = useState(() => createCloudRepository(client));
  const { session, loading, error } = useAuth(client);
  if (loading)
    return (
      <main className="connection-page">
        <p role="status">Verifica dell’accesso…</p>
      </main>
    );
  if (error)
    return (
      <main className="connection-page">
        <p role="alert">{error}</p>
        <button onClick={() => location.reload()}>Riprova</button>
      </main>
    );
  return session ? (
    <Account key={session.user.id} client={client} repository={repository} />
  ) : (
    <Auth client={client} />
  );
}

import { AuthProvider } from "../context/auth/AuthProvider.tsx";
import { useAuthContext } from "../hooks/useAuthContext.ts";
import Auth from "../screens/auth/Auth.tsx";
import { Account } from "./CloudAccount.tsx";

export default function CloudApp() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

function AuthenticatedApp() {
  const { client, repository, session, loading, error } = useAuthContext();
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

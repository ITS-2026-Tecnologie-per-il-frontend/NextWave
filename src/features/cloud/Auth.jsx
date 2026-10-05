import { useEffect, useState } from "react";
import { Brand } from "../../components/ui.jsx";
export function useAuth(client) {
  const [state, setState] = useState({
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
            error: error?.message || "",
          });
      })
      .catch((error) => {
        if (alive)
          setState({ session: null, loading: false, error: error.message });
      });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [client]);
  return state;
}
export default function Auth({ client }) {
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const credentials = {
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
    };
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = signup
        ? await client.auth.signUp({
            ...credentials,
            options: { emailRedirectTo: location.origin },
          })
        : await client.auth.signInWithPassword(credentials);
      if (result.error) throw result.error;
      if (signup && !result.data.session)
        setMessage(
          "Controlla la tua email per confermare la registrazione, poi accedi.",
        );
    } catch (error) {
      setError(error.message || "Accesso non riuscito. Riprova.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="connection-page">
      <section className="panel auth-panel">
        <Brand />
        <h1>{signup ? "Entra nel pulse." : "Bentornato nel pulse."}</h1>
        <p>
          Un account per ritrovare gusti, scoperte e progressi su ogni
          dispositivo.
        </p>
        <form onSubmit={submit}>
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength="254"
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              minLength={signup ? 8 : 1}
              required
            />
          </label>
          <p className="error" role="alert">
            {error}
          </p>
          <p role="status">{message}</p>
          <button className="btn" disabled={busy}>
            {busy ? "Attendi…" : signup ? "Crea account" : "Accedi"}
          </button>
        </form>
        <button
          className="textbtn"
          disabled={busy}
          onClick={() => {
            setSignup(!signup);
            setError("");
            setMessage("");
          }}
        >
          {signup
            ? "Hai già un account? Accedi"
            : "Non hai un account? Registrati"}
        </button>
      </section>
    </main>
  );
}

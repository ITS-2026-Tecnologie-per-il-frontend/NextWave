import type { IncomingMessage, ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createAudioService } from "../server/audio/service.ts";

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
) {
  res.setHeader("Cache-Control", "no-store");
  const respond = (status: number, data: unknown) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(data));
  };
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    respond(405, { error: "Metodo non consentito." });
    return;
  }
  const url = process.env.VITE_SUPABASE_URL;
  const publicKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publicKey || !serviceKey) {
    respond(503, { error: "Caricamento audio non configurato sul server." });
    return;
  }
  const token = req.headers.authorization?.replace(/^Bearer /, "") ?? "";
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      JSON.stringify(body).length > 16384
    ) {
      respond(400, { error: "Richiesta non valida." });
      return;
    }
    const { action, id, data } = body as {
      action?: string;
      id?: string;
      data?: Record<string, unknown>;
    };
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const service = createAudioService(admin);
    if (action === "cleanup") {
      const secret = process.env.AUDIO_CLEANUP_SECRET;
      if (
        !secret ||
        token.length !== secret.length ||
        !timingSafeEqual(Buffer.from(token), Buffer.from(secret))
      ) {
        respond(401, { error: "Accesso negato." });
        return;
      }
      const result = await service.cleanup();
      respond(result.failed ? 503 : 200, result);
      return;
    }
    if (!["prepare", "finalize", "cancel", "play"].includes(action ?? "")) {
      respond(400, { error: "Operazione non valida." });
      return;
    }
    const client = createClient(url, publicKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth, error } = await client.auth.getUser(token);
    if (error || !auth.user) {
      respond(401, { error: "Accedi nuovamente a NextWave." });
      return;
    }
    if (action === "prepare") {
      if (!data || Array.isArray(data) || typeof data !== "object") {
        respond(400, { error: "Candidatura non valida." });
        return;
      }
      respond(200, await service.prepare(auth.user.id, data));
      return;
    }
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      respond(400, { error: "Identificativo non valido." });
      return;
    }
    const result =
      action === "play"
        ? await service.playback(client, id)
        : action === "finalize"
          ? await service.finalize(auth.user.id, id)
          : await service.cancel(auth.user.id, id);
    respond(200, result);
  } catch (error) {
    // Non invia stack, token o dettagli delle chiamate Storage al browser.
    const message =
      error instanceof Error ? error.message : "Operazione non riuscita.";
    respond(400, {
      error: /constraint|null value|syntax|relation|function/.test(message)
        ? "Dati non validi o database da aggiornare."
        : message,
    });
  }
}

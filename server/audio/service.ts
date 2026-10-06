import type { SupabaseClient } from "@supabase/supabase-js";
import { AUDIO_BUCKET } from "../../src/config/audio.ts";
import { rome } from "../../src/domain/time.ts";
import { validateMp3 } from "./validateMp3.ts";

export function createAudioService(admin: SupabaseClient) {
  const bucket = admin.storage.from(AUDIO_BUCKET);
  async function command<T>(
    action: string,
    user: string | null = null,
    data: Record<string, unknown> = {},
  ): Promise<T> {
    const result = await admin.rpc("audio_server", {
      p_action: action,
      p_user: user,
      p_data: data,
    });
    if (result.error)
      throw new Error(
        result.error.code === "23505"
          ? "Questo brano è già stato candidato."
          : result.error.message,
      );
    return result.data as T;
  }
  return {
    async prepare(user: string, data: Record<string, unknown>) {
      const asset = await command<{ id: string; path: string }>(
        "reserve",
        user,
        data,
      );
      const signed = await bucket.createSignedUploadUrl(asset.path, {
        upsert: false,
      });
      if (signed.error) {
        await command("cancel-upload", user, { id: asset.id });
        throw new Error("Caricamento non disponibile. Riprova più tardi.");
      }
      return { ...asset, token: signed.data.token };
    },
    async finalize(user: string, id: string) {
      const asset = await command<{
        ready?: boolean;
        path: string;
        target: string;
      }>("claim-upload", user, { id });
      if (asset.ready) return { ready: true };
      try {
        const downloaded = await bucket.download(asset.path);
        if (downloaded.error)
          throw new Error("Audio non ricevuto. Ripeti il caricamento.");
        const { audio, duration } = await validateMp3(
          new Uint8Array(await downloaded.data.arrayBuffer()),
        );
        const saved = await bucket.upload(asset.target, audio, {
          contentType: "audio/mpeg",
          upsert: true,
          cacheControl: "0",
        });
        if (saved.error)
          throw new Error("Impossibile preparare l’audio. Riprova.");
        await command("complete-upload", user, {
          id,
          bytes: audio.length,
          duration,
        });
        // L'originale resta privato fino alla scadenza della firma di upload: il cron lo elimina.
        return { ready: true };
      } catch (error) {
        await command("retry-upload", user, { id });
        throw error;
      }
    },
    cancel: (user: string, id: string) =>
      command("cancel-upload", user, { id }),
    async playback(client: SupabaseClient, selection: string) {
      const { data, error } = await client.rpc("begin_listening", {
        p_selection: selection,
      });
      if (error) throw new Error(error.message);
      if (!data.audioUrl?.startsWith("storage://")) return data;
      const prefix = `storage://${AUDIO_BUCKET}/`;
      if (!data.audioUrl.startsWith(prefix))
        throw new Error("Audio non disponibile.");
      const remaining = 21 * 3600 - rome().seconds;
      if (remaining <= 0) throw new Error("Il contest è terminato.");
      const signed = await bucket.createSignedUrl(
        data.audioUrl.slice(prefix.length),
        Math.min(remaining, 1860, Math.ceil(data.duration) + 60),
      );
      if (signed.error) throw new Error("Audio non disponibile. Riprova.");
      return { ...data, audioUrl: signed.data.signedUrl };
    },
    async cleanup() {
      const jobs =
        await command<{ id: string; kind: string; path: string }[]>(
          "cleanup-list",
        );
      let removed = 0;
      let failed = 0;
      for (const job of jobs) {
        const result = await bucket.remove([job.path]);
        if (result.error) {
          failed++;
          continue;
        }
        await command("cleanup-done", null, { id: job.id, kind: job.kind });
        removed++;
      }
      return { removed, failed };
    },
  };
}

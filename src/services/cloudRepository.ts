import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Profile,
  Dashboard,
  ListeningSession,
  RankingPeriod,
  RankingsResult,
  RankingRow,
  Application,
  AdminAccess,
  AdminDashboard,
} from "../types/models.ts";
import { getErrorMessage } from "../domain/errors.ts";
import { AUDIO_BUCKET } from "../config/audio.ts";
const AVATAR_BUCKET = "nextwave-avatars";
const AVATAR_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);
const MAX_AVATAR_BYTES = 5_000_000;
// I client non scrivono direttamente il ledger: usano RPC con controlli server.
export function createCloudRepository(client: SupabaseClient) {
  async function audioApi<T>(
    action: string,
    data: Record<string, unknown>,
  ): Promise<T> {
    const { data: auth } = await client.auth.getSession();
    if (!auth.session) throw new Error("Accedi nuovamente a NextWave.");
    const response = await fetch("/api/audio", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.session.access_token}`,
      },
      body: JSON.stringify({ action, ...data }),
    });
    const result = await response.json().catch(() => ({
      error: "Servizio audio non disponibile. Verifica il deployment.",
    }));
    if (!response.ok)
      throw new Error(result.error || "Servizio audio non disponibile.");
    return result as T;
  }
  async function rpc<T = unknown>(
    name: string,
    parameters: Record<string, unknown> = {},
  ): Promise<T> {
    const { data, error } = await client.rpc(name, parameters);
    if (error) {
      if (error.code === "23505")
        throw new Error("Questo dato è già stato registrato.");
      if (["PGRST202", "42P01"].includes(error.code))
        throw new Error(
          "Il database non è inizializzato. Applica lo script Supabase nel SQL Editor.",
        );
      throw new Error(
        getErrorMessage(error, "Impossibile salvare i dati. Riprova."),
      );
    }
    return data as T;
  }
  return {
    async dashboard(): Promise<Dashboard> {
      const [dashboard, adminAccess] = await Promise.all([
        rpc<Dashboard>("get_dashboard"),
        rpc<AdminAccess>("get_admin_access"),
      ]);
      if (dashboard.profile.avatarPath) {
        const signed = await client.storage
          .from(AVATAR_BUCKET)
          .createSignedUrl(dashboard.profile.avatarPath, 3600);
        if (signed.error)
          throw new Error("Impossibile caricare l’immagine del profilo.");
        dashboard.profile.avatarUrl = signed.data.signedUrl;
      }
      return { ...dashboard, adminAccess };
    },
    async uploadAvatar(file: File, oldPath?: string | null) {
      const extension = AVATAR_TYPES.get(file.type);
      if (!extension) throw new Error("Usa un’immagine JPG, PNG, WebP o GIF.");
      if (file.size > MAX_AVATAR_BYTES)
        throw new Error("L’immagine deve pesare al massimo 5 MB.");
      const { data: auth } = await client.auth.getSession();
      const userId = auth.session?.user.id;
      if (!userId) throw new Error("Accedi nuovamente a NextWave.");
      const path = `${userId}/profile.${extension}`;
      const uploaded = await client.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, {
          contentType: file.type,
          upsert: true,
          cacheControl: "3600",
        });
      if (uploaded.error)
        throw new Error(
          `Impossibile caricare l’immagine del profilo: ${uploaded.error.message}`,
        );
      try {
        await rpc("set_avatar_path", { p_path: path });
      } catch (error) {
        await client.storage.from(AVATAR_BUCKET).remove([path]);
        throw error;
      }
      if (oldPath && oldPath !== path)
        await client.storage.from(AVATAR_BUCKET).remove([oldPath]);
    },
    async removeAvatar(path?: string | null) {
      const { data: auth } = await client.auth.getSession();
      if (!auth.session) throw new Error("Accedi nuovamente a NextWave.");
      await rpc("set_avatar_path", { p_path: null });
      if (path) {
        const { error } = await client.storage
          .from(AVATAR_BUCKET)
          .remove([path]);
        if (error)
          throw new Error(
            `Impossibile rimuovere l’immagine del profilo: ${error.message}`,
          );
      }
    },
    adminDashboard: () =>
      rpc<AdminDashboard>("admin_console", { p_action: "dashboard" }),
    adminAction: (
      action: "approve" | "reject" | "grant" | "revoke",
      data: Record<string, unknown>,
    ) => rpc("admin_console", { p_action: action, p_data: data }),
    adminPreview: (applicationId: string) =>
      audioApi<{ audioUrl: string }>("admin-preview", { id: applicationId }),
    saveProfile: (profile: Profile) =>
      rpc("save_profile", {
        p_name: profile.name,
        p_theme: profile.theme,
        p_genres: profile.prefs,
        p_onboarded: profile.onboard,
      }),
    setAccountType: (type: "listener" | "artist") =>
      rpc("set_account_type", { p_type: type }),
    beginListening: (id: string) => audioApi<ListeningSession>("play", { id }),
    progress: (sessionId: string, position: number, finish = false) =>
      rpc<{ completed: boolean; creditedSeconds?: number }>(
        "listening_progress",
        {
          p_session: sessionId,
          p_position: position,
          p_finish: finish,
        },
      ),
    vote: (id: string) => rpc("cast_vote", { p_selection: id }),
    favorite: (id: string, isTrack = false) =>
      rpc("toggle_favorite", { p_id: id, p_is_track: isTrack }),
    rankings: (period: RankingPeriod, day?: string) =>
      rpc<RankingsResult>("get_rankings", {
        p_period: period,
        p_day: day || null,
      }),
    reveal: (day: string) => rpc<RankingRow[]>("get_reveal", { p_day: day }),
    seenReveal: (day: string) => rpc("mark_reveal_seen", { p_day: day }),
    async submitApplication(data: Application, audio: File) {
      const asset = await audioApi<{ id: string; path: string; token: string }>(
        "prepare",
        {
          data: {
            ...data,
            listeners: Number(data.listeners),
            rights: Boolean(data.rights),
            spotifyId:
              new URL(data.spotify).hostname === "open.spotify.com"
                ? new URL(data.spotify).pathname.match(
                    /^\/(?:intl-[a-z]{2}\/)?track\/([a-zA-Z0-9]{22})\/?$/,
                  )?.[1]
                : undefined,
          },
        },
      );
      try {
        const uploaded = await client.storage
          .from(AUDIO_BUCKET)
          .uploadToSignedUrl(asset.path, asset.token, audio, {
            contentType: "audio/mpeg",
          });
        if (uploaded.error)
          throw new Error(
            "Caricamento interrotto. Attendi la scadenza indicata nella candidatura prima di riprovare.",
          );
        return await audioApi("finalize", { id: asset.id });
      } catch (error) {
        await audioApi("cancel", { id: asset.id }).catch(() => undefined);
        throw error;
      }
    },
  };
}

export type CloudRepository = ReturnType<typeof createCloudRepository>;

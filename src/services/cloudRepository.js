// I client non scrivono direttamente il ledger: usano RPC con controlli server.
export function createCloudRepository(client) {
  async function rpc(name, parameters = {}) {
    const { data, error } = await client.rpc(name, parameters);
    if (error) {
      if (error.code === "23505")
        throw new Error("Questo dato è già stato registrato.");
      if (["PGRST202", "42P01"].includes(error.code))
        throw new Error(
          "Il database non è inizializzato. Applica lo script Supabase nel SQL Editor.",
        );
      throw new Error(error.message || "Impossibile salvare i dati. Riprova.");
    }
    return data;
  }
  return {
    dashboard: () => rpc("get_dashboard"),
    saveProfile: (profile) =>
      rpc("save_profile", {
        p_name: profile.name,
        p_theme: profile.theme,
        p_genres: profile.prefs,
        p_onboarded: profile.onboard,
      }),
    beginListening: (id) => rpc("begin_listening", { p_selection: id }),
    progress: (sessionId, position, finish = false) =>
      rpc("listening_progress", {
        p_session: sessionId,
        p_position: position,
        p_finish: finish,
      }),
    vote: (id) => rpc("cast_vote", { p_selection: id }),
    favorite: (id, isTrack = false) =>
      rpc("toggle_favorite", { p_id: id, p_is_track: isTrack }),
    rankings: (period) => rpc("get_rankings", { p_period: period }),
    reveal: (day) => rpc("get_reveal", { p_day: day }),
    seenReveal: (day) => rpc("mark_reveal_seen", { p_day: day }),
    submitApplication: (data) =>
      rpc("submit_application", {
        p_artist: data.artist,
        p_title: data.title,
        p_listeners: Number(data.listeners),
        p_genre: data.genre,
        p_language: data.language,
        p_subgenre: data.subgenre,
        p_mood: data.mood,
        p_spotify_id: new URL(data.spotify).pathname.match(
          /track\/([a-zA-Z0-9]{22})/,
        )[1],
        p_rights: Boolean(data.rights),
      }),
  };
}

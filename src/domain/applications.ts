import type { Application } from "../types/models.ts";
import { eligibility } from "./contest.ts";
export function validateApplication(
  data: Application,
  applications: Application[],
  admin = false,
) {
  if (!eligibility(Number(data.listeners)))
    return "Sono ammessi solo valori interi da 0 a 9.999 ascoltatori mensili.";
  if (!data.artist?.trim() || !data.title?.trim() || !data.subgenre?.trim())
    return "Completa tutti i campi richiesti.";
  if (!data.rights) return "Conferma di avere i diritti sul brano.";
  let url;
  try {
    url = new URL(data.spotify);
  } catch {
    return admin
      ? "Inserisci un link valido al brano (HTTP o HTTPS)."
      : "Inserisci un link Spotify valido a un brano.";
  }
  const match = /^\/(?:intl-[a-z]{2}\/)?track\/([a-zA-Z0-9]{22})\/?$/.exec(
    url.pathname,
  );
  if (
    admin &&
    (!["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password)
  )
    return "Inserisci un link valido al brano (HTTP o HTTPS).";
  if (
    !admin &&
    (url.protocol !== "https:" || url.hostname !== "open.spotify.com" || !match)
  )
    return "Inserisci un link Spotify valido a un brano.";
  const duplicate = applications.some((application) => {
    if (application.status === "rejected") return false;
    try {
      const existing = new URL(application.spotify);
      if (!match || url.hostname !== "open.spotify.com")
        return existing.href === url.href;
      return (
        existing.hostname === "open.spotify.com" &&
        new URL(application.spotify).pathname
          .replace(/\/intl-[a-z]{2}/, "")
          .replace(/\/$/, "") === `/track/${match[1]}`
      );
    } catch {
      return false;
    }
  });
  return duplicate ? "Hai già candidato questo brano." : "";
}

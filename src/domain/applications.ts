import type { Application } from "../types/models.ts";
import { eligibility } from "./contest.ts";
export function validateApplication(
  data: Application,
  applications: Application[],
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
    return "Inserisci un link Spotify valido a un brano.";
  }
  const match = /^\/(?:intl-[a-z]{2}\/)?track\/([a-zA-Z0-9]{22})\/?$/.exec(
    url.pathname,
  );
  if (
    url.protocol !== "https:" ||
    url.hostname !== "open.spotify.com" ||
    !match
  )
    return "Inserisci un link Spotify valido a un brano.";
  const duplicate = applications.some((application) => {
    if (application.status === "rejected") return false;
    try {
      return (
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

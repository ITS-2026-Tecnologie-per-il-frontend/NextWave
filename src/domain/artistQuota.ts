import type { Application } from "../types/models.ts";
import { rome } from "./time.ts";

export function artistQuota(
  applications: Application[],
  cloud = false,
  now = new Date(),
) {
  const month = rome(now).day.slice(0, 7);
  const used = applications.some((application) => {
    const timestamp = cloud
      ? application.submittedAt
      : application.submittedAt || application.created;
    return timestamp && rome(new Date(timestamp)).day.slice(0, 7) === month;
  });
  const next = new Date(`${month}-01T12:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const uploading =
    cloud &&
    applications.some(
      (application) =>
        application.status === "pending" &&
        ["uploading", "processing"].includes(application.audioState ?? "") &&
        application.created &&
        now.getTime() - Date.parse(application.created) < 3 * 3600 * 1000,
    );
  return {
    used,
    uploading,
    nextMonth: next.toLocaleDateString("it-IT", {
      timeZone: "Europe/Rome",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
  };
}

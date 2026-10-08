import { expect, test } from "vitest";
import { artistQuota } from "../../src/domain/artist/artistQuota.ts";

test("la quota usa il mese italiano e conta anche le candidature rifiutate", () => {
  const applications = [
    { submittedAt: "2026-09-30T22:30:00Z", status: "rejected" },
  ];
  expect(
    artistQuota(applications, true, new Date("2026-10-01T00:00:00Z")).used,
  ).toBe(true);
  expect(
    artistQuota(applications, true, new Date("2026-11-01T00:00:00Z")).used,
  ).toBe(false);
});

test("gli admin sono esenti dal limite mensile ma non dal caricamento simultaneo", () => {
  const now = new Date("2026-10-05T12:00:00Z");
  const applications = [
    { submittedAt: now.toISOString() },
    { created: now.toISOString(), audioState: "uploading", status: "pending" },
  ];
  expect(artistQuota(applications, true, now, true).used).toBe(false);
  expect(artistQuota(applications, true, now, true).uploading).toBe(true);
  expect(artistQuota(applications, true, now, false).used).toBe(true);
});

test("un caricamento fallito non consuma il mese e il rinnovo gestisce fine anno", () => {
  const quota = artistQuota(
    [
      {
        created: "2026-12-10T12:00:00Z",
        submittedAt: null,
        status: "rejected",
      },
    ],
    true,
    new Date("2026-12-20T12:00:00Z"),
  );
  expect(quota.used).toBe(false);
  expect(quota.nextMonth).toBe("01/01/2027");
});

test("una prenotazione incompleta blocca solo finché rimane attiva", () => {
  const applications = [
    {
      created: "2026-10-01T10:00:00Z",
      status: "pending",
      audioState: "uploading",
    },
  ];
  expect(
    artistQuota(applications, true, new Date("2026-10-01T11:00:00Z")).uploading,
  ).toBe(true);
  expect(
    artistQuota(applications, true, new Date("2026-10-01T14:00:00Z")).uploading,
  ).toBe(false);
});

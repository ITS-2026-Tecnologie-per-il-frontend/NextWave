import { expect, it } from "vitest";
import {
  callbackPayload,
  clearPkce,
  ownerKey,
} from "../src/services/spotifyPkce.js";
const prepare = () => {
  sessionStorage.setItem(ownerKey, "user-a");
  sessionStorage.setItem("spot_auth_state", "valid-state");
  sessionStorage.setItem("spot_auth_verifier", "valid-verifier");
};
it("associa la callback allo stesso account Next Wave e verifica state", () => {
  prepare();
  const url = new URL(
    "https://example.com/auth/spotify/callback?code=code&state=valid-state",
  );
  expect(callbackPayload(url, "user-a")).toEqual({
    code: "code",
    state: "valid-state",
    verifier: "valid-verifier",
  });
  expect(() => callbackPayload(url, "user-b")).toThrow("account Next Wave");
  expect(() =>
    callbackPayload(
      new URL("https://example.com/?code=code&state=wrong"),
      "user-a",
    ),
  ).toThrow("Sessione Spotify");
});
it("rifiuta callback senza verifier o con consenso negato", () => {
  prepare();
  expect(() =>
    callbackPayload(
      new URL("https://example.com/?error=access_denied&state=valid-state"),
      "user-a",
    ),
  ).toThrow("annullata");
  sessionStorage.removeItem("spot_auth_verifier");
  expect(() =>
    callbackPayload(
      new URL("https://example.com/?code=code&state=valid-state"),
      "user-a",
    ),
  ).toThrow("mancante");
});
it("elimina i dati transitori e non usa un return URL esterno", () => {
  prepare();
  localStorage.setItem("spot_auth_return_url", "https://untrusted.example");
  clearPkce();
  expect(sessionStorage.getItem(ownerKey)).toBeNull();
  expect(sessionStorage.getItem("spot_auth_state")).toBeNull();
  expect(sessionStorage.getItem("spot_auth_verifier")).toBeNull();
  expect(localStorage.getItem("spot_auth_return_url")).toBeNull();
});

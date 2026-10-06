import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { seal, unseal, hash } from "../server/spotify.js";
describe("protezione credenziali Spotify", () => {
  it("cifra con nonce diverso e recupera i token soltanto con la chiave corretta", () => {
    const key = randomBytes(32);
    const tokens = { access_token: "secret", refresh_token: "refresh" };
    const first = seal(tokens, key);
    expect(first).not.toContain("secret");
    expect(first).not.toBe(seal(tokens, key));
    expect(unseal(first, key)).toEqual(tokens);
    expect(() => unseal(first, randomBytes(32))).toThrow();
  });
  it("rifiuta credenziali alterate", () => {
    const key = randomBytes(32);
    const bytes = Buffer.from(seal({ token: "private" }, key), "base64url");
    bytes[bytes.length - 1] ^= 1;
    expect(() => unseal(bytes.toString("base64url"), key)).toThrow();
    expect(hash("state")).toHaveLength(64);
  });
});

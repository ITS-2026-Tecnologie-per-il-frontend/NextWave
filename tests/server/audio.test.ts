import type { SupabaseClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { describe, expect, test, vi } from "vitest";
import { validateMp3 } from "../../server/audio/validateMp3.ts";
import { createAudioService } from "../../server/audio/service.ts";

function frames() {
  // Header MPEG1 Layer3 CBR: fixture per il parser, non audio da pubblicare.
  const audio = Buffer.alloc(417 * 100);
  for (let i = 0; i < 100; i++) audio.set([255, 251, 144, 0], i * 417);
  return audio;
}
function taggedAudio() {
  const artist = Buffer.from([0, ...Buffer.from("Artista visibile")]);
  const frame = Buffer.alloc(10);
  frame.write("TPE1");
  frame.writeUInt32BE(artist.length, 4);
  const tag = Buffer.alloc(10);
  tag.write("ID3");
  tag[3] = 3;
  tag[9] = frame.length + artist.length;
  const tail = Buffer.alloc(128);
  tail.write("TAG");
  tail.write("Nome brano", 3);
  return Buffer.concat([tag, frame, artist, frames(), tail]);
}
describe("audio privato", () => {
  test("rifiuta WAV rinominati MP3, file vuoti e dimensioni eccessive", async () => {
    await expect(validateMp3(new Uint8Array())).rejects.toThrow("10 MB");
    await expect(validateMp3(new Uint8Array(10_000_001))).rejects.toThrow(
      "10 MB",
    );
    const wav = await readFile("tests/fixtures/audio/0.wav");
    await expect(validateMp3(wav)).rejects.toThrow("vero MP3");
  });
  test("rimuove artista e titolo nei tag ID3 conservando i frame e la durata", async () => {
    const result = await validateMp3(taggedAudio());
    expect(Buffer.from(result.audio)).toEqual(frames());
    expect(result.duration).toBeGreaterThan(2);
    expect(result.duration).toBeLessThan(3);
  });
  test("non firma l’audio quando il database rifiuta l’accesso allo slot", async () => {
    const createSignedUrl = vi.fn();
    const admin = {
      storage: { from: () => ({ createSignedUrl }) },
    } as unknown as SupabaseClient;
    const client = {
      rpc: async () => ({
        error: { message: "Completa il brano precedente." },
      }),
    } as unknown as SupabaseClient;
    await expect(
      createAudioService(admin).playback(client, "slot2"),
    ).rejects.toThrow("precedente");
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
  test("un file non MP3 non viene copiato nell’area ascoltabile né finalizzato", async () => {
    const wav = await readFile("tests/fixtures/audio/0.wav");
    const rpc = vi.fn(async (_name: string, data: Record<string, unknown>) => ({
      data:
        data.p_action === "claim-upload"
          ? { path: "uploads/id.mp3", target: "tracks/id.mp3" }
          : {},
      error: null,
    }));
    const upload = vi.fn();
    const download = async () => ({
      data: {
        arrayBuffer: async () =>
          wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength),
      },
      error: null,
    });
    const admin = {
      rpc,
      storage: { from: () => ({ upload, download }) },
    } as unknown as SupabaseClient;
    await expect(
      createAudioService(admin).finalize("user", "id"),
    ).rejects.toThrow("vero MP3");
    expect(upload).not.toHaveBeenCalled();
    expect(
      rpc.mock.calls.some((call) => call[1].p_action === "complete-upload"),
    ).toBe(false);
  });
});

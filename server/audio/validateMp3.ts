import { parseBuffer } from "music-metadata";
import { MAX_AUDIO_BYTES } from "../../src/config/audio.ts";

async function readMetadata(bytes: Uint8Array) {
  try {
    return await parseBuffer(
      bytes,
      { mimeType: "audio/mpeg" },
      { duration: true },
    );
  } catch {
    throw new Error("Audio non valido o incompleto. Esporta un MP3 e riprova.");
  }
}

// Rimuove informazioni testuali e copertine prima di rendere l'audio ascoltabile.
export async function validateMp3(input: Uint8Array) {
  if (!input.length || input.length > MAX_AUDIO_BYTES)
    throw new Error("Carica un MP3 di massimo 10 MB.");
  const metadata = await readMetadata(input);
  const duration = metadata.format.duration;
  if (
    metadata.format.codec !== "MPEG 1 Layer 3" &&
    metadata.format.codec !== "MPEG 2 Layer 3" &&
    metadata.format.codec !== "MPEG 2.5 Layer 3"
  ) {
    throw new Error("Il file deve essere un vero MP3.");
  }
  if (
    !duration ||
    !Number.isFinite(duration) ||
    duration < 1 ||
    duration > 1800
  )
    throw new Error(
      "La durata deve essere compresa tra 1 secondo e 30 minuti.",
    );
  let start = 0;
  let end = input.length;
  while (Buffer.from(input.subarray(start, start + 3)).toString() === "ID3") {
    if (
      start + 10 > end ||
      input.subarray(start + 6, start + 10).some((byte) => byte > 127)
    )
      throw new Error("Intestazione MP3 non valida.");
    const size = input
      .subarray(start + 6, start + 10)
      .reduce((total, byte) => total * 128 + byte, 0);
    start += 10 + size + (input[start + 5] & 16 ? 10 : 0);
    if (start >= end) throw new Error("MP3 privo di audio.");
  }
  if (Buffer.from(input.subarray(end - 128, end - 125)).toString() === "TAG")
    end -= 128;
  if (
    end >= 32 &&
    Buffer.from(input.subarray(end - 32, end - 24)).toString() === "APETAGEX"
  ) {
    const size = Buffer.from(input.subarray(end - 20, end - 16)).readUInt32LE();
    if (size < 32 || size > end - start)
      throw new Error("Metadati MP3 non validi.");
    end -= size;
    if (
      end >= 32 &&
      Buffer.from(input.subarray(end - 32, end - 24)).toString() === "APETAGEX"
    )
      end -= 32;
  }
  const audio = input.slice(start, end);
  const clean = await readMetadata(audio);
  if (Object.values(clean.native).some((tags) => tags.length))
    throw new Error(
      "Metadati non supportati. Esporta il brano come MP3 senza tag.",
    );
  return { audio, duration };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test, vi } from "vitest";
import { createCloudRepository } from "../../src/services/cloud/cloudRepository.ts";

function fixture() {
  const upload = vi.fn(
    async (_path: string, _file: File, _options: unknown) => ({ error: null }),
  );
  const remove = vi.fn(async () => ({ error: null }));
  const rpc = vi.fn(
    async (): Promise<{
      data: null;
      error: { message: string; code: string } | null;
    }> => ({ data: null, error: null }),
  );
  const client = {
    auth: {
      getSession: async () => ({
        data: {
          session: { user: { id: "11111111-1111-1111-1111-111111111111" } },
        },
      }),
    },
    storage: { from: () => ({ upload, remove }) },
    rpc,
  } as unknown as SupabaseClient;
  return { repository: createCloudRepository(client), upload, remove, rpc };
}
test("sostituire un avatar usa un nuovo percorso e rimuove il precedente solo dopo il salvataggio", async () => {
  const { repository, upload, remove, rpc } = fixture();
  const oldPath = "11111111-1111-1111-1111-111111111111/profile.png";
  const file = new File(["image"], "avatar.png", { type: "image/png" });
  await repository.uploadAvatar(file, oldPath);
  const newPath = upload.mock.calls[0]?.[0];
  expect(newPath).toMatch(
    /^11111111-1111-1111-1111-111111111111\/profile-[0-9a-f-]{36}\.png$/,
  );
  expect(rpc).toHaveBeenCalledWith("set_avatar_path", { p_path: newPath });
  expect(remove).toHaveBeenCalledWith([oldPath]);
  expect(remove.mock.invocationCallOrder[0]).toBeGreaterThan(
    rpc.mock.invocationCallOrder[0],
  );
});
test("un salvataggio fallito rimuove solo il nuovo file e conserva l’avatar in uso", async () => {
  const { repository, upload, remove, rpc } = fixture();
  rpc.mockResolvedValue({
    data: null,
    error: { message: "salvataggio fallito", code: "test" },
  });
  const oldPath = "11111111-1111-1111-1111-111111111111/profile.png";
  await expect(
    repository.uploadAvatar(
      new File(["image"], "avatar.png", { type: "image/png" }),
      oldPath,
    ),
  ).rejects.toThrow("salvataggio fallito");
  expect(remove).toHaveBeenCalledWith([upload.mock.calls[0]?.[0]]);
  expect(remove).not.toHaveBeenCalledWith([oldPath]);
});

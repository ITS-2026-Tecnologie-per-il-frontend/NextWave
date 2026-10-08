import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test, vi } from "vitest";
import { createCloudRepository } from "../../src/services/cloud/cloudRepository.ts";

function repositoryFixture() {
  const accounts = [
    {
      id: "one",
      name: "Primo",
      avatarPath: "one/profile-1.png",
      email: "one@example.com",
      owner: false,
      created: null,
    },
    {
      id: "two",
      name: "Secondo",
      avatarPath: null,
      email: "two@example.com",
      owner: false,
      created: null,
    },
  ];
  const rpc = vi.fn(async () => ({
    data: {
      access: { allowed: true, owner: true },
      accounts,
      applications: [],
    },
    error: null,
  }));
  const createSignedUrls = vi.fn(
    async (): Promise<{
      data: { path: string; signedUrl: string; error: string | null }[];
      error: { message: string } | null;
    }> => ({
      data: [
        {
          path: "one/profile-1.png",
          signedUrl: "https://example.com/current.png",
          error: null,
        },
      ],
      error: null,
    }),
  );
  const client = { rpc, storage: { from: () => ({ createSignedUrls }) } };
  return {
    repository: createCloudRepository(client as unknown as SupabaseClient),
    accounts,
    rpc,
    createSignedUrls,
  };
}

test("firma gli avatar privati correnti e usa le iniziali per chi non ha una foto", async () => {
  const { repository, createSignedUrls } = repositoryFixture();
  const result = await repository.adminDashboard();
  expect(createSignedUrls).toHaveBeenCalledWith(["one/profile-1.png"], 3600);
  expect(result.accounts[0].avatarUrl).toBe("https://example.com/current.png");
  expect(result.accounts[1].avatarUrl).toBeNull();
});
test("un errore Storage non nasconde la gestione degli account", async () => {
  const { repository, createSignedUrls } = repositoryFixture();
  createSignedUrls.mockResolvedValue({
    data: [],
    error: { message: "missing" },
  });
  const result = await repository.adminDashboard();
  expect(result.accounts).toHaveLength(2);
  expect(result.accounts[0].avatarUrl).toBeNull();
});
test("i moderatori non ricevono account né chiedono URL firmati", async () => {
  const { repository, rpc, accounts, createSignedUrls } = repositoryFixture();
  rpc.mockResolvedValue({
    data: {
      access: { allowed: true, owner: false },
      accounts,
      applications: [],
    },
    error: null,
  });
  expect((await repository.adminDashboard()).accounts).toEqual([]);
  expect(createSignedUrls).not.toHaveBeenCalled();
});

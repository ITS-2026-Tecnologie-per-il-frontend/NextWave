import { test, expect } from "@playwright/test";

for (const width of [320, 390, 768, 1440]) {
  test(`campi candidature contenuti a ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    for (const screen of ["artist", "admin"]) {
      await page.goto(`/?screen=${screen}&stress=false`);
      const filters = page.getByRole("group", { name: "Filtra candidature" });
      await expect(filters).toBeVisible();
      for (const field of await filters.locator("input, select").all()) {
        const fits = await field.evaluate((node) => {
          const box = node.getBoundingClientRect();
          const parent = node.parentElement!.getBoundingClientRect();
          return box.left >= parent.left && box.right <= parent.right + 1;
        });
        expect(fits).toBe(true);
      }
      await filters.locator('input[type="date"]').fill("2026-10-08");
      await expect(filters.locator('input[type="date"]')).toHaveValue(
        "2026-10-08",
      );
      await filters.screenshot({ path: testInfo.outputPath(`${screen}.png`) });
    }
  });
  test(`introduzione al primo accesso a ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 700 });
    await page.goto("/?screen=welcome");
    const dialog = page.getByRole("dialog", { name: "Benvenuto su NextWave" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading")).toBeInViewport();
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(box!.height).toBeLessThanOrEqual(700);
    await page.screenshot({ path: testInfo.outputPath("welcome.png") });
    await page.getByRole("button", { name: "Ho capito, iniziamo" }).click();
    await expect(dialog).toHaveCount(0);
    await page.reload();
    await expect(dialog).toHaveCount(0);
  });
}

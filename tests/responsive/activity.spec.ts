import { test, expect } from "@playwright/test";
for (const width of [390, 1440]) {
  test(`attività e filtri a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?screen=daily&stress=false");
    await expect(
      page.getByRole("button", { name: /Salva nei preferiti: brano 1/ }),
    ).toBeVisible();
    for (const button of await page
      .locator(".track > .favorite-toggle")
      .all()) {
      const bounds = await button.boundingBox();
      const card = await button.locator("..").boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(card!.x);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
        card!.x + card!.width,
      );
    }
    await page.screenshot({
      path: `test-results/activity-daily-${width}.png`,
      fullPage: true,
    });
    await page.goto("/?screen=artist&stress=false");
    const cards = page.locator(".artist-application");
    await expect(cards).toHaveCount(2);
    const first = await cards.nth(0).boundingBox();
    const second = await cards.nth(1).boundingBox();
    expect(second!.y - first!.y - first!.height).toBeGreaterThanOrEqual(16);
    await page.screenshot({
      path: `test-results/artist-spacing-${width}.png`,
      fullPage: true,
    });
    await page.goto("/?screen=profile&stress=false");
    await page
      .getByRole("button", { name: /Esplora scoperte salvate/ })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: `test-results/activity-profile-${width}.png`,
    });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await page.goto("/?screen=admin&stress=false");
    const refresh = await page
      .getByRole("button", { name: "Aggiorna pannello ↻" })
      .boundingBox();
    const calendar = await page
      .locator(".admin-content > section")
      .first()
      .boundingBox();
    expect(calendar!.y - refresh!.y - refresh!.height).toBeGreaterThanOrEqual(
      16,
    );
    await expect(
      page.getByRole("group", { name: "Filtra candidature" }),
    ).toBeVisible();
    await page.getByLabel("Filtra per artista").fill("inesistente");
    await expect(
      page.getByText("Nessuna candidatura corrisponde ai filtri selezionati."),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("eliminazione admin senza audio visibile su mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?screen=admin&stress=false&missingAudio=1");
  await expect(
    page.getByText("Audio mancante: la candidatura non può essere approvata."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Elimina candidatura", exact: true })
    .click();
  await page.getByLabel("Motivo dell’eliminazione").fill("Audio mancante");
  await expect(
    page.getByRole("button", { name: "Conferma eliminazione" }),
  ).toBeEnabled();
  await page
    .locator(".admin-review")
    .screenshot({ path: "test-results/admin-remove-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

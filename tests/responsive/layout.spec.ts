import { expect, test, type Page } from "@playwright/test";
import { themes } from "../../src/data/themes.ts";

test("admin identities keep avatars and long names inside narrow cards", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/?screen=admin");
  await expect(page).toHaveTitle("Next Wave — isolated layout fixtures");
  const list = page.locator(".admin-accounts");
  await expect(list.locator("li")).toHaveCount(2);
  const image = list.locator("img");
  await expect(image).toHaveAttribute("src", "/images/art.png");
  await expect
    .poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth))
    .toBeGreaterThan(0);
  for (const avatar of await list.locator(".avatar").all()) {
    const box = await avatar.boundingBox();
    expect(box!.width).toBe(48);
    expect(box!.height).toBe(48);
  }
  await expect(list.locator("li").last().locator(".avatar")).toHaveText("A");
  expect(await overflow(page)).toEqual({ page: false, offenders: [] });
});

const screens = [
  "auth",
  "onboarding",
  "daily",
  "empty",
  "revealed",
  "rankings",
  "profile",
  "artist",
  "admin",
  "reveal",
  "vote",
  "crop",
  "studio",
  "library",
];
const sizes = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 600, height: 800 },
  { width: 768, height: 1024 },
  { width: 960, height: 720 },
  { width: 1024, height: 768 },
  { width: 1101, height: 800 },
  { width: 1440, height: 900 },
  { width: 2560, height: 1440 },
  { width: 844, height: 390 },
];
async function prepare(page: Page, screen: string, stress = true) {
  await page.goto(`/?screen=${screen}&stress=${stress}`);
  await expect(page).toHaveTitle("Next Wave — isolated layout fixtures");
  await expect(page.locator("#app")).not.toBeEmpty();
  if (screen === "admin")
    await expect(
      page.getByRole("heading", { name: "Calendario e lista di attesa" }),
    ).toBeVisible();
  if (screen === "rankings")
    await expect(page.locator(".rankrow").first()).toBeVisible();
  if (screen === "profile") {
    await page
      .getByRole("button", { name: "Modifica nome", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Personalizza immagine", exact: true })
      .click();
  }
  if (screen === "artist")
    await page
      .getByRole("button", { name: "Candida un brano", exact: true })
      .click();
  if (screen === "studio")
    await page
      .getByRole("button", { name: /(?:Crea|Modifica) il tuo stile/ })
      .click();
  if (screen === "library")
    await page.getByRole("button", { name: /^I tuoi stili/ }).click();
  if (screen === "onboarding")
    await page.getByRole("button", { name: /Entra in Next Wave/ }).click();
  if (screen === "crop")
    await expect(page.locator(".crop-image")).toHaveJSProperty(
      "complete",
      true,
    );
  await expect(page.locator(".crop-stage")).toHaveCount(
    screen === "crop" ? 1 : 0,
  );
}
async function overflow(page: Page) {
  return page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll<HTMLElement>("#app *")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        if (
          !rect.width ||
          !rect.height ||
          getComputedStyle(element).position === "absolute" ||
          element.closest(
            ".queue-calendar, .crop-stage, .theme-art, .sr-only",
          ) ||
          (element.closest(".theme-catalog") &&
            !element.matches(".theme-catalog"))
        )
          return false;
        return rect.right > viewport + 1 || rect.left < -1;
      })
      .map((element) => `${element.tagName}.${element.className}`);
    return {
      page: document.documentElement.scrollWidth > viewport + 1,
      offenders,
    };
  });
}

for (const size of sizes) {
  test(`all pages fit ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    for (const screen of screens) {
      await test.step(screen, async () => {
        await prepare(page, screen);
        expect(await overflow(page), screen).toEqual({
          page: false,
          offenders: [],
        });
        const dialog = page.locator("dialog[open]");
        if (await dialog.count()) {
          const box = await dialog.boundingBox();
          expect(box!.y, screen).toBeGreaterThanOrEqual(0);
          expect(box!.y + box!.height, screen).toBeLessThanOrEqual(
            size.height + 1,
          );
          await dialog.locator("button").last().scrollIntoViewIfNeeded();
          const action = await dialog.locator("button").last().boundingBox();
          expect(action!.y + action!.height).toBeLessThanOrEqual(size.height);
        } else if (await page.locator(".player").count()) {
          const player = await page.locator(".player").boundingBox();
          const nav = await page.locator(".sidebar").boundingBox();
          if (size.width <= 960)
            expect(player!.y + player!.height).toBeLessThanOrEqual(nav!.y + 1);
        }
      });
    }
  });
}

test("mobile keeps rewind usable, navigation readable and footer above fixed controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await prepare(page, "daily");
  const rewind = page.getByRole("button", {
    name: "Torna indietro di 10 secondi",
  });
  await expect(rewind).toBeVisible();
  const target = await rewind.boundingBox();
  expect(target!.width).toBeGreaterThanOrEqual(44);
  expect(target!.height).toBeGreaterThanOrEqual(44);
  for (const button of await page.locator(".nav a").all()) {
    const box = await button.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await page.locator(".footerline").scrollIntoViewIfNeeded();
  const footer = await page.locator(".footerline").boundingBox();
  const player = await page.locator(".player").boundingBox();
  expect(footer!.y + footer!.height).toBeLessThanOrEqual(player!.y);
});

test("crop preview and exported image agree on narrow screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await prepare(page, "crop");
  await page.locator(".crop-stage").scrollIntoViewIfNeeded();
  const stage = await page.locator(".crop-stage").boundingBox();
  await page.mouse.move(
    stage!.x + stage!.width / 2,
    stage!.y + stage!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    stage!.x + stage!.width / 2 + 30,
    stage!.y + stage!.height / 2,
  );
  await page.mouse.up();
  await page.getByRole("button", { name: "Usa questa immagine" }).click();
  await expect(page.getByTestId("crop-result")).not.toBeEmpty();
  const result = JSON.parse(
    (await page.getByTestId("crop-result").textContent())!,
  );
  expect(result.left[0]).toBeGreaterThan(200);
  expect(result.middle[0]).toBeGreaterThan(200);
  expect(result.right[2]).toBeGreaterThan(200);
});

test("crop drag stays inside image bounds when resizing and zooming", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page, "crop");
  const stage = await page.locator(".crop-stage").boundingBox();
  await page.mouse.move(
    stage!.x + stage!.width / 2,
    stage!.y + stage!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    stage!.x + stage!.width + 500,
    stage!.y + stage!.height + 500,
  );
  await page.mouse.up();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect
    .poll(async () => {
      const image = await page.locator(".crop-image").boundingBox();
      const crop = await page.locator(".crop-stage").boundingBox();
      return (
        image!.x <= crop!.x + 1 &&
        image!.y <= crop!.y + 1 &&
        image!.x + image!.width >= crop!.x + crop!.width - 1 &&
        image!.y + image!.height >= crop!.y + crop!.height - 1
      );
    })
    .toBe(true);
});

test("enlarged text reflows on mobile and tablet", async ({ page }) => {
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 800 });
    for (const screen of [
      "auth",
      "onboarding",
      "profile",
      "admin",
      "rankings",
    ]) {
      await prepare(page, screen);
      await page.evaluate(() => {
        document.body.style.fontSize = "32px";
      });
      expect(
        await overflow(page),
        `${screen} at ${width}px with enlarged text`,
      ).toEqual({ page: false, offenders: [] });
    }
  }
});

test("visual review samples", async ({ page }, info) => {
  test.setTimeout(120000);
  test.skip(
    info.project.name !== "chromium",
    "One set of reference images is sufficient.",
  );
  for (const size of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(size);
    for (const screen of screens) {
      await prepare(page, screen, false);
      const path = info.outputPath(`${screen}-${size.width}.png`);
      await page.screenshot({
        path,
        fullPage: !["crop", "vote", "reveal", "studio", "library"].includes(
          screen,
        ),
      });
      await info.attach(`${screen}-${size.width}`, {
        path,
        contentType: "image/png",
      });
    }
  }
});

test("layout stays stable immediately around the breakpoints", async ({
  page,
}) => {
  for (const width of [600, 601, 960, 961, 1280, 1281]) {
    await page.setViewportSize({ width, height: 900 });
    for (const screen of ["daily", "revealed", "profile", "admin"]) {
      await prepare(page, screen);
      expect(await overflow(page), `${screen} at boundary ${width}`).toEqual({
        page: false,
        offenders: [],
      });
      if (screen === "daily") {
        const columns = await page
          .locator(".tracks")
          .evaluate(
            (element) =>
              getComputedStyle(element).gridTemplateColumns.split(" ").length,
          );
        expect(columns).toBe(
          width <= 600 ? 1 : width <= 960 ? 2 : width <= 1280 ? 3 : 5,
        );
      }
    }
  }
});

test("touch navigation reaches the profile", async ({ page }, info) => {
  test.skip(
    info.project.name !== "mobile-touch",
    "This check requires touch input.",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page, "daily");
  await page.getByRole("button", { name: "Apri profilo", exact: true }).tap();
  await expect(
    page.getByRole("heading", { name: "Il tuo spazio.", exact: true }),
  ).toBeVisible();
});

test("ranking date stays inside its panel and changes the selected day", async ({
  page,
}) => {
  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await prepare(page, "rankings");
    for (const period of ["Giornaliera", "Settimanale"]) {
      await page.getByRole("button", { name: period, exact: true }).click();
      const input = page.locator('.rankings-date-panel input[type="date"]');
      await input.fill("2026-10-06");
      await expect(input).toHaveValue("2026-10-06");
      const field = await input.boundingBox();
      const panel = await page.locator(".rankings-date-panel").boundingBox();
      expect(field!.x).toBeGreaterThanOrEqual(panel!.x);
      expect(field!.x + field!.width).toBeLessThanOrEqual(
        panel!.x + panel!.width,
      );
      expect(await overflow(page)).toEqual({ page: false, offenders: [] });
      await page
        .getByRole("button", { name: "Torna all’ultimo contest concluso" })
        .click();
      await expect(input).toHaveValue("2026-10-08");
    }
  }
});

test("solid mobile dock fits listener, artist and admin navigation", async ({
  page,
}) => {
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const [account, admin, count] of [
      ["listener", false, 2],
      ["artist", false, 3],
      ["artist", true, 4],
    ] as const) {
      await page.goto(`/?screen=daily&account=${account}&admin=${admin}`);
      const nav = page.getByRole("navigation", {
        name: "Navigazione principale",
      });
      await expect(nav.getByRole("link")).toHaveCount(count);
      const appearance = await nav.evaluate((element) => ({
        background: getComputedStyle(element).backgroundColor,
        image: getComputedStyle(element).backgroundImage,
        blur: getComputedStyle(element).backdropFilter,
      }));
      expect(appearance.image).toBe("none");
      expect(appearance.blur).toBe("none");
      expect(
        await page
          .locator(".player")
          .evaluate((element) => getComputedStyle(element).backdropFilter),
      ).toBe("none");
      expect(appearance.background).not.toBe("rgba(0, 0, 0, 0)");
      for (const button of await nav.getByRole("link").all()) {
        const box = await button.boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
      await page
        .getByRole("button", { name: "Apri profilo", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Il tuo spazio.", exact: true }),
      ).toBeVisible();
      await expect(
        nav.getByRole("link", { name: "Il tuo profilo" }),
      ).toHaveCount(0);
      expect(await overflow(page)).toEqual({ page: false, offenders: [] });
    }
  }
});

test("all presets keep a solid dock and the safe area clear", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/?screen=profile");
  const choices = page.locator(".theme-choice");
  await expect(choices).toHaveCount(themes.length);
  for (const choice of await choices.all()) {
    await choice.click();
    await expect(choice).toHaveAttribute("aria-pressed", "true");
    expect(await overflow(page)).toEqual({ page: false, offenders: [] });
    const nav = page.locator(".sidebar .nav");
    expect(
      await nav.evaluate(
        (element) => getComputedStyle(element).backgroundImage,
      ),
    ).toBe("none");
    expect(
      await nav
        .locator("a:not(.active)")
        .first()
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    ).toBe("rgba(0, 0, 0, 0)");
  }
  await page.evaluate(() =>
    document.documentElement.style.setProperty("--safe-bottom", "34px"),
  );
  const player = await page.locator(".player").boundingBox();
  const nav = await page.locator(".sidebar .nav").boundingBox();
  expect(player!.y + player!.height).toBeLessThanOrEqual(nav!.y);
  expect(nav!.y + nav!.height).toBeLessThanOrEqual(844 - 34);
  await page.locator(".footerline").scrollIntoViewIfNeeded();
  const footer = await page.locator(".footerline").boundingBox();
  expect(footer!.y + footer!.height).toBeLessThanOrEqual(player!.y);
});

test("player controls and progress stay centered with accessible volume and favorites", async ({
  page,
}, info) => {
  for (const width of [320, 390, 768, 961, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await prepare(page, "daily");
    const bar = page.getByRole("region", { name: "Player musicale" });
    const play = bar.getByRole("button", { name: "Riproduci", exact: true });
    const volume = bar.getByRole("slider", { name: "Volume" });
    const mute = bar.getByRole("button", { name: "Disattiva audio" });
    if (width <= 600) {
      await expect(volume).toBeHidden();
      await expect(mute).toBeHidden();
    } else {
      await expect(volume).toBeVisible();
      await expect(mute).toBeVisible();
    }
    await expect(
      bar.getByRole("button", { name: "Rimuovi il brano dai preferiti" }),
    ).toBeVisible();
    const bounds = await bar.boundingBox();
    const button = await play.boundingBox();
    if (width <= 600) {
      expect(bounds!.height).toBe(72);
      const heart = await bar.locator(".player-save").boundingBox();
      expect(heart!.x + heart!.width).toBeLessThanOrEqual(button!.x);
      const nav = await page.locator(".sidebar .nav").boundingBox();
      expect(nav!.y - bounds!.y - bounds!.height).toBeLessThanOrEqual(10);
    } else {
      expect(
        Math.abs(button!.x + button!.width / 2 - bounds!.x - bounds!.width / 2),
      ).toBeLessThan(2);
    }
    expect(await overflow(page)).toEqual({ page: false, offenders: [] });
    for (const target of [
      play,
      ...(width > 600 ? [mute] : []),
      bar.locator(".player-save"),
    ]) {
      const box = await target.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    if (info.project.name === "chromium" && [390, 1440].includes(width))
      await bar.screenshot({
        path: info.outputPath("player-" + width + ".png"),
      });
  }
});

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function fillLogin(page: Page) {
  await page.getByLabel("Email address").fill("test@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
}

test("all public routes and navigation work", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveTitle(/Football Analytics and Live Match Signals/);
  await page
    .getByRole("link", { name: "Get Started", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Sign In", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to home" }).click();
  await expect(page).toHaveURL("/");
  expect(errors).toEqual([]);
});

test("chart controls change the displayed market and aggregation", async ({
  page,
}) => {
  await page.goto("/");
  const preview = page.locator("#soccertradeview");
  await preview.getByRole("button", { name: /Chelsea/ }).click();
  await expect(
    preview.getByRole("button", { name: /Chelsea/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(preview.getByText("Chelsea to win")).toBeVisible();
  await preview.getByRole("button", { name: "5m", exact: true }).click();
  await expect(
    preview.getByRole("img", {
      name: /Chelsea illustrative match odds, 5 minute/,
    }),
  ).toBeVisible();
  await expect(preview.locator(".odds-chart > g rect")).toHaveCount(12);
});

test("signup validation, visibility and unavailable backend are honest", async ({
  page,
}) => {
  await page.goto("/signup");
  await page
    .getByRole("button", { name: "Create Account", exact: true })
    .click();
  await expect(page.getByLabel("Full name")).toBeFocused();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await page.getByLabel("Full name").fill("Sample Analyst");
  await fillLogin(page);
  await page.getByLabel("Confirm password", { exact: true }).fill("different");
  await page
    .getByRole("button", { name: "Create Account", exact: true })
    .click();
  await expect(page.getByText("Your passwords don’t match.")).toBeVisible();
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("test-password-only");
  await page
    .getByRole("button", { name: "Create Account", exact: true })
    .click();
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "authentication service has not been connected",
  );
  await expect(page).toHaveURL("/signup");
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 });
});

test("protected route redirects and login never fakes a session", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login(?:\?next=%2Fdashboard)?$/);
  await fillLogin(page);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "authentication service has not been connected",
  );
  await expect(page).toHaveURL("/login?next=%2Fdashboard");
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/signup", "/login"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      expect(overflow, `overflow on ${path}`).toBe(false);
    }
  });
}

test("mobile navigation supports keyboard dismissal and anchor links", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "SoccerTradeView", exact: true })
    .click();
  await expect(page).toHaveURL("/#soccertradeview");
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toHaveCount(0);
});

for (const path of ["/", "/signup", "/login"]) {
  test(`accessibility check ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    ).toEqual([]);
  });
}

test("unknown pages have a clear route home", async ({ page }) => {
  await page.goto("/does-not-exist");
  await expect(
    page.getByRole("heading", { name: "This page isn’t in play." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to home" }).click();
  await expect(page).toHaveURL("/");
});

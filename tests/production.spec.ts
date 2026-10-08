import { test, expect } from "@playwright/test";

for (const [path, heading] of [
  ["/", "See the match."],
  ["/signup", "Create your account"],
  ["/login", "Welcome back"],
]) {
  test(`static HTML and clean hydration for ${path}`, async ({
    page,
    request,
  }) => {
    const response = await request.get(path);
    expect(response.ok()).toBe(true);
    const html = await response.text();
    expect(html.includes(heading)).toBe(true);
    expect(html.includes("/_next/")).toBe(true);
    if (path !== "/") {
      expect(
        html.includes(`<title>Prime Edge Football — ${heading}</title>`),
      ).toBe(true);
      expect(html.includes('content="noindex, follow"')).toBe(true);
    }
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(path);
    if (path === "/") {
      await page
        .locator("#soccertradeview")
        .getByRole("button", { name: "5m", exact: true })
        .click();
      await expect(
        page
          .locator("#soccertradeview")
          .getByRole("button", { name: "5m", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
    } else {
      await expect(page.getByLabel("Email address")).toBeEnabled();
    }
    expect(errors).toEqual([]);
  });
}

test("protected and unknown paths survive direct production navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await page.goto("/unknown");
  await expect(
    page.getByRole("heading", { name: "This page isn’t in play." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

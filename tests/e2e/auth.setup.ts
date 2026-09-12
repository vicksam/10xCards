import { test as setup, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const authDir = path.resolve("playwright/.auth");
const authFile = path.join(authDir, "user.json");

setup("authenticate", async ({ page }) => {
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const email = process.env.TEST_USER_EMAIL ?? "test@example.com";
  const password = process.env.TEST_USER_PASSWORD ?? "password123";

  await page.goto("/auth/signin");
  const emailInput = page.getByLabel("Email");
  const passwordInput = page.getByLabel("Password", { exact: true });
  const signInButton = page.getByRole("button", { name: "Sign in" });

  await expect(emailInput).toBeVisible();
  await emailInput.click();
  await emailInput.pressSequentially(email, { delay: 10 });
  await passwordInput.click();
  await passwordInput.pressSequentially(password, { delay: 10 });

  await signInButton.click();

  // If React hydrated mid-typing and caused validation to show, retry once
  if (await page.getByText("Email is required").isVisible()) {
    await emailInput.fill(email);
    await passwordInput.fill(password);
    await signInButton.click();
  }

  await page.waitForURL("/dashboard", { timeout: 15000 });
  await expect(page.getByRole("heading", { name: /generate flashcards with ai/i })).toBeVisible();

  await page.context().storageState({ path: authFile });
});

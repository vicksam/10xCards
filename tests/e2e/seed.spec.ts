import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Risk R2: When finalization fails (network error, RPC 500), the UI must not silently
 * drop accepted cards. It must display "Save failed", the error details, and actionable
 * "Retry save" and "Discard" options.
 *
 * Full-cycle E2E test:
 * 1. Simulate failure on attempt 1 -> verify UI error banner + verify 0 DB rows written.
 * 2. Unblock network on attempt 2 -> click "Retry save" -> verify UI success screen.
 * 3. Verify flashcard is written to PostgreSQL in Supabase.
 * 4. Cleanup: Delete test flashcard from database so the test user's deck remains clean.
 */
test.describe("Flashcard finalization failure recovery (Risk R2)", () => {
  test("surfaces error banner on failure, persists on retry, and cleans up", async ({ page }) => {
    // 0. Initialize Supabase client for DB verification and cleanup
    const supabaseUrl = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
    const supabaseKey = process.env.SUPABASE_KEY ?? "";
    const email = process.env.TEST_USER_EMAIL ?? "test@example.com";
    const password = process.env.TEST_USER_PASSWORD;
    if (!password) throw new Error("TEST_USER_PASSWORD environment variable is required");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    expect(authError).toBeNull();
    if (!authData.user) throw new Error("Auth user missing");
    const userId = authData.user.id;

    // Unique card content to avoid collisions and track lifecycle
    const uniqueId = Date.now();
    const testFront = `What is spaced repetition? [${uniqueId}]`;
    const testBack = "An evidence-based learning technique using increasing intervals.";

    // Pre-create a valid generation_reviews row so the real backend RPC can finalize it
    const { data: genReview, error: genError } = await supabase
      .from("generation_reviews")
      .insert({
        user_id: userId,
        generated_count: 1,
      })
      .select("id")
      .single();
    expect(genError).toBeNull();
    if (!genReview) throw new Error("Generation review row creation failed");
    const generationId = String(genReview.id);

    try {
      // 1. Mock generation response so the test is deterministic, fast, and does not burn LLM credits
      await page.route("**/api/flashcards/generate", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            generationId,
            candidates: [{ front: testFront, back: testBack }],
          }),
        });
      });

      // 2. Intercept finalization endpoint: fail on attempt 1, succeed on attempt 2 (retry)
      let finalizeAttempts = 0;
      await page.route("**/api/flashcards", async (route) => {
        if (route.request().method() === "POST") {
          finalizeAttempts++;
          if (finalizeAttempts === 1) {
            // First attempt: simulate 500 network/RPC failure
            await route.fulfill({
              status: 500,
              contentType: "application/json",
              body: JSON.stringify({ error: "Failed to finalize cards in database" }),
            });
          } else {
            // Subsequent attempts (retry): let it pass through to the real backend
            await route.continue();
          }
        } else {
          await route.continue();
        }
      });

      // 3. Navigate to dashboard (authenticated via storageState)
      await page.goto("/dashboard");
      await expect(page.getByRole("heading", { name: /generate flashcards with ai/i })).toBeVisible();

      // 4. Fill study text and initiate generation
      const textArea = page.getByPlaceholder("Paste your study text here (articles, notes, documentation)...");
      await textArea.fill(`Study text notes for test card [${uniqueId}].`);

      const generateBtn = page.getByRole("button", { name: /generate flashcards/i });
      await expect(generateBtn).toBeEnabled();
      await generateBtn.click();

      // 5. Review card: accept the generated candidate card
      await expect(page.getByText(/card 1 of 1/i)).toBeVisible();
      await expect(page.getByText(testFront)).toBeVisible();
      await page.getByRole("button", { name: "Accept" }).click();

      // 6. Review Complete state reached
      await expect(page.getByRole("heading", { name: /review complete/i })).toBeVisible();
      const saveButton = page.getByRole("button", { name: /save 1 card to deck/i });
      await expect(saveButton).toBeVisible();

      // 7. Click save -> triggers attempt 1 (/api/flashcards injected 500 failure)
      await saveButton.click();

      // 8. Assert error UI state per Risk R2 contract
      await expect(page.getByText("Save failed")).toBeVisible();
      await expect(page.getByText("Failed to finalize cards in database")).toBeVisible();

      const retryButton = page.getByRole("button", { name: /retry save/i });
      await expect(retryButton).toBeVisible();
      await expect(retryButton).toBeEnabled();

      // 9. DB CHECK ON FAILURE: Verify NOTHING was written to the database!
      const { data: cardsAfterFailure } = await supabase
        .from("flashcards")
        .select("id")
        .eq("user_id", userId)
        .eq("front", testFront);
      expect(cardsAfterFailure).toHaveLength(0);

      // 10. RETRY WITH RESTORED CONNECTION: Click "Retry save" -> triggers attempt 2 to real backend
      const retryResponsePromise = page.waitForResponse(
        (res) => res.url().includes("/api/flashcards") && res.request().method() === "POST",
      );
      await retryButton.click();
      const retryResponse = await retryResponsePromise;

      expect(retryResponse.status()).toBe(200);
      expect(finalizeAttempts).toBe(2);

      // 11. Assert success screen is displayed
      await expect(page.getByRole("heading", { name: /1 card added to your deck/i })).toBeVisible();

      // 12. DB CHECK ON SUCCESS: Verify card was written to PostgreSQL!
      const { data: cardsAfterSuccess } = await supabase
        .from("flashcards")
        .select("id, front, back, source")
        .eq("user_id", userId)
        .eq("front", testFront);

      expect(cardsAfterSuccess).toHaveLength(1);
      expect(cardsAfterSuccess?.[0]?.front).toBe(testFront);
      expect(cardsAfterSuccess?.[0]?.source).toBe("ai");
    } finally {
      // 13. CLEANUP: Delete created flashcard and generation review so test user's deck remains clean
      await supabase.from("flashcards").delete().eq("user_id", userId).eq("front", testFront);
      await supabase.from("generation_reviews").delete().eq("id", generationId);

      // Verify cleanup succeeded
      const { data: cardsAfterCleanup } = await supabase
        .from("flashcards")
        .select("id")
        .eq("user_id", userId)
        .eq("front", testFront);
      expect(cardsAfterCleanup).toHaveLength(0);
    }
  });
});

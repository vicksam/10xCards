# Plan Brief: Scaffold Cleanup

**Change ID**: scaffold-cleanup
**Status**: planned

## Summary
The goal is to purge the remaining `10x-astro-starter` boilerplate and personalize the repository for 10xCards. This will be executed in three phases:

1. **Configuration & Asset Cleanup**
   - Update `package.json` name to `10x-cards`.
   - Disable Astro dev toolbar in `astro.config.mjs`.
   - Remove unused boilerplate files (`Welcome.astro`, `Topbar.astro`, `template.png`).

2. **Translation & SEO Setup**
   - Translate Polish strings in `config-status.ts` and `Layout.astro` to English.
   - Inject basic SEO metadata (Title, Description) into `Layout.astro`.

3. **Landing Page Replacement**
   - Implement a new `index.astro` with an auto-redirect to `/dashboard` for authenticated users.
   - Replace the generic landing page with a branded 10xCards hero section and auth buttons for public visitors.

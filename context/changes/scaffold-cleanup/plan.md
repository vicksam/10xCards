# Scaffold Cleanup Implementation Plan

## Overview

Purge the remaining `10x-astro-starter` boilerplate and personalize the repository for 10xCards. This includes updating configuration, removing unused scaffold assets, standardizing the language to English, adding basic SEO, and building a simple MVP landing page with smart redirects.

## Current State Analysis

- The project still uses the `10x-astro-starter` name in `package.json`.
- `Welcome.astro` and `Topbar.astro` are unused boilerplate files.
- `public/template.png` is an unused scaffold image.
- `config-status.ts` and `Layout.astro` contain hardcoded Polish strings and generic links.
- `Layout.astro` lacks basic SEO metadata like a meta description.
- `index.astro` still renders the generic starter landing page.
- The Astro dev toolbar is enabled and visible at the bottom of the screen.

## Desired End State

- The codebase represents `10x-cards` in all configs.
- Polish strings are translated to English.
- The landing page is a branded 10xCards MVP hero section.
- Logged-in users visiting the root `/` route are automatically redirected to `/dashboard`.
- Astro dev toolbar is disabled globally.
- Basic SEO tags (Title, Description) are present on all pages.

### Key Discoveries:
- Redirect logic for authenticated users can be handled directly in the frontmatter of `src/pages/index.astro` using `Astro.locals.user` and `Astro.redirect()`.
- The Astro dev toolbar can be disabled via `devToolbar: { enabled: false }` in `astro.config.mjs`.

## What We're NOT Doing
- We are not implementing OpenGraph or Twitter Card SEO tags (Basic SEO only).
- We are not redesigning the authenticated dashboard or other internal pages.

## Implementation Approach

We will execute this in three distinct phases: first cleaning up configs and unused files, then applying translations and basic SEO, and finally replacing the landing page itself.

---

## Phase 1: Configuration & Asset Cleanup
- Update `package.json`: Change `name` to `10x-cards` and add a `description` ("AI-powered flashcard generator").
- Update `astro.config.mjs`: Add `devToolbar: { enabled: false }` to the configuration object to hide the bottom taskbar.
- Delete `src/components/Welcome.astro`.
- Delete `src/components/Topbar.astro`.
- Delete `public/template.png`.

## Phase 2: Translation & SEO Setup
- Edit `src/lib/config-status.ts` to translate Polish strings to English:
  - Supabase message: "Supabase is not configured — authentication features are disabled."
  - Supabase docs label: "View configuration instructions"
  - OpenRouter message: "OpenRouter API key is not configured — AI flashcard generation is disabled."
  - OpenRouter docs label: "Get API key from OpenRouter"
- Edit `src/layouts/Layout.astro`:
  - Add `description?: string` to the `Props` interface (defaulting to "AI-powered flashcard generator").
  - Inject `<meta name="description" content={description} />` into the `<head>`.
  - Translate "Uwaga:" to "Warning:" and "Dokumentacja" to "Documentation" in the missing configs banner.

## Phase 3: Landing Page Replacement
- Edit `src/pages/index.astro`:
  - In the server-side frontmatter, check for `Astro.locals.user`. If a user exists, return `Astro.redirect("/dashboard")`.
  - Remove the import and usage of `<Welcome />`.
  - Build a simple Hero section inside `<Layout>` containing the title "10xCards", the subtitle "AI-powered flashcard generator that turns pasted study notes into review-ready Q&A cards.", and two call-to-action buttons for "Sign In" (`/auth/signin`) and "Sign Up" (`/auth/signup`).

---

## Progress

- [x] Phase 1: Configuration & Asset Cleanup — 2c6bd09
- [x] Phase 2: Translation & SEO Setup — dd92ee6
- [x] Phase 3: Landing Page Replacement

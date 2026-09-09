# Manual Card Creation and Flashcard Management Implementation Plan

## Overview

Implement manual flashcard creation and management (view, edit, delete) on a new dedicated `/cards` page, using a data table for listing and modal dialogs for creation and editing. This satisfies FR-005 and FR-006 from the PRD, serving as a safety valve for AI generation failures and standard data hygiene.

## Current State Analysis

- The `flashcards` table has a `source` column supporting `'manual'` and `'ai'`. It has RLS enabled.
- SRS scheduling columns are present from a recent migration.
- `src/pages/api/flashcards/index.ts` has a POST endpoint restricted to `finalize_generation_review`.
- No REST API endpoints exist for fetching, updating, deleting, or manually creating individual cards.
- The `Topbar.astro` handles main navigation but lacks a link for card management.

## Desired End State

Users can navigate to `/cards`, view a paginated/scannable data table of their existing flashcards (both AI and manual), edit any card's text in a modal, delete cards, and manually create new cards via a modal.

### Key Discoveries:

- `src/pages/api/flashcards/index.ts` exposes a POST. We should use standard Astro API route `GET` for the list, and a new `[id].ts` for `PUT/DELETE`. For manual creation, `POST /api/flashcards/manual` avoids clashing with `finalize_generation_review`.
- We need to fetch cards via the standard Supabase client in our API endpoints, enforcing RLS.
- shadcn/ui requires manual initialization of specific components like `table` and `dialog`.

## What We're NOT Doing

- **Bulk Editing:** Not supported; editing is per-card.
- **AI Generation from this view:** This page is strictly for manual CRUD. AI generation stays on the Dashboard.
- **Complex Filtering:** Initially, a simple sort (by created_at descending) and pagination is sufficient. No advanced search for MVP.

## Implementation Approach

We will build standard React components wrapping shadcn/ui components (`table`, `dialog`) and wire them to new Astro API endpoints. The React components will handle client-side data fetching and optimistic UI updates to keep interactions fast. The `/cards` page will be a thin Astro wrapper rendering this React management app.

## Critical Implementation Details

- **Routing & Path collision:** Ensure we map `POST /api/flashcards/manual.ts` or similar instead of accidentally hitting the `finalize_generation_review` logic in `index.ts`.

## Open Risks & Assumptions

- **Risk:** Clashing with the existing `POST /api/flashcards` endpoint.
  - **Mitigation:** We'll implement manual creation under `POST /api/flashcards/manual.ts` to cleanly separate it from AI generation reviews.
- **Assumption:** shadcn/ui is correctly initialized.
  - **Validation:** We will run `npx shadcn@latest add ...` and verify no conflicts.

## Implementation Phases

### Phase 1: API Endpoints (CRUD)
- Add `GET` export to `src/pages/api/flashcards/index.ts` to fetch user's flashcards. The endpoint must accept `page` and `limit` query parameters and return a `{ data, count }` object to support pagination.
- Create `src/pages/api/flashcards/manual.ts` with a `POST` export for manual card creation.
- Create `src/pages/api/flashcards/[id].ts` with `PUT` and `DELETE` exports.

#### Automated Verification:
- TypeScript compiler passes without errors on new API routes.

#### Manual Verification:
- `GET /api/flashcards` returns JSON array of flashcards for the logged-in user.
- `POST /api/flashcards/manual` creates a card in DB with source 'manual'.
- `PUT` and `DELETE` appropriately update and remove a specific card.

### Phase 2: UI Components Setup
- Run `npx shadcn@latest add table dialog input textarea dropdown-menu label`.
- Verify styling and correct imports.

#### Automated Verification:
- `npm run lint` passes on newly generated component files.

#### Manual Verification:
- UI components render correctly in a test route without throwing React errors.

### Phase 3: Card Management Page & Navigation
- Create `src/components/CardManager.tsx` with a basic data table structure and data fetching logic.
- Create `src/pages/cards.astro` wrapping `CardManager`.
- Update `src/components/Topbar.astro` to include a link to `/cards`.

#### Automated Verification:
- Build succeeds with new page included.

#### Manual Verification:
- Topbar displays the "My Cards" link and correctly navigates to the page.
- Table displays mock data or actual DB data correctly formatting Front, Back, Source, and Due.

### Phase 4: Create & Edit Modals
- Add a "Create Card" button triggering a modal form in `CardManager.tsx`.
- Add an "Edit" action to table rows triggering a prepopulated modal form.
- Wire both modals to the API with loading states.

#### Automated Verification:
- TS checks pass for form state and handlers.

#### Manual Verification:
- Clicking "Create Card" opens a clean modal. Submitting creates a card and updates the table.
- Clicking "Edit" on a card row opens a modal with existing text. Submitting updates the card and the table.

### Phase 5: Delete Functionality
- Add a "Delete" action to table rows.
- Wire to `DELETE` endpoint with confirmation (native `window.confirm` or an alert dialog).
- Ensure the table refreshes optimistically or via re-fetch.

#### Automated Verification:
- TS checks pass on the delete handler.

#### Manual Verification:
- Clicking "Delete" prompts for confirmation.
- After confirming, the card is removed from the database and the table updates.

## Addenda

- **SSR Pre-fetching**: Added server-side data fetching directly in `src/pages/cards.astro` to pre-load the first 10 cards and pass them to the client component, avoiding an initial loading spinner.
- **Global Navigation**: Updated `src/layouts/Layout.astro` and `src/middleware.ts` (PROTECTED_ROUTES) in addition to `Topbar.astro` to ensure full navigation integration and route security.

## Progress

- [x] Phase 1: API Endpoints (CRUD) — b1fd3f7
- [x] Phase 2: UI Components Setup — 2d8e4b8
- [x] Phase 3: Card Management Page & Navigation — 291ae5d
- [x] Phase 4: Create & Edit Modals — 5366f9c
- [x] Phase 5: Delete Functionality — 137ceb9

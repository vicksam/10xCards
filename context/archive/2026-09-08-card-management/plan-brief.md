# Manual Card Creation and Flashcard Management — Plan Brief

> Full plan: `context/changes/card-management/plan.md`

## What & Why

We are implementing a dedicated management view for flashcards where users can manually create new cards and view, edit, or delete existing ones. This fulfills core functional requirements (FR-005, FR-006) and acts as a necessary safety valve if AI generation fails or produces minor inaccuracies that need correction.

## Starting Point

The database schema (`flashcards` table with RLS) is fully prepared and AI flashcard generation is operational, but there are no REST API endpoints for standard card CRUD and no UI for the user to see or manage their saved deck.

## Desired End State

Users can click "My Cards" in the top navigation to view a paginated data table of all their flashcards. From this view, they can edit or delete existing cards via inline modals, and manually create new cards to add to their deck.

## Key Decisions

- **UI Layout:** We opted for a dedicated `/cards` page with a data table rather than cluttering the dashboard's generator view.
- **Editing Workflow:** We chose inline modal dialogs for both creation and editing to keep the user in the context of their deck without slow page reloads.
- **API Routing:** Manual creation will use a new `POST /api/flashcards/manual.ts` endpoint to avoid colliding with the specialized `index.ts` POST logic used for saving AI-generated batches.

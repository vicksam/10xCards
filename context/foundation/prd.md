---
project: "10xCards"
version: 1
status: draft
created: 2026-07-27
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-09-14
  after_hours_only: true
---

## Vision & Problem Statement

Manual flashcard creation is both mechanically slow (workflow friction) and happens at the worst possible moment — after an evening study session when energy and willpower are depleted. The result is that professionals who want to retain knowledge simply drop the habit of making flashcards entirely, losing the retention benefit of spaced repetition.

Anki and Quizlet still require card-by-card manual authoring and offer no AI generation. Recent LLM quality now makes it viable to auto-generate accurate, atomic Q&A pairs from pasted text — shifting the user's role from author to reviewer.

## User & Persona

### Primary Persona: Professional Upskiller

- **Profile**: Working professionals learning new skills or domains on their own time (e.g. developers, doctors, lawyers, consultants — no specific vertical locked).
- **The Moment**: After finishing an evening study session — energy is low, faced with the blank card editor. They want to retain what they just read but not spend another 30 minutes writing cards.
- **Goal**: Turn what they just studied into review-ready flashcards with minimal effort, then come back to study them later.

## Success Criteria

### Primary
- **≥75% AI Card Acceptance Rate**: At least 75% of AI-generated candidate flashcards are accepted or edited-then-saved by the user — directly measures AI generation quality.
- **≥75% AI Creation Preference**: At least 75% of all flashcards added to a user's deck are created via AI generation rather than manual entry.

### Secondary
- **Regular Review Habit**: Users complete at least one spaced repetition study session per week after their initial setup.

### Guardrails
- **Study Session Reliability**: The spaced repetition review session must work reliably — a broken review loop kills the core retention promise.

## User Stories

### US-01: Professional generates flashcards from study text and reviews them

- **Given** a logged-in professional who has just finished a study session and has text to convert
- **When** they paste the text and trigger AI generation
- **Then** they see a set of candidate flashcards and can accept, edit, or reject each one; accepted cards are saved to their deck

#### Acceptance Criteria
- AI generation produces at least one candidate card from any non-trivial text input
- Edit-then-save counts as "accepted" for the 75% acceptance-rate metric

## Functional Requirements

### Authentication

- FR-001: User can register with email + password. Priority: must-have
  > Socrates: Counter-argument considered: "auth adds friction at exactly the wrong moment; anonymous first-use would prove value faster." Resolution: auth is required — cards must persist across devices and sessions, which is core to the spaced repetition habit. No counter-argument; stands as written.

- FR-002: User can log in; session remains active for 7 days and is extended on each use. Priority: must-have
  > Socrates: Counter-argument raised: "log out is unnecessary for a personal tool — nobody logs out." Resolution: accepted. Explicit log out dropped from MVP. Session lasts 7 days, auto-prolonged on use.

### Flashcard Generation

- FR-003: User can paste a block of text and trigger AI flashcard generation. Priority: must-have
  > Socrates: Counter-argument considered: "copy-paste is a UX barrier; users may expect browser extension or URL import instead." Resolution: copy-paste is the MVP scope; import formats are a listed non-goal. No counter-argument; stands as written.

- FR-004: User can review AI-generated candidate cards and accept, edit, or reject each. Priority: must-have
  > Socrates: Counter-argument raised: "editing AI-generated cards blurs the acceptance metric — edit-then-save should count as 'accepted' for the 75% KPI." Resolution: accepted. Definition locked — edit-then-save = accepted. This is recorded in Acceptance Criteria of US-01.

### Flashcard Management

- FR-005: User can manually create a flashcard (front + back). Priority: must-have
  > Socrates: Counter-argument considered: "manual creation adds scope and contradicts the '75% AI preference' goal — drop from MVP." Resolution: manual creation is the safety valve for AI failures and an explicit feature in idea-notes.md. No counter-argument; stands as written.

- FR-006: User can view, edit, and delete their saved flashcards. Priority: must-have
  > Socrates: Counter-argument considered: "bulk management adds UI complexity — view-only is enough for MVP." Resolution: edit and delete are standard data hygiene; their absence would force users to keep incorrect cards. No counter-argument; stands as written.

### Study Session

- FR-007: User can start a spaced repetition study session using an existing open-source algorithm (e.g. SM-2 / FSRS). Priority: must-have
  > Socrates: Counter-argument considered: "off-the-shelf SR libraries exist; integration risk is low — the concern is the UI for the review loop itself." Resolution: the FR captures the capability and algorithm requirement; UI design is downstream. No counter-argument to the FR itself; stands as written.

## Non-Functional Requirements

- The user sees visible progress acknowledgement within 2 seconds of triggering AI generation; the full set of candidate cards arrives within 30 seconds under normal conditions.
- Study text submitted for AI generation leaves no trace in operator-accessible storage after the request that produced the candidate cards completes.
- The product is fully usable on the latest two major versions of Chrome, Firefox, Safari, and Edge on desktop.

## Business Logic

The application converts a block of study text into a set of atomic Q&A flashcard candidates, which the user accepts or rejects, and then schedules each accepted card for future review based on the user's self-rated recall performance.

**Generation rule**: The user provides raw text from their study session as input. The application produces candidate flashcard pairs (question + answer) from that text. The user then acts as a quality gate — each candidate is either accepted (as-is or after editing) or rejected. Only accepted cards enter the user's active deck. Edit-then-save is treated as acceptance.

**Scheduling rule**: After each study session, the application determines when each reviewed card should next appear, based on how confidently the user recalled the answer. Cards the user recalled easily are shown further in the future; cards recalled with difficulty are shown sooner. The scheduling algorithm is an existing open-source implementation (e.g. SM-2 or FSRS) — the application applies its output without modification.

## Access Control

- **Authentication**: Login via email + password — cards must persist across devices and sessions. OAuth and passwordless are deferred beyond MVP.
- **Role Model**: Flat user model. Every account is equal; each user manages only their own private flashcards.
- **Unauthenticated access**: No access to flashcard features; unauthenticated users are redirected to login/register.

## Non-Goals

1. **No file import (PDF, DOCX, URL)** — copy-paste is the only input method for MVP.
2. **No deck sharing or collaboration between users** — single-tenant, private decks only.
3. **No custom spaced repetition algorithm** — integrate an existing open-source implementation (SM-2 / FSRS) without modification.
4. **No mobile app or mobile-optimized UI** — desktop web browsers only for MVP.
5. **No offline-first capability** — internet connection required for all features.
6. **No OAuth or passwordless auth** — MVP uses email + password only; alternative auth methods are deferred.

## Open Questions

_None — all product-level decisions have been locked during shaping._

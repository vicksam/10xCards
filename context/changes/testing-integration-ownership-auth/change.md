---
change_id: testing-integration-ownership-auth
title: Integration tests for ownership and auth boundaries
status: preparing
created: 2026-09-14
updated: 2026-09-14
archived_at: null
---

## Notes

Open a change folder for rollout Phase 4 of context/foundation/test-plan.md: "Integration — ownership & auth boundaries".
Risks covered: R5, R6. Test types planned: integration (two test users, simulated expired session).
Risk response intent:
- R5: When the session cookie expires during a study session, the component shows a clear auth-expired message rather than silent failure or a generic error.
- R6: User B cannot finalize or delete User A's generation ID, even with a valid UUID — the call returns an error or affects zero rows.
After creating the folder, follow the downstream continuation rule.

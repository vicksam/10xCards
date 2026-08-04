---
starter_id: 10x-astro-starter
package_manager: npm
project_name: 10x-cards
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
---

## Why this stack

Solo developer shipping a flashcard web app (10xCards) in 3 weeks of after-hours work, with auth and AI generation as must-have features. The 10x Astro Starter is the recommended default for `(web-app, js)` and clears all four agent-friendly criteria — TypeScript end-to-end, strong Astro conventions, popular in JS training data, and well-documented. Supabase handles auth and PostgreSQL storage out of the box, covering FR-001/FR-002 without additional wiring. Cloudflare Pages/Workers provides edge deployment with API routes for the LLM integration (FR-003/FR-004). Scaffolding confidence is first-class — the CLI is registered and expected to work smoothly. CI runs on GitHub Actions with auto-deploy-on-merge, the starter's default shape.

---
bootstrapped_at: 2026-08-04T07:12:08+02:00
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: 10x-cards
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

Verbatim copy of `context/foundation/tech-stack.md` at time of bootstrap:

```yaml
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
```

## Why this stack

Solo developer shipping a flashcard web app (10xCards) in 3 weeks of after-hours work, with auth and AI generation as must-have features. The 10x Astro Starter is the recommended default for `(web-app, js)` and clears all four agent-friendly criteria — TypeScript end-to-end, strong Astro conventions, popular in JS training data, and well-documented. Supabase handles auth and PostgreSQL storage out of the box, covering FR-001/FR-002 without additional wiring. Cloudflare Pages/Workers provides edge deployment with API routes for the LLM integration (FR-003/FR-004). Scaffolding confidence is first-class — the CLI is registered and expected to work smoothly. CI runs on GitHub Actions with auto-deploy-on-merge, the starter's default shape.

---

## Pre-scaffold verification

| Signal      | Value    | Severity | Notes                                                                                 |
| ----------- | -------- | -------- | ------------------------------------------------------------------------------------- |
| npm package | not run  | n/a      | cmd_template starts with `git clone`; npm package check skipped per spec              |
| GitHub repo | not run  | n/a      | `gh` CLI not found on PATH; recency check unavailable                                 |

No recency signal was collected for this run. The `gh` CLI was not installed; the npm package check was skipped because the cmd_template is a `git clone` invocation, not a `create-*` npm CLI. Install `gh` and re-run for a recency signal.

---

## Scaffold log

**Resolved invocation**:
```
git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install
```

**Strategy**: git-clone (clone the starter repo without keeping its git history)

**Exit code**: 0

**Upstream `.git/` deleted**: yes — cloned `.git/` removed before move-up so upstream starter history does not leak into this repo.

**Files moved**: 19

| File / Directory    | Action         | Notes                                                               |
| ------------------- | -------------- | ------------------------------------------------------------------- |
| `.env.example`      | moved silently |                                                                     |
| `.github/`          | moved silently |                                                                     |
| `.gitignore`        | moved silently | no prior `.gitignore` in cwd                                        |
| `.husky/`           | moved silently |                                                                     |
| `.nvmrc`            | moved silently |                                                                     |
| `.prettierrc.json`  | moved silently |                                                                     |
| `.vscode/`          | moved silently |                                                                     |
| `CLAUDE.md`         | moved silently | not in cwd; scaffold copy moved                                     |
| `README.md`         | **sidelined**  | cwd had a `README.md`; scaffold copy → `README.md.scaffold`         |
| `astro.config.mjs`  | moved silently |                                                                     |
| `components.json`   | moved silently |                                                                     |
| `eslint.config.js`  | moved silently |                                                                     |
| `node_modules/`     | moved silently | 778 packages installed                                              |
| `package-lock.json` | moved silently |                                                                     |
| `package.json`      | moved silently | no prior `package.json` in cwd                                      |
| `public/`           | moved silently |                                                                     |
| `src/`              | moved silently |                                                                     |
| `supabase/`         | moved silently |                                                                     |
| `tsconfig.json`     | moved silently |                                                                     |
| `wrangler.jsonc`    | moved silently |                                                                     |

**Conflicts (`.scaffold` siblings)**: `README.md.scaffold`

**`.gitignore` handling**: moved silently (no prior `.gitignore` in cwd)

**`.bootstrap-scaffold` cleanup**: deleted (directory empty after move-up)

**`context/` preserved**: yes — `context/` in cwd was untouched throughout

---

## Post-scaffold audit

**Tool**: `npm audit --json`

**Summary**: 1 CRITICAL, 12 HIGH, 7 MODERATE, 2 LOW

**Direct vs transitive**:
- 0 CRITICAL direct / 1 CRITICAL transitive
- 1 HIGH direct (`astro`) / 11 HIGH transitive
- 2 MODERATE direct (`supabase`, `wrangler`) / 5 MODERATE transitive
- 0 LOW direct / 2 LOW transitive

#### CRITICAL findings

| Package | Range     | Advisory                              | Description                                      | Fix       |
| ------- | --------- | ------------------------------------- | ------------------------------------------------ | --------- |
| `tar`   | ≤7.5.18   | GHSA-23hp-3jrh-7fpw                   | Decompression/parse DoS via unlimited input      | Available |

`tar` is transitive via `supabase`. Run `npm audit fix` to resolve.

#### HIGH findings

| Package            | isDirect | Advisory / Notes                                          |
| ------------------ | -------- | --------------------------------------------------------- |
| `astro`            | **yes**  | Rolls up sharp/svgo/vite/devalue chains                   |
| `brace-expansion`  | no       | ReDoS                                                     |
| `devalue`          | no       | High-severity advisory                                    |
| `fast-uri`         | no       | CVSS 7.5 — integrity issue (≥3.0.0 <3.1.5)               |
| `js-yaml`          | no       | Quadratic DoS in merge key handling (4.0.0–4.2.0; CVSS 7.5) |
| `miniflare`        | no       | Rolls up sharp + undici + ws                              |
| `postcss`          | no       | Path traversal in sourceMappingURL (≤8.5.22; CVSS 7.5)   |
| `sharp`            | no       | Inherited libvips CVEs (CVE-2026-33327/33328; <0.35.0)    |
| `svgo`             | no       | removeScripts incomplete (CVSS 8.2)                       |
| `undici`           | no       | HIGH advisory                                             |
| `vite`             | no       | HIGH advisory                                             |
| `ws`               | no       | HIGH advisory                                             |

#### MODERATE findings

| Package                 | isDirect | Notes                                  |
| ----------------------- | -------- | -------------------------------------- |
| `@astrojs/language-server` | no    | Moderate advisory                      |
| `@cloudflare/vite-plugin`  | no    | Via undici/ws chain                    |
| `postcss`               | no       | Incomplete fix GHSA-6g55-p6wh-862q     |
| `supabase`              | **yes**  | Via `tar` moderate sub-advisories      |
| `volar-service-yaml`    | no       | Via yaml chain                         |
| `wrangler`              | **yes**  | Via miniflare/undici/ws chain          |
| `yaml`                  | no       | Moderate advisory                      |
| `yaml-language-server`  | no       | Moderate advisory                      |

#### LOW / INFO findings

| Package      | isDirect | Notes         |
| ------------ | -------- | ------------- |
| `@babel/core` | no      | Low advisory  |
| `esbuild`    | no       | Low advisory  |

---

## Hints recorded but not acted on

| Hint                    | Value              |
| ----------------------- | ------------------ |
| `bootstrapper_confidence` | first-class      |
| `quality_override`      | false              |
| `path_taken`            | standard           |
| `self_check_answers`    | null               |
| `team_size`             | solo               |
| `deployment_target`     | cloudflare-pages   |
| `ci_provider`           | github-actions     |
| `ci_default_flow`       | auto-deploy-on-merge |
| `has_auth`              | true               |
| `has_payments`          | false              |
| `has_realtime`          | false              |
| `has_ai`                | true               |
| `has_background_jobs`   | false              |

A future M1L4 skill will use `has_auth: true`, `has_ai: true`, `deployment_target: cloudflare-pages`, and `ci_provider: github-actions` to generate agent context files and CI scaffolding. v1 preserves the audit trail only.

---

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:

- `git init` (if you have not already) to start your own repo history.
- Review `README.md.scaffold` — the starter's full README vs your existing placeholder. You'll likely want to replace `README.md` with the scaffold version.
- **Run `npm audit fix`** — the CRITICAL `tar` advisory has a fix available and most HIGH findings resolve the same way.
- Copy `.env.example` to `.env` and fill in your Supabase and Cloudflare credentials.
- Run `supabase link` to connect `supabase/` to your remote Supabase project.
- Configure `wrangler.jsonc` with your Cloudflare account and Pages project.

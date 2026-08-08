# 10xCards

AI-powered flashcard generator that turns pasted study notes into review-ready Q&A cards — so you retain what you learned without the manual authoring grind.

## Tech Stack

- [Astro](https://astro.build/) v6 — Server-first rendering (SSR on Cloudflare Workers)
- [React](https://react.dev/) v19 — Interactive UI components
- [TypeScript](https://www.typescriptlang.org/) v5 — Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) v4 — Utility-first styling
- [Supabase](https://supabase.com/) — Auth & Postgres database
- [Cloudflare Workers](https://workers.cloudflare.com/) — Edge deployment runtime

## Prerequisites

- Node.js v22.14.0 (see `.nvmrc`)
- npm (comes with Node.js)
- Docker (for local Supabase)

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set up environment variables:

   ```bash
   cp .env.example .env
   cp .env.example .dev.vars
   ```

3. Start local Supabase (requires Docker, ~7 GB RAM):

   ```bash
   npx supabase start
   ```

4. Copy the credentials printed by the CLI into `.env` and `.dev.vars`:

   ```
   SUPABASE_URL=http://127.0.0.1:54321
   SUPABASE_KEY=<anon key from CLI output>
   ```

5. Run the development server:

   ```bash
   npm run dev
   ```

## Available Scripts

| Command              | Description                                  |
| -------------------- | -------------------------------------------- |
| `npm run dev`        | Start dev server (Cloudflare workerd runtime) |
| `npm run build`      | Build for production                         |
| `npm run preview`    | Preview production build                     |
| `npm run lint`       | Run ESLint with type-checked rules           |
| `npm run lint:fix`   | Auto-fix ESLint issues                       |
| `npm run format`     | Run Prettier                                 |

## Project Structure

```
src/
├── components/       # Astro (static) & React (interactive) components
│   ├── auth/         # Authentication components
│   └── ui/           # shadcn/ui components (new-york style)
├── layouts/          # Astro layouts
├── lib/              # Shared services & utilities
├── pages/            # Server-rendered routes
│   ├── api/          # API endpoints
│   └── auth/         # Auth pages (signin, signup, confirm-email)
└── styles/           # Global styles
supabase/
└── migrations/       # Database migrations (RLS required)
```

## Supabase Configuration

Environment variables are declared via Astro's `astro:env` schema and are **server-only secrets** — never exposed to the client.

### Local development

1. Start the local stack:

   ```bash
   npx supabase start
   ```

2. The local Studio UI is available at `http://localhost:54323`.

3. To stop:

   ```bash
   npx supabase stop
   ```

### Cloud Supabase project

Add these to `.env` and `.dev.vars`:

| Variable       | Source                                     |
| -------------- | ------------------------------------------ |
| `SUPABASE_URL` | Supabase dashboard → Settings → API        |
| `SUPABASE_KEY` | `anon` public key → Settings → API         |

## Deployment

Deploys to [Cloudflare Workers](https://workers.cloudflare.com/).

```bash
npm run build
npx wrangler deploy
```

Set `SUPABASE_URL` and `SUPABASE_KEY` as secrets via `npx wrangler secret put` or in the Cloudflare dashboard.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs lint + build on every push and PR to `master`. Configure `SUPABASE_URL` and `SUPABASE_KEY` as repository secrets for the build step.

## License

MIT
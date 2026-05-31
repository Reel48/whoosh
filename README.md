# Whoosh

Marketing and subscription site for Whoosh — premium Discord communities.

Built with [Next.js](https://nextjs.org) (App Router), TypeScript, and Tailwind CSS.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — run ESLint
- `npm test` — run the Vitest suite

## Database (Supabase)

The Postgres schema and **all** the money-engine functions (`fn_credit_ledger`,
`fn_invest_buy/sell`, `fn_place_wager`, `fn_transfer`, `fn_settle_event*`,
interest/dividend accrual, leaderboards, …) live in version control under
`supabase/migrations/`. These files are the source of truth — never edit schema
through the dashboard.

Remote project ref: `yjmohosxtemjamwrsffw` (Postgres 17.6).

### Making a schema change

```bash
npx supabase migration new <name>      # creates supabase/migrations/<ts>_<name>.sql
# …edit the new file…
npx supabase db push                   # apply to the remote (review in PR first)
npx supabase gen types typescript --linked > src/lib/database.types.ts  # if types are in use
```

One-time link: `npx supabase link --project-ref yjmohosxtemjamwrsffw`.

### Reproduce the schema locally

Requires Docker running:

```bash
npx supabase start      # boots a local Postgres + storage + studio
npx supabase db reset   # applies every migration from scratch, then supabase/seed.sql
```

`db reset` is also the way to verify a fresh, in-order apply of all migrations.

## Roadmap

- Connect Whoosh's own Stripe account for subscription checkout
- Grant premium Discord roles/channel access on successful subscription

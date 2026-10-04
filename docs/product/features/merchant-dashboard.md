# 10. Merchant dashboard

- Priority: P0
- Status: Done

## Purpose

What the merchant sees, and the Storybook showcase of the project.

## Rules

- Screens: sign in, charges list (filters, cursor pagination), charge detail (attempts, events, ledger entries), balances per currency, API keys
- Data comes from the API through the shared contract; no hand-written response types
- Every component covers empty, loading, error and long-data states, each with a Storybook story
- Amounts are formatted from minor units with the currency's decimals; never parsed to floats for math
- Visual direction follows `docs/design/` (phase 4); UI copy in English
- Accessible: keyboard navigation, labels, AA contrast

## Acceptance criteria

- [x] A member signs in and sees only their organization's data
- [x] `10000000` USDT minor units display as 10 USDT (exact format set in design)
- [x] Storybook builds statically with a story per real state and accessibility checks on

## How it works

- `apps/web`: `app/` (router, layout) → `features/*` (auth, charges, balances, api-keys) → `lib/` (API client, session);
  ESLint forbids a feature importing another feature or the app
- The access token lives in memory; a reload restores it with the httpOnly refresh cookie. Concurrent 401s share one refresh
- Charge detail polls every 5 s while the charge is open; the payment rail is derived from attempts and ledger entries
- `packages/ui`: design system with Storybook 10 and the a11y addon (`pnpm --filter @po/ui storybook`)
- API additions: `GET /v1/charges?status=` and `GET /v1/charges/:id/events`

## Out of scope

Analytics charts, team management UI, exports.

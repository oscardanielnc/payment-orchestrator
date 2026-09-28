# 10. Merchant dashboard

- Priority: P0
- Status: Approved

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

- [ ] A member signs in and sees only their organization's data
- [ ] `10000000` USDT minor units display as 10 USDT (exact format set in design)
- [ ] Storybook builds statically with a story per real state and accessibility checks on

## Out of scope

Analytics charts, team management UI, exports.

# Conventions

Rules the linter cannot enforce.

## Money

- Amounts are integers in the currency's minor unit plus a currency code. Never floats.
- Decimals per currency: USD 2, PEN 2, USDT 6, USDC 6.

## Safety

- Test mode and testnets only. Live keys and mainnet endpoints are never used, not even as examples.
- No secrets in git. `.env.example` stays current.

## Git

- Conventional Commits. Short branches, PRs to `main`.
- Docs change in the same PR as the code that affects them.

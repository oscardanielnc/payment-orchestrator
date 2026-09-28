# 11. Payment links & checkout

- Priority: P1
- Status: Approved

## Purpose

Lets merchants charge without integrating the API.

## Rules

- A payment link creates (or points to) a charge; its URL uses a non-guessable id
- Public checkout page: merchant, amount, expiry and available methods
- Card methods hand off to the provider's UI; crypto shows address, exact amount, network and QR
- Status updates live on the page (mechanism decided in architecture)
- The page states clearly that it is a test environment

## Acceptance criteria

- [ ] Opening a link shows amount and methods; an expired link shows an expired state
- [ ] Paying with USDT on Nile updates the page to succeeded without reload
- [ ] The checkout never shows or accepts mainnet networks

## Out of scope

Per-merchant branding, multiple items, taxes.

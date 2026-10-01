# Visual direction

> Status: Chosen (2026-10-01). First proof screen: charge detail.

## References

| Product | Take | Avoid |
|---|---|---|
| Stripe Dashboard | Dense, readable payments table; event timeline in detail; persistent test-mode banner | Its violet and typeface |
| Mercado Pago | Checkout for non-technical people; amount is the biggest thing on screen | Banners and promos in the panel |
| Coinbase Commerce | Crypto checkout: QR, copyable address, exact amount, network always visible, expiry countdown | Hiding the network |
| Modern Treasury | Debit/credit entries in detail; explicit pending/posted | Raw accounting jargon for merchants |
| Mercury | Amounts with strong typographic presence; calm balances; whitespace | Decorative dark gradients |
| Linear | Density without noise, keyboard shortcuts, filter chips | Dark glow aesthetic |
| Wise | Transfer tracking as a journey with stations, in plain language | Brand illustrations with no information |

## Chosen direction

| Area | Choice | Why |
|---|---|---|
| Layout | **L1** Sidebar + table + detail page | Familiar to merchants; the detail page has room for the payment rail and ledger entries |
| Palette | **P1 Carbon copy**: near-black ink + carbon-paper blue | The carbon copy duplicated every receipt, like double-entry duplicates every movement |
| Type | **T2** Schibsted Grotesk (headings) · Source Sans 3 (text) · IBM Plex Mono (amounts, ids) | Firm and compact; comfortable in dense tables; tabular figures align money columns |
| Signature | **S2 Payment rail** | One picture that explains an orchestrator: stations from created to posted, blocks filling up to finality |
| Motion | **M1** Only what informs | Animate state changes, never decoration |

## Signature element: payment rail

```
●───────●───────◐───────○───────○
Created Routed  On chain Final   Posted
                ■■■■■■■■■■■■□□□□□□□ 12/19 blocks
```

- Stations come from the charge's real events, never invented
- Full version in charge detail and checkout; compact one-line version in the charges table
- Crypto rails show block progress to finality; card rails skip "On chain" and show "Authorized"
- Pending station pulses; reached stations are solid; failed ends the rail with ✕

## Component rules

- **Status chip** = shape + color + text, never color alone: Pending ◐ amber, Succeeded ● green, Failed ✕ red, Expired ○ grey
- **Amounts**: formatted only in the UI from minor units; mono with tabular figures; right-aligned in tables; currency code always visible (`USDT`, never a symbol)
- **Ids and hashes**: mono, middle-truncated (`TXy7…k9Qa`) with copy button
- **Environment banner**: fixed strip on every screen, "Test mode · TRON Nile · Base Sepolia"
- **Cards** only for objects that stand alone (balance, checkout); tables and lists are not cards
- Radii small (4–8 px); shadows only on floating layers (menus, dialogs)

## Motion

| Animated | Not animated |
|---|---|
| Pending pulse · blocks filling · status change (brief highlight then static) · balance figure update | Page transitions · cards entering · decorative hovers |

All motion disabled under `prefers-reduced-motion`.

## History

- 2026-10-01 — Direction chosen from the menu: L1 · P1 · T2 · S2 · M1

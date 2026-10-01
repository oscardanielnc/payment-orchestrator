# Design tokens

> Status: v1 (2026-10-01). Source for `packages/ui` theme. Every text/background pair below passes WCAG AA (≥ 4.5:1).

## Color

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F6F7F9` | `#0F131B` | Page background |
| `surface` | `#FFFFFF` | `#171C26` | Tables, panels, cards |
| `surface-accent` | `#EEF1FD` | `#1C2440` | Selected row, active nav, info banner |
| `line` | `#D8DCE4` | `#2A3140` | Borders and dividers (non-text) |
| `ink` | `#161B26` | `#E7EAF0` | Primary text |
| `muted` | `#5A6273` | `#9AA3B5` | Secondary text, labels |
| `accent` | `#2340C9` | `#8EA2FF` | Primary actions, links, rail progress |
| `on-accent` | `#FFFFFF` | `#0F131B` | Text on `accent` |
| `success` | `#1B7A4B` | `#5BD69A` | Succeeded, posted |
| `warning` | `#9A5B00` | `#F2B54A` | Pending, test-mode banner |
| `danger` | `#B42318` | `#FF8F85` | Failed, destructive actions |
| `neutral` | `#5A6273` | `#9AA3B5` | Expired, archived |

Contrast (light on `bg` / dark on `bg`): ink 16.1 / 15.4 · muted 5.7 / 7.3 · accent 7.4 / 7.8 · success 5.0 / 10.2 · warning 5.1 / 10.2 · danger 6.1 / 8.4.

Status colors are semantic and never used as the brand accent.

## Typography

| Role | Family | Weights |
|---|---|---|
| Headings | Schibsted Grotesk | 500, 700 |
| Text | Source Sans 3 | 400, 600 |
| Amounts, ids, code | IBM Plex Mono | 400, 600 · `tabular-nums` |

Fallbacks: `system-ui, sans-serif` and `ui-monospace, monospace`.

| Step | Size / line height | Use |
|---|---|---|
| `xs` | 12 / 16 | Captions, table headers (uppercase, +0.05em) |
| `sm` | 13 / 18 | Table cells, chips |
| `md` | 15 / 22 | Body |
| `lg` | 18 / 24 | Section titles |
| `xl` | 24 / 30 | Page titles |
| `2xl` | 32 / 38 | Hero amounts (detail, checkout) |

## Spacing

Base 4 px: `1`=4 · `2`=8 · `3`=12 · `4`=16 · `6`=24 · `8`=32 · `12`=48. Layout gaps use `gap`, not margins.

## Radii

| Token | Value | Use |
|---|---|---|
| `r-sm` | 4 px | Inputs, buttons, blocks |
| `r-md` | 8 px | Cards, dialogs |
| `r-pill` | 999 px | Status chips only |

## Elevation

Only floating layers: `0 8px 24px rgb(15 19 27 / 0.16)`. Everything else is flat with `line` borders.

## Motion

| Token | Value | Use |
|---|---|---|
| `dur-fast` | 120 ms | Hover, focus |
| `dur-base` | 200 ms | Status change highlight, block fill |
| `pulse` | 1.6 s ease-in-out, infinite | Pending station |
| `ease` | `cubic-bezier(0.2, 0, 0, 1)` | Default |

`prefers-reduced-motion: reduce` → durations 0, no pulse.

## Breakpoints

`sm` 640 · `md` 900 (sidebar collapses below) · `lg` 1200.

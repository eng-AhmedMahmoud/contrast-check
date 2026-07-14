# contrast-check

**WCAG contrast ratio checker — see what passes, fix what fails.**

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/eng-AhmedMahmoud/contrast-check/pulls)

> Live demo: https://contrast-check.vercel.app

## The problem

Designers and developers routinely ship text that fails accessibility contrast — light gray on white, brand color on brand color — and low-vision users, people on cheap panels, and anyone in bright sunlight can't read it. WCAG defines exact contrast thresholds, but eyeballing them is guesswork.

**contrast-check** computes the real WCAG 2.1 contrast ratio between a foreground and a background color, tells you exactly which conformance levels pass, shows a live preview in your chosen colors, and suggests the nearest accessible fix — entirely in your browser. No accounts, no build step, no network calls.

## Features

- **Two synced color controls** — native color picker and hex input for both foreground and background (`#rgb` and `#rrggbb` accepted).
- **Correct WCAG 2.1 ratio** — sRGB → relative luminance → `(L1 + 0.05) / (L2 + 0.05)`, shown as e.g. `7.24 : 1`.
- **Conformance matrix** with clear pass/fail badges: AA normal (≥ 4.5), AA large (≥ 3), AAA normal (≥ 7), AAA large (≥ 4.5), and UI components / graphics (≥ 3).
- **Live preview** — heading, body copy, large text, and small print rendered in the actual colors so the result is tangible.
- **Suggest a fix** — when AA normal fails, it steps foreground lightness until it reaches ≥ 4.5 : 1 and offers a one-click **Apply**.
- **Swap** foreground/background and **copy** either hex.
- **Shareable** — current colors are reflected in the URL hash (pure client-side).
- **Accessibility-exemplary** — real labels, visible focus rings, ARIA on the pass/fail badges, keyboard-friendly throughout.

## How the ratio is computed

Each 8-bit sRGB channel is normalized to `[0, 1]` and linearized: values at or below `0.03928` are divided by `12.92`, otherwise `((c + 0.055) / 1.055) ^ 2.4`. Relative luminance is `0.2126·R + 0.7152·G + 0.0722·B` on the linearized channels. The contrast ratio is `(L_lighter + 0.05) / (L_darker + 0.05)`, ranging from `1 : 1` (identical) to `21 : 1` (black on white).

## Run locally

No dependencies and no build step. Either:

```bash
# just open it
open index.html

# or serve it statically
npm run dev   # runs: npx --yes serve .
```

## License

Licensed under **GPL-3.0-or-later**. See [LICENSE](LICENSE).

---

Built by [Devya](https://devya.dev).

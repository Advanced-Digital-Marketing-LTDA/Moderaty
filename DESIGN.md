---
id: moderaty-visual-design
type: module-design
title: Moderaty visual design system
status: current
parent: moderaty-architecture
tags:
  - visual-design
name: Moderaty
description: Comment protection for YouTube creators, dark-only, flat, with nested rounded corners.
colors:
  bg: "#0a0a0c"
  surface: "#101014"
  surface-2: "#16161b"
  line: "rgba(255, 255, 255, 0.09)"
  line-strong: "rgba(255, 255, 255, 0.16)"
  text: "#f4f4f2"
  text-2: "#9b9ba4"
  text-3: "#85858f"
  accent: "#ff3131"
  accent-hover: "#ff4747"
  accent-press: "#e02b2b"
  ok: "#3ddc84"
  amber: "#f5b84c"
typography:
  display:
    fontFamily: "Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.55
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  small:
    fontFamily: "Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
  button:
    fontFamily: "Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 600
    letterSpacing: "0.01em"
  label:
    fontFamily: "Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 500
    letterSpacing: "0.01em"
rounded:
  xs: "4px"
  sm: "8px"
  md: "12px"
spacing:
  space-4: "4px"
  space-8: "8px"
  space-16: "16px"
  space-24: "24px"
  space-32: "32px"
  space-48: "48px"
  space-64: "64px"
  space-96: "96px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.bg}"
    rounded: "{rounded.none}"
    height: "48px"
    padding: "0 32px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
    height: "48px"
    padding: "0 32px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
    padding: "20px"
  input:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
---

# Design System: Moderaty

## Overview

Moderaty's interface is dark-only and flat with nested rounded corners (cards
12px, controls 8px, tags 4px), one red accent, and sentence-case labels. The
verdict stamp stays square and uppercase: it is the product signature. The app has no gradients and no
shadows; separation comes from 1px hairline borders and two surface steps.
This document describes the styles shipped in `src/app.css` and the small
components in `src/lib/`. Those files are the source of truth for the values
below.

## Colors

- **Ground:** `bg` (#0a0a0c) is the page and nav background. `surface` (#101014)
  holds cards and empty states. `surface-2` (#16161b) is the raised step for
  inputs and secondary panels.
- **Lines:** `line` (9% white) for default borders and dividers; `line-strong`
  (16% white) for secondary buttons and underlines.
- **Text:** `text` (#f4f4f2) for primary text, `text-2` (#9b9ba4) for
  secondary text, and `text-3` (#85858f) for labels and meta. `text-3` measures
  5.42:1 on `bg` and 4.94:1 on `surface-2`, above the 4.5:1 threshold.
- **Accent:** `accent` (#ff3131) is the single saturated color. It marks the
  primary action, danger, and errors. `accent-hover` and `accent-press` are the
  button states.
- **Semantic:** `ok` (#3ddc84) for success and live status; `amber` (#f5b84c) for
  held or pending-review states. Each has a 12% tint for badge backgrounds.

Contrast against `bg`: `text` 17.96:1, `text-2` 7.18:1, `accent` 5.40:1, `ok`
11.09:1.

## Typography

**Archivo** (variable, weights 100 to 900) is the only text face. Headings are
24px at weight 600; no weight above 600 is used. Body is 15px at line-height
1.55. Secondary text and table cells are 14px. Button labels are 14px sentence
case at weight 600. Type sizes come from one scale: 12, 14, 15, 16, 18, 20, 24,
32, 40, 48, 64.

**JetBrains Mono** carries table headers and meta lines (12px, sentence case, 0.01em tracking). Use it for numbers that need tabular alignment.

IBM Plex Mono is shipped under `static/fonts/` and loaded by `src/app.css`, but
no current rule references it. Remove it from the bundle only when that is
decided.

## Layout and spacing

Spacing steps are 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, and 96 px; every margin, padding, gap and fixed height sits on the 4px grid. The app column is 900px
wide with 20px side gutters. Cards use 20px padding and a 16px bottom margin.
Pages show all four states: loading (skeleton), empty (dashed-border block),
error (`error-box`), and populated.

## Shape and motion

Radii nest: 12px for cards and panels, 8px for controls, 4px for tags; the verdict
stamp is the only square element. Borders are 1px. Presses scale to 0.97 over
150ms with one ease-out curve and no overshoot. Hover changes color only. Under `prefers-reduced-motion`,
transitions and animations are disabled.

## Components

- **Button:** 48px high, sentence case, 8px radius, 32px horizontal padding. Primary uses
  `accent`; secondary uses a transparent fill with a `line-strong` border;
  danger uses `accent`; small is a compact variant.
- **Card:** `surface` background, 1px `line` border, 20px padding. The
  danger-zone variant uses an `accent` border for irreversible actions.
- **Badge:** inline tag with a tinted background. Variants are neutral, ok,
  held, danger, and attention.
- **Empty state, skeleton, error box, flash:** the four state components.
  `src/lib/EmptyState.svelte` and `src/lib/Skeleton.svelte` are Svelte
  components; the error box and flash are styled by `src/app.css`.
- **Sharp checkbox:** 18px square with a 1px `line` border and an `accent` fill
  when checked. See `src/lib/SharpCheckbox.svelte`.

## Named rules

**The One Accent Rule.** `accent` is for the primary action, danger, and errors.
Never use it for decoration.

**The Flat Rule.** No hue gradients or shadows. The only gradient is the neutral
skeleton shimmer. Separation comes from borders and surface steps.

**The Four States Rule.** Every page ships loading, empty, error, and populated
states. A page with a blank state is a bug.

**The Label Rule.** Interactive elements have a visible label or an aria-label.
Action buttons name their target, such as "Reject comment by Ann".

## Copy voice

Interface copy is plain and literal. Public marketing copy has a meme-culture
voice, and its jokes stay in headlines, leads, and fictional examples. Coverage
limits, irreversible actions, pricing, and privacy statements are written
plainly. Jokes never overclaim.

## Source

Values come from `src/app.css` (commit c9a0ea2 on main). The cobalt, rose,
dawn, and Saira palette that earlier drafts described is superseded and not
part of the shipped app.

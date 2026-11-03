---
id: moderaty-visual-design
type: module-design
title: Moderaty visual design system
status: current
parent: moderaty-architecture
tags:
  - visual-design
name: Moderaty
description: Comment protection for YouTube creators, dark-only, flat and square.
colors:
  bg: "#0a0a0c"
  surface: "#101014"
  surface-2: "#16161b"
  line: "rgba(255, 255, 255, 0.09)"
  line-strong: "rgba(255, 255, 255, 0.16)"
  text: "#f4f4f2"
  text-2: "#9b9ba4"
  text-3: "#5c5c66"
  accent: "#ff3131"
  accent-hover: "#ff4747"
  accent-press: "#e02b2b"
  ok: "#3ddc84"
  amber: "#f5b84c"
typography:
  display:
    fontFamily: "Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "26px"
    fontWeight: 700
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
    fontSize: "12px"
    fontWeight: 700
    letterSpacing: "0.08em"
  caps-label:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 500
    letterSpacing: "0.14em"
rounded:
  none: "0px"
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

Moderaty's interface is dark-only, flat, and square. Zero radius, one red
accent, and a monospaced voice for labels. The app has no gradients and no
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
  secondary text, and `text-3` (#5c5c66) for caps labels. `text-3` measures
  2.99:1 on `bg`, below the 4.5:1 body-text threshold, so use it only for
  non-essential labels.
- **Accent:** `accent` (#ff3131) is the single saturated color. It marks the
  primary action, danger, and errors. `accent-hover` and `accent-press` are the
  button states.
- **Semantic:** `ok` (#3ddc84) for success and live status; `amber` (#f5b84c) for
  held or pending-review states. Each has a 12% tint for badge backgrounds.

Contrast against `bg`: `text` 17.96:1, `text-2` 7.18:1, `accent` 5.40:1, `ok`
11.09:1.

## Typography

**Archivo** (variable, weights 100 to 900) is the only text face. Headings are
26px at weight 700. Body is 15px at line-height 1.55. Secondary text and table
cells are 14px. Button labels are 12px uppercase at weight 700 with 0.08em
tracking.

**JetBrains Mono** carries caps labels (11px, weight 500, 0.14em tracking) and
table headers. Use it for numbers that need tabular alignment.

IBM Plex Mono is shipped under `static/fonts/` and loaded by `src/app.css`, but
no current rule references it. Remove it from the bundle only when that is
decided.

## Layout and spacing

Spacing steps are 4, 8, 16, 24, 32, 48, 64, and 96 px. The app column is 900px
wide with 20px side gutters. Cards use 20px padding and a 14px bottom margin.
Pages show all four states: loading (skeleton), empty (dashed-border block),
error (`error-box`), and populated.

## Shape and motion

Every radius is 0. Borders are 1px. Presses scale to 0.97 over 150ms with an
ease-out curve. Hover changes color only. Under `prefers-reduced-motion`,
transitions and animations are disabled.

## Components

- **Button:** 48px high, uppercase, 32px horizontal padding. Primary uses
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

**The Flat Rule.** No gradients, shadows, or radii. Separation comes from
borders and surface steps.

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

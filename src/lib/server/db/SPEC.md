---
id: persistence-boundary
type: module-design
status: draft
title: Persistence and migrations
parent: moderaty-architecture
tags: [database, migrations]
---

<!-- Copyright Andrew Philip Weilbacher; PolyForm Shield License 1.0.0. See LICENSE. -->

## Responsibility

This module centralizes the Drizzle/libSQL client and schema in `src/lib/server/db/`; `drizzle.config.ts` generates migrations under `drizzle/`. Schema changes are append-only: add a new migration and never edit a migration already applied in any environment.

## Boundary

This is a shared persistence contract, not a repository layer. Routes and domain modules import the Drizzle client/schema directly, so query ownership is not exclusively encapsulated here and a clean persistence boundary is not enforced.

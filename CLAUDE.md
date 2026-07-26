# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Hornhausen-Hof is an internal ranch-management web app for a private RedM
(Red Dead Redemption 2 roleplay) server, set in the fictional year 1899. It
is a **static site, no build step, no package manager, no bundler** —
`index.html` is opened directly or served as-is. All data is real-time via
Firebase (Authentication + Firestore); UI text, variable/function names, and
code comments are in German.

## Commands

There is no build, lint, or test tooling in this repo (no `package.json`).

- **Run locally**: open `index.html` directly in a browser, or serve the
  repo root with any static file server.
- **Deploy**: pushing to `main` auto-publishes to GitHub Pages via
  `.github/workflows/pages.yml` (no build step — the repo root is uploaded
  as-is). Custom domain is set via `CNAME` (`blackwolfranch.de`).
- **"Tests"**: none exist; verify changes by opening the app in a browser
  and exercising the affected view manually (see "Executing actions with
  care" for browser-testing expectations on UI changes).

## Version bump procedure (must be done together, every release)

The cache-busting/update-banner mechanism depends on **three places** being
bumped to the same integer in lockstep, or the update banner and/or cache
busting will misbehave:

1. `version.json` → `"version": N`
2. `VERSION_AKTUELL` constant in [config.js](js/core/config.js)
3. Every `?v=N` query string on every `<link rel="stylesheet">` and
   `<script src="...">` tag in [index.html](index.html)

`js/ui/version-check.js` polls `version.json` periodically and shows the
`#update-banner` when it finds a newer version than `VERSION_AKTUELL`.

## Architecture

### Script loading: two separate systems sharing one page

All app logic (other than auth) lives in **non-module, `defer`red classic
scripts** that share one global scope (no `import`/`export`, no bundler).
They append variables/functions directly into global scope, so **the
`<script>` order at the bottom of `index.html` is significant and must not
be reordered**: `js/core/*` → `js/ui/*` → `js/views/*` → `js/main.js` last
(it starts the app). Numbered comment banners inside each file (e.g. `/* 9.
Waren & Preise */`) are left over from when all this code lived in one
single `js/app.js`; the numbering is still meaningful for finding related
sections across files.

`js/auth.js` is intentionally a separate, self-contained **ES module**
(`type="module"` in `index.html`, loaded last). It uses the modern Firebase
**Modular SDK** (`getAuth`, `doc(db, ...)`, etc.), while every other file
uses the older **Compat SDK** (`firebase.auth()`, `db.collection(...).doc(...)`)
via `js/firebase-config.js`. Both SDKs talk to the same Firebase project
without conflict. Because ES modules can't implicitly touch `window`,
`auth.js` explicitly bridges to the rest of the app via:

- Custom `window` events: `hof:auth-approved`, `hof:auth-profile-updated`,
  `hof:auth-signed-out` (consumed in [main.js](js/main.js) to start/stop the
  app and re-render on role/admin changes).
- `window.BenutzerVerwaltung` — the entire admin/user-management API
  (approve/reject/lock/unlock/set rank/set admin/rename/delete/create user,
  password reset, activity log) exposed for [views/admin.js](js/views/admin.js) to call.

### Directory roles

- `js/core/` — shared foundation loaded first: `config.js` (constants,
  default data, `VIEW_META`), `state.js` (all mutable app state + Firestore
  listener unsubscribe handles, e.g. `produkte`, `bestellungen`,
  `aktuellerNutzer`), `dom.js` (single `el` object caching every DOM
  reference by id, plus the custom `<select>` reskinning widget), `firebase-init.js`
  (Compat SDK init/config check), `utils.js` (formatting/escaping helpers,
  `istAdmin()`).
- `js/ui/` — cross-cutting UI behavior not tied to one data view:
  `nav.js` (sidebar view switching, tabs), `modals.js`, `presence.js`
  ("who's online" heartbeat), `version-check.js`.
- `js/views/*.js` — one file per sidebar view (Waren, Bestellungen,
  Handelsrechner, Kontakte, Lager, Verkäufe, Hofbuch, Statistiken,
  Einstellungen, Admin). Each owns its own Firestore `onSnapshot` listener,
  render function, and form/modal handlers for that section.
- `js/main.js` — wires `hof:auth-*` events to app start/stop; must load last.
- `index.html` — contains markup for **every** view and **every** modal in
  one document (views are `<section class="view">`, toggled via
  `view--active`; modals are `.modal-overlay`, toggled via
  `data-open-modal`/`data-close-modal` attributes handled in `js/ui/modals.js`).
- `css/` — split by cascade purpose (`base` → `layout` → `components` →
  `views`); load order in `index.html` mirrors this and matters for the
  cascade.
- `assets/` — the wood/parchment western-themed graphic set (backgrounds,
  logo, parchment textures, buttons, decorations) referenced by the CSS.

### Central data model rule

There is no separate "sales" collection. A `bestellungen` (order) document
with `status: "Abgeschlossen"` **is** the sale. Stock levels, stock value,
revenue, profit, dashboard stats, and the Statistiken view are all derived
by filtering/aggregating completed orders — never write a parallel
sales/verkauf record when completing an order.

### Firestore

Collections: `users`, `usernames` (reserved-name lookup), `adminLog`
(append-only), `presence`, `kontakte`, `produkte`, `bestellungen`,
`angebote`, `verkaeufe` (legacy/unused, see below), `kataloge`, `hofbuch`.

`firestore.rules` in this repo is an **archive/reference copy only** —
Firebase does **not** read it automatically. The actual live rules are
maintained by hand in the Firebase Console (Firestore Database → Regeln)
and must be manually copy-pasted there after editing this file. Rank
(`Hofherr`/`Hofmeister`/`Stallmeister`/`Hofarbeiter`/`Knecht`/`Tagelöhner`)
and admin rights (`isAdmin`) are independent axes — a user doc's `isAdmin`
flag controls admin capability regardless of rank; `geschuetzt: true` marks
an account whose admin rights/approved status can never be revoked (see
`istUnantastbar()`/`verletztUnantastbarkeit()` in `firestore.rules`).

### Custom `<select>` widget

Every `<select class="field-input">` on the page is auto-upgraded at load
time (see `erzeugeCustomSelect` in [dom.js](js/core/dom.js)) into a themed
dropdown (`.custom-select`) so no native browser dropdown ever appears. The
original `<select>` stays in the DOM as the actual source of truth (value,
options, `change` listeners) but is visually hidden — code that populates
options via `innerHTML` on the underlying `<select>` continues to work
unchanged; a `MutationObserver` keeps the visible list in sync.

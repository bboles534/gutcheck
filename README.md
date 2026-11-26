# GUT CHECK

**12 choices. 3 seconds each. How alike is your group chat, really?**

▶ **Live:** https://bboles534.github.io/gutcheck/

A daily instinct game built for group chats. Every midnight there's a new set of 12 this-or-that choices, and everyone in the world gets the same set. You get 3 seconds per choice; hesitate and your gut "freezes." You get a personality type, then send your link to the chat. When a friend plays from your link, your answers **zip together** side by side, and the matches lock in place.

## Why it's built this way

| Constraint | Decision |
|---|---|
| People open links from group chats on their phones, between classes | Mobile-first: full-screen tap targets, haptics, playable in ~40 seconds |
| Nobody signs up for a group-chat game | **No accounts and no backend.** The share link *is* the data |
| Everyone needs the same daily set without a server | A seeded PRNG (mulberry32) keyed on the local calendar day builds an identical set on every device |
| Links have to be short and not spoil the answers | 12 answers (top/bottom/froze) pack into one base-3 number (<3¹²), shifted by a per-day key, then base36 → about 4 characters |
| It should feel alive for the very first visitor | A clearly labeled demo reveal between two bots, plus a solo personality result |
| Reasons to come back | New set daily, streaks, and a "Your people" board ranking friends by match % (localStorage) |

A share link looks like `…/gutcheck/#v1.1.5njp.a.Maya`, which encodes version, day, answers, average speed and name. The fragment never reaches a server.

## Architecture

```
index.html          shell + Open Graph tags (link previews in iMessage/Discord/etc.)
css/style.css       design system: Anton / Instrument Serif / Space Mono, 5-color palette
js/content.js       prompt pool (3 axes × 28 pairs), archetypes, verdicts
js/core.js          pure logic: PRNG, daily set, link encode/decode, scoring, streaks
js/card.js          canvas renderer for 1080×1350 shareable PNG cards
js/app.js           UI: screens, 3-second timer loop (rAF), zipper animation (Web Animations API)
tests/core.test.mjs unit tests (node:test), no dependencies
tests/e2e.py        Playwright: two isolated browser sessions play against each other on a phone viewport
```

The app uses plain ES modules with no framework and no build step. It respects `prefers-reduced-motion`, supports keyboard play (↑/↓), and degrades gracefully when storage or the share sheet is unavailable.

## Run locally

```bash
npm run serve        # http://localhost:8080
npm test             # unit tests
pip install playwright && python -m playwright install chromium
npm run e2e          # full two-friend flow in headless Chromium
```

CI runs both suites on every push (`.github/workflows/ci.yml`). The site is deployed with GitHub Pages from `main`.

## License

MIT

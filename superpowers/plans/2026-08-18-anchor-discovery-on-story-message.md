# Anchor Discovery on story_message Implementation Plan

> **Status: implemented and live-verified.** Written alongside the change
> rather than before it — the preceding caption plan's live verification
> uncovered the real cause mid-run, and the fix followed the evidence
> directly. Recorded here so the reasoning is checkable.

**Goal:** Discover feed posts again after Facebook stopped wrapping post content in `role="article"`.

**Architecture:** `TAG_AND_READ_JS` built its candidate list from `div[role="article"]`. On the current profile feed that selector returns only comments and empty media containers — no posts. Discovery now also collects `[data-ad-rendering-role="story_message"]` and `[data-ad-comet-preview="message"]` bodies, additively, and dedupes on the unit `resolveUnit` lands on.

---

## Evidence

Same page load, counted directly:

| Measure | Value |
|---|---|
| `[data-ad-rendering-role="story_message"]` on page | 2–3 per screen |
| `[data-ad-comet-preview="message"]` | 2–3 |
| top-level `role="article"` | 5–7 |
| — of those, comments (`aria="Comment by …"`) | 3–5 |
| — remainder | 2 empty containers, `h=286`, `dirAuto=0`, `preview=0` |
| **posts inside any `role="article"`** | **0** |

Climbing from a `story_message` node reaches everything the scraper needs, at
depth 2, and the unit is stable (d3/d4 identical to d2):

| Depth | story_message | leave btn | heading | video | comment arts | other posts |
|---|---|---|---|---|---|---|
| d1 | 1 | 0 | — | 1 | 0 | 0 |
| **d2 (unit)** | **1** | **1** | **Tiểu Mỹ** | **1** | 1–2 | **0** |
| d3 / d4 | 1 | 1 | Tiểu Mỹ | 1 | 1–2 | 0 |

Live sample of what that yields:

```json
{"caption": "2 năm cố gắng một nhà lầu xe hơi", "depth": 2, "leave": true,
 "leaveText": "1", "perma": ".../reel/1035221442631939/",
 "dateLabel": "Monday 17 August 2026 at 08:23"}
```

**Ruling out the preceding commit as the cause.** `024567a` had just started
excluding comment articles from discovery, so it was the obvious suspect. An
A/B on one page load says otherwise: the old rule considered 5–7 articles (all
comments plus the two empty containers), the new rule considered 2 (the
containers) — **neither finds a real post**. The old rule only ever "found"
posts by mislabelling comments as posts, which is exactly the 0-caption,
0-title result measured across 72 rows in `data/runs/2026-08-17_174334`.

---

## What changed

`fb_scraper/feed_js.py`:

1. **Anchor collection.** After the article list is built, `story_message` and
   `preview=message` bodies not already inside an article are appended. Added,
   not substituted: permalink pages and older layouts still render the article
   shape and their fixtures must keep passing.
2. **Unit-level dedupe.** A post is commonly reachable by both anchors (a
   `story_message` wrapping a `preview=message`). `data-fc-uid-article` only
   guards the element it was stamped on, so a post got tagged once per anchor.
   The main loop now skips an element whose resolved unit already carries
   `data-fc-uid`. Safe because `resolveUnit` never wraps a neighbouring post,
   so a tagged unit is always the same post.

Tests: `tests/fixtures/story_message_card.html` plus three cases in
`test_dom_fixtures.py` — the post is discovered with no article present;
caption, author, badge and permalink all resolve; and the unit's own comment
never becomes the caption.

---

## Live verification

`data/runs/2026-08-18_100116`, `--max-posts 20`:

| Measure | Before (`2026-08-18_085411`) | After |
|---|---|---|
| feed units from **DOM** | **0** (all 3 via GraphQL) | **20** of 37 |
| posts with a caption | 0 | **9** |
| posts with a title | 0 | 9 |
| `ok` posts with `ui_count` | 0 of 16 | **4 of 4** |
| captions matching comment text or a commenter name | — | **0** |

Captions read as genuine post bodies — `"Dạo này mọi người ít Stream bài của
tui rồi .."`, `"Giờ Sài Gòn xài máy lạnh hay quạt nhiều vậy mọi người"` — and
the mandatory cross-check against every comment text and author on the same
post found no collisions. That check is not optional: writing commenter names
into the caption column is the exact failure this feature shipped once before
(`8dab5a9`).

Suite: **175 passed**, including every pre-existing fixture.

---

## Open items

- **`open_failed: 4` of 15 posts.** New in this run and not yet diagnosed. The
  DOM path is now used for posts that previously fell through to the Reels tab,
  so this may be a pre-existing weakness in `_open_comments` that was simply
  never exercised on these posts. Needs its own measurement before any fix.
- **Comment yield fell** (22 vs 79) against the previous run, which is not a
  like-for-like comparison: that run scraped 16 reels through the Reels-tab
  harvester while this one went through the feed. Re-measure on a run that
  reaches the same posts before drawing any conclusion.
- **Reels captions.** Several captioned rows here are reels, so the
  `CAPTION_DIR_AUTO_FALLBACK` question may now be moot — reels carry
  `story_message` too. Confirm before touching that flag; it is off because it
  previously wrote comment text into SQLite.

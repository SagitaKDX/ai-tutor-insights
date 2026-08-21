# Comment coverage + richer post metadata — Design

**Date:** 2026-08-15
**Status:** Approved by user (badge-targeted expansion + permalink escalation; pure functions + DOM fixtures)

## Goal

Two outcomes, measured not asserted:

1. **Comment completeness** — a post whose UI badge says 14 comments yields 14, not 11.
2. **Richer post metadata** — full caption (including reels), reaction/share counts, media URLs, a clean permalink, and a timestamp with time-of-day.

## Evidence this is needed

Measured from `data/demos/2026-08-14_005923/gap_report.csv` and
`data/evals/2026-08-13_113635/discovery_eval.csv`:

| Failure | Evidence |
|---------|----------|
| Comments under-collected | 3 of 5 posts `possible_miss`; scraped vs badge 1/2, 5/6, 11/14 |
| Caption empty on reels | `title_empty=Y`; reels have no `[data-ad-comet-preview]` node |
| Caption lost after expand | eval idx 0: `title_before_expand="lúc này lúc kia"` → `title_current=""` |
| Caption truncated | hard `.slice(0, 180)`; `… See more` is never clicked |
| Date missing on some cards | eval idx 1, 2 have empty `post_date` |
| `href` polluted | stored href carries the full `__cft__[0]=…` tracking blob |

## Decisions

| Decision | Choice |
|----------|--------|
| Expansion strategy | Badge-targeted loop with escalation ladder |
| Rejected | GraphQL cursor replay — needs `fb_dtsg`/`doc_id`, breaks on rotation, raises automation signature |
| Escalation when still short | Open canonical permalink in a second tab, scrape there |
| Where decisions live | Pure Python (`expansion.py`, `postmeta.py`); browser only executes |
| `title` field | Unchanged meaning (truncated preview) for back-compat |
| Full text | New `caption` field |
| Test layers | Pure-function tests + offline DOM fixtures via `page.set_content()` |
| Acceptance | `coverage_gap == 0` on the posts currently at −1, −1, −3 |

## Architecture

Two new modules, both free of Playwright imports so they are directly testable:

```
fb_scraper/
  expansion.py   # when to keep expanding, what to try next, when to escalate
  postmeta.py    # caption cleanup, engagement counts, canonical href, timestamps
```

`TimelineMixin._expand_all_comments` becomes a thin loop: ask the controller for
an action, perform it in the browser, feed the result back.

### `expansion.py`

```python
@dataclass(frozen=True)
class ExpandState:
    scraped: int
    target: int | None        # ui_count badge; None when unreadable
    rounds: int
    quiet_rounds: int
    last_clicks: int
    tried: frozenset[str]     # strategies exhausted during the current stall
    max_rounds: int

def next_expand_action(state: ExpandState) -> str
    # "click" | "scroll" | "sort_all" | "replies" | "stop"

def is_expansion_complete(state: ExpandState) -> bool
def coverage_gap(scraped: int, ui_count: int | None) -> int | None
def should_escalate_to_permalink(gap: int | None, href: str, attempted: bool) -> bool
```

Rules:

- `scraped >= target` → `stop`. Reaching the badge is the definition of done.
- `rounds >= max_rounds` → `stop`. The existing `max_expand_rounds` stays the hard ceiling.
- Progress last round (grew, or `last_clicks > 0`) → `click`. Keep doing the cheap thing while it works.
- Stalled → walk the ladder, skipping anything in `tried`: `click` → `scroll` → `sort_all` → `replies`. All tried → `stop`.
- `target is None` → today's behavior: stop after 2 quiet rounds once the ladder is exhausted.

**Behavior change:** a post at 11/14 no longer stops after two quiet rounds; it
escalates through the ladder, then to the permalink, before giving up.

`should_escalate_to_permalink` returns True only when the gap is negative, a
canonical href exists, and the permalink has not already been tried for that post.
Escalation reuses `LegacyMixin.scrape_post` in a second tab.

**Correction (found in Task 5 review).** The sentence above was wrong when
written. `scrape_post` and `scrape_photo` ran no expansion ladder at all — only
`scrape_reel` called `_expand_all_comments`; the other two did four window
wheel-scrolls and stopped. Facebook's permalink page paginates behind a click,
not a scroll, so escalation recovered almost nothing for the dominant content
type while costing a full navigation. Task 5 gives all three the ladder.

The mistake was naming a function by reference without reading it. `expansion.py`
inherited the error: its `target is None` branch is justified by a comment
saying the ladder must run "before this path (used by the permalink fallback)
gives up" — false for posts and photos until Task 5 fixed it. **When a spec or
plan step depends on what an existing function does, quote the relevant lines
inline rather than describing them.** Three of this project's defects came from
describing code instead of reading it.

### `postmeta.py`

```python
def clean_caption(raw: str) -> str
def truncate_title(caption: str, limit: int = 180) -> str
def parse_engagement_count(raw: str) -> int | None
def canonical_href(url: str) -> str
def parse_post_datetime_iso(label: str) -> str | None
def pick_caption_candidate(candidates: list[str], *, author: str = "") -> str
```

- `clean_caption` strips `See more` / `Xem thêm`, `See translation`, `Rate this
  translation`, and collapses whitespace.
- `parse_engagement_count` generalizes the existing `parse_ui_count` to reaction
  and share labels (`1.2K`, `1,234`, `12 comments`, `3 shares`).
- `canonical_href` drops `__cft__[0]`, `__tn__`, `comment_id`, `reply_comment_id`,
  and `notif_id`, keeping only identity params.
- `parse_post_datetime_iso` extends `parse_post_date_iso` with time-of-day:
  `"Saturday 8 August 2026 at 21:46"` → `"2026-08-08T21:46"`. Returns None rather
  than guessing when the time is absent; `post_date_iso` keeps its current meaning.
- `pick_caption_candidate` chooses among scoped `dir=auto` texts for reels,
  rejecting the author name and known chrome.

### Caption capture

Three fixes, all in the inventory/scrape DOM layer:

1. **Expand first** — click `See more` / `Xem thêm` inside the primary article
   before reading text.
2. **Reel fallback** — reels have no `[data-ad-comet-preview]`. Restore a
   `dir=auto` fallback, but *scoped*: primary article only, excluding nested
   `role="article"` comment nodes and the chrome list. The earlier removal was
   right about the symptom (comment text leaking into captions) and wrong about
   the cause — the fallback was unscoped, not wrong in principle.
3. **Capture twice** — read the caption during inventory *and* again at scrape
   time, keeping the first non-empty value. This is what fixes "lost after expand".

## Data model

New `posts` columns, added through the existing `ALTER TABLE` migration loop in
`storage.py:_init_db`:

| Column | Type | Meaning |
|--------|------|---------|
| `caption` | TEXT | Full post text, untruncated |
| `reaction_count` | INTEGER | Total reactions |
| `share_count` | INTEGER | Shares |
| `media_urls` | TEXT | Comma-joined image/video URLs |
| `canonical_href` | TEXT | Permalink with tracking params stripped |
| `post_datetime_iso` | TEXT | `YYYY-MM-DDTHH:MM`, null when time unknown |
| `coverage_gap` | INTEGER | `scraped − ui_count`; 0 means complete |

The same fields are added to `timeline.csv`. `title`, `post_date`, and
`post_date_iso` keep their current meaning, so old runs still load and
`load_done_keys` is unaffected.

## Testing

**Layer 1 — pure functions.** Every function above gets tests in `test_scraper.py`
alongside the existing 51, following the same style (no browser, no mocks).

**Layer 2 — DOM fixtures.** Real feed-card HTML saved under `tests/fixtures/`:

```
tests/fixtures/
  reel_card.html            # no data-ad-comet-preview → exercises the reel fallback
  post_text_card.html       # long caption → exercises See more + truncation
  photo_card.html
  post_with_replies.html    # nested View N replies
```

A harness loads each fixture with `page.set_content()` on a local Chromium and
runs the real extraction JS against it — offline, deterministic, no session.
`capture_fixture.py` re-saves a card from a live run when Facebook's DOM shifts.

TDD applies throughout: test first, watch it fail, minimal code to pass.

## Acceptance

- `coverage_gap == 0` for the three posts currently at −1, −1, −3.
- Reel cards produce a non-empty `caption`.
- A long post's `caption` is longer than its 180-char `title`.
- Full suite green, output pristine.

## Out of scope

- Profile-level data (name, bio, follower counts) — a separate spec.
- Logged-out / mbasic scraping.
- GraphQL cursor replay.
- Post discovery completeness on long timelines — deferred; comments first.

## Self-review

- No TBD placeholders; every function has a signature and a stated rule.
- Consistent: `title` stays truncated, `caption` is the new full-text field —
  applied the same way in `postmeta.py`, the data model, and acceptance.
- Scope is one subsystem: per-post comment coverage and post metadata.
- Ambiguity resolved: "complete" means `scraped >= ui_count badge`, and when the
  badge is unreadable the old quiet-round rule applies.

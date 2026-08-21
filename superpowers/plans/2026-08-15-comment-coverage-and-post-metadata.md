# Comment Coverage + Post Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each post yield as many comments as its UI badge claims, and capture full captions, engagement counts, media URLs, clean permalinks, and timestamps with time-of-day.

**Architecture:** Two new Playwright-free modules hold every decision — `fb_scraper/expansion.py` (how long to keep expanding, what to try next, when to fall back to the permalink) and `fb_scraper/postmeta.py` (caption cleanup, counts, hrefs, timestamps). The browser layer in `timeline.py` / `inventory.py` shrinks to "perform the action, hand the strings back". Decisions in Python are unit-testable; DOM selectors are covered by offline HTML fixtures.

**Tech Stack:** Python 3.14, Playwright 1.60 (async), pytest 9.1 + pytest-asyncio 1.4, stdlib `sqlite3` / `csv` / `re`.

**Spec:** `docs/superpowers/specs/2026-08-15-comment-coverage-and-post-metadata-design.md`

---

## Global Constraints

- **TDD is mandatory.** Write the test, run it, watch it fail for the right reason, then write the minimal code. Never write production code first.
- **The code blocks below are starting points, not gospel.** Task 1's reference
  implementation contained a real bug its own test caught, and Task 2's shipped
  byte-identical to the plan with five defects the plan author never considered
  (AM/PM timestamps off by 12 hours, locale-formatted counts off by up to 1234x,
  a number grabbed from any label, captions over 5000 chars discarded, chrome
  sentences beating real captions on length). A plan that dictates both the code
  and the tests can only ever be as good as its author's imagination, and the
  red-green cycle degenerates into transcription. So: derive the adversarial
  cases yourself before implementing, and when a test disagrees with the code
  block, work out which is wrong rather than assuming you mistyped. Say which,
  and why.
- **Prefer a safe `None` over a confident wrong value.** Nothing downstream
  validates these parsers — their output goes straight into SQLite. A missing
  reaction count is recoverable; a plausible wrong one is not.
- `title` keeps its current meaning: a caption truncated to 180 chars. Full text goes in the new `caption` field. This is what keeps existing `data/runs/` loadable.
- `post_date` and `post_date_iso` keep their current meaning. `post_datetime_iso` is additive.
- `expansion.py` and `postmeta.py` are **stdlib-only**. No Playwright, no
  `timeline.py`, no `scraper.py` — and no `storage.py` either. The dependency
  runs the other way: `parse_post_date_iso` and `MONTHS` now live in
  `postmeta.py`, and `storage.py` imports *from* it (re-exporting for the
  existing call sites). An earlier draft of this plan had `postmeta` importing
  `storage`, which would have become a circular import the moment Task 8 made
  `storage.py` normalize captions or hrefs on save.
- Run the whole suite before every commit: `venv/bin/python -m pytest -q`.
- Commit after each task.

**About test counts.** The working tree carries ~11 uncommitted WIP tests belonging
to the user, plus edits to `comments.py`, `inventory.py`, `timeline.py`, and
`scraper.py`. A clean checkout of `main` runs **40 tests**; the dirty working tree
runs **51**. Every task below states its gate as a *delta* — "N more than before
this task" — because absolute counts differ by 11 depending on where you look, and
the WIP is not yours to commit. Always `git add` the exact files a task lists;
never `git add -A`. To check a commit in isolation:

```bash
git worktree add /tmp/verify <sha> --detach -q
cd /tmp/verify && /Users/minhlethanh/Documents/Facebookcrawler/venv/bin/python -m pytest -q
git worktree remove /tmp/verify --force
```

## File map

| File | Responsibility |
|------|----------------|
| `fb_scraper/expansion.py` | **Create.** Expansion state machine, coverage gap, permalink escalation rule |
| `fb_scraper/postmeta.py` | **Create.** Caption cleanup, engagement counts, canonical href, timestamps |
| `fb_scraper/constants.py` | Add `REPLY_LABEL_RE` |
| `fb_scraper/comments.py` | Add `merge_comment_lists` |
| `fb_scraper/inventory.py` | Caption candidates + engagement/media in `TAG_AND_READ_JS`; wire `card_from_raw_item` |
| `fb_scraper/timeline.py` | Controller-driven `_expand_all_comments`, `_click_reply_controls`, permalink escalation, re-capture caption |
| `fb_scraper/storage.py` | New `posts` columns, migration, CSV fields |
| `test_scraper.py` | Pure-function tests (appended to the existing suite) |
| `test_dom_fixtures.py` | **Create.** Offline DOM tests driving the real JS via `page.set_content()` |
| `tests/fixtures/*.html` | **Create.** Feed-card markup |
| `capture_fixture.py` | **Create.** Re-save a real card from a live session |

**Task order matters:** Tasks 1–3 build the tested foundation. Tasks 4–7 wire it into the browser layer. Task 8 persists the new fields. Task 9 verifies against a live profile.

---

### Task 1: Expansion controller

The current loop in `timeline.py:499` stops after 2 quiet rounds regardless of how many comments the badge promised. This task builds the replacement decision logic as pure functions. It does not wire anything up yet — Task 4 does that.

**Files:**
- Create: `fb_scraper/expansion.py`
- Modify: `test_scraper.py`

- [ ] **Step 1: Write the failing tests**

Append to `test_scraper.py`:

```python
# ---------- Expansion controller ----------

def test_coverage_gap_reports_shortfall():
    from fb_scraper.expansion import coverage_gap

    assert coverage_gap(11, 14) == -3
    assert coverage_gap(6, 6) == 0
    assert coverage_gap(7, 6) == 1
    assert coverage_gap(5, None) is None


def test_expansion_complete_when_badge_target_reached():
    from fb_scraper.expansion import ExpandState, is_expansion_complete

    assert is_expansion_complete(ExpandState(scraped=14, target=14))
    assert not is_expansion_complete(ExpandState(scraped=11, target=14))


def test_expansion_complete_at_max_rounds():
    from fb_scraper.expansion import ExpandState, is_expansion_complete

    state = ExpandState(scraped=1, target=99, rounds=30, max_rounds=30)
    assert is_expansion_complete(state)


def test_expansion_keeps_clicking_while_it_makes_progress():
    from fb_scraper.expansion import ExpandState, next_expand_action

    state = ExpandState(scraped=5, target=14, quiet_rounds=0)
    assert next_expand_action(state) == "click"


def test_expansion_escalates_through_ladder_when_stalled():
    from fb_scraper.expansion import ExpandState, next_expand_action

    stalled = ExpandState(scraped=11, target=14, quiet_rounds=1, tried=frozenset({"click"}))
    assert next_expand_action(stalled) == "scroll"

    stalled = ExpandState(
        scraped=11, target=14, quiet_rounds=2, tried=frozenset({"click", "scroll"})
    )
    assert next_expand_action(stalled) == "sort_all"

    stalled = ExpandState(
        scraped=11, target=14, quiet_rounds=3, tried=frozenset({"click", "scroll", "sort_all"})
    )
    assert next_expand_action(stalled) == "replies"


def test_expansion_stops_when_ladder_exhausted():
    from fb_scraper.expansion import ExpandState, next_expand_action

    state = ExpandState(
        scraped=11,
        target=14,
        quiet_rounds=4,
        tried=frozenset({"click", "scroll", "sort_all", "replies"}),
    )
    assert next_expand_action(state) == "stop"


def test_expansion_without_badge_walks_ladder_before_quiet_stop():
    from fb_scraper.expansion import ExpandState, next_expand_action

    # No badge: still escalate through the ladder...
    assert next_expand_action(ExpandState(scraped=9, target=None, quiet_rounds=1)) == "scroll"
    # ...and only stop once the ladder is exhausted AND it has gone quiet.
    exhausted = frozenset({"click", "scroll", "sort_all", "replies"})
    assert next_expand_action(
        ExpandState(scraped=9, target=None, quiet_rounds=2, tried=exhausted)
    ) == "stop"
    # Quiet but ladder not yet exhausted -> keep going.
    assert next_expand_action(
        ExpandState(scraped=9, target=None, quiet_rounds=2, tried=frozenset({"click"}))
    ) == "scroll"


def test_expansion_does_not_treat_clicks_alone_as_progress():
    from fb_scraper.expansion import ExpandState, next_expand_action

    stalled = ExpandState(
        scraped=11, target=14, quiet_rounds=5, last_clicks=1, tried=frozenset({"click"})
    )
    assert next_expand_action(stalled) == "scroll"


def test_escalate_to_permalink_only_when_short_and_untried():
    from fb_scraper.expansion import should_escalate_to_permalink

    href = "https://www.facebook.com/reel/123"
    assert should_escalate_to_permalink(-3, href, attempted=False) is True
    assert should_escalate_to_permalink(-3, href, attempted=True) is False
    assert should_escalate_to_permalink(0, href, attempted=False) is False
    assert should_escalate_to_permalink(None, href, attempted=False) is False
    assert should_escalate_to_permalink(-3, "", attempted=False) is False
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `venv/bin/python -m pytest test_scraper.py -q -k "expansion or expand_action or escalate or coverage_gap"`

Keep `-k` quoted — an unquoted `or` is split by the shell.

Expected: 8 failures, each `ModuleNotFoundError: No module named 'fb_scraper.expansion'`. If you see a different error, fix that before continuing.

- [ ] **Step 3: Write the minimal implementation**

Create `fb_scraper/expansion.py`:

```python
"""Decide how far to keep expanding a post's comments.

Pure decision logic — no Playwright, no DOM. The browser layer in
``timeline.py`` asks for an action, performs it, and reports back.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ExpandAction = Literal["click", "scroll", "sort_all", "replies", "stop"]

# Escalation ladder, cheapest first.
LADDER = ("click", "scroll", "sort_all", "replies")
_LADDER_SET = frozenset(LADDER)

# When the UI badge is unreadable we cannot aim at a number, so fall back to
# the old rule: two consecutive rounds with no growth means done.
MAX_QUIET_ROUNDS_WITHOUT_TARGET = 2


@dataclass(frozen=True)
class ExpandState:
    """Accumulated state across expansion rounds for one post.

    ``tried`` accumulates the strategies already attempted during the *current*
    stall. The caller clears it whenever a round makes progress. ``last_clicks``
    is informational only — it is logged, never used to decide the next action.
    """

    scraped: int = 0
    target: int | None = None
    rounds: int = 0
    quiet_rounds: int = 0
    last_clicks: int = 0
    tried: frozenset[str] = frozenset()
    max_rounds: int = 30


def coverage_gap(scraped: int, ui_count: int | None) -> int | None:
    """``scraped - ui_count``. Negative means comments are missing."""
    if ui_count is None:
        return None
    return scraped - ui_count


def _ladder_exhausted(state: ExpandState) -> bool:
    """Has every rung of the ladder been tried during the current stall?

    A stalled round (``quiet_rounds > 0``) already implies "click" was tried
    — it's the first thing every round does — even if the caller hasn't
    recorded it in ``tried`` yet. Shared by ``is_expansion_complete`` and
    ``next_expand_action`` so the two can never disagree about when the
    ladder has run out. The normalization is conditional on purpose: on a
    round that just made progress, "click" has not been spent.
    """
    tried = state.tried | {"click"} if state.quiet_rounds > 0 else state.tried
    return _LADDER_SET <= tried


def is_expansion_complete(state: ExpandState) -> bool:
    if state.rounds >= state.max_rounds:
        return True
    if state.target is not None and state.scraped >= state.target:
        return True
    if state.target is None:
        # No badge to aim at: quiet AND out of strategies. Walking the whole
        # ladder still matters here — the permalink fallback runs with no target.
        return (
            _ladder_exhausted(state)
            and state.quiet_rounds >= MAX_QUIET_ROUNDS_WITHOUT_TARGET
        )
    return _ladder_exhausted(state)


def next_expand_action(state: ExpandState) -> ExpandAction:
    if is_expansion_complete(state):
        return "stop"
    if state.quiet_rounds == 0:
        return "click"
    exhausted = state.tried | {"click"}
    for action in LADDER:
        if action not in exhausted:
            return action
    return "stop"


def should_escalate_to_permalink(gap: int | None, href: str, attempted: bool) -> bool:
    """True when the post is still short and its permalink is worth opening."""
    if attempted or not href.strip():
        return False
    if gap is None or gap >= 0:
        return False
    return True
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `venv/bin/python -m pytest test_scraper.py -q`
Expected: 8 more tests passing than before this task, all green.

- [ ] **Step 5: Commit**

```bash
git add fb_scraper/expansion.py test_scraper.py
git commit -m "Add badge-targeted expansion controller."
```

---

### Task 2: Post metadata parsers

**Files:**
- Create: `fb_scraper/postmeta.py`
- Modify: `test_scraper.py`

Note on duplication: `inventory.parse_ui_count` stays as it is. It is anchored (`^…$`) and parses the bare badge text, and three existing tests depend on it. `parse_engagement_count` below is deliberately separate — it searches inside labelled text like `"1.2K reactions"`, which the anchored version rejects by design.

- [ ] **Step 1: Write the failing tests**

Append to `test_scraper.py`:

```python
# ---------- Post metadata parsers ----------

def test_clean_caption_strips_see_more_and_translation_chrome():
    from fb_scraper.postmeta import clean_caption

    assert clean_caption("Học được gì sau chia tay … See more") == "Học được gì sau chia tay"
    assert clean_caption("Đông mơ · See original") == "Đông mơ"
    assert clean_caption("  spaced   out  text ") == "spaced out text"
    assert clean_caption("") == ""


def test_truncate_title_keeps_180_chars():
    from fb_scraper.postmeta import truncate_title

    long_caption = "x" * 500
    assert len(truncate_title(long_caption)) == 180
    assert truncate_title("short") == "short"


def test_parse_engagement_count_handles_labels_and_suffixes():
    from fb_scraper.postmeta import parse_engagement_count

    assert parse_engagement_count("1.2K") == 1200
    assert parse_engagement_count("1,234") == 1234
    assert parse_engagement_count("12 comments") == 12
    assert parse_engagement_count("3 shares") == 3
    assert parse_engagement_count("2M reactions") == 2000000
    assert parse_engagement_count("") is None
    assert parse_engagement_count("Like") is None


def test_canonical_href_strips_tracking_params():
    from fb_scraper.postmeta import canonical_href

    dirty = (
        "https://www.facebook.com/reel/1073237811932972/"
        "?comment_id=1078580044601017&__cft__[0]=AZZCvgWY6kbkgn&__tn__=R-R"
    )
    assert canonical_href(dirty) == "https://www.facebook.com/reel/1073237811932972/"
    assert canonical_href("") == ""


def test_canonical_href_keeps_identity_params():
    from fb_scraper.postmeta import canonical_href

    dirty = "https://www.facebook.com/photo.php?fbid=123&__tn__=R-R"
    assert canonical_href(dirty) == "https://www.facebook.com/photo.php?fbid=123"


def test_parse_post_datetime_iso_adds_time_of_day():
    from fb_scraper.postmeta import parse_post_datetime_iso

    assert parse_post_datetime_iso("Saturday 8 August 2026 at 21:46") == "2026-08-08T21:46"
    assert parse_post_datetime_iso("Friday 19 June 2026 at 21:21") == "2026-06-19T21:21"


def test_parse_post_datetime_iso_returns_none_without_time():
    from fb_scraper.postmeta import parse_post_datetime_iso

    assert parse_post_datetime_iso("3 Tháng 8") is None
    assert parse_post_datetime_iso("") is None


def test_pick_caption_candidate_prefers_longest_real_text():
    from fb_scraper.postmeta import pick_caption_candidate

    candidates = ["Nguyễn Nghĩa", "Like", "4d", "lúc này lúc kia", "Reply"]
    assert pick_caption_candidate(candidates, author="Nguyễn Nghĩa") == "lúc này lúc kia"


def test_pick_caption_candidate_rejects_author_and_chrome_only():
    from fb_scraper.postmeta import pick_caption_candidate

    assert pick_caption_candidate(["Nguyễn Nghĩa", "Like", "Reply"], author="Nguyễn Nghĩa") == ""
    assert pick_caption_candidate([]) == ""
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `venv/bin/python -m pytest test_scraper.py -q -k "caption or engagement or canonical or datetime_iso or truncate_title"`
Expected: 9 failures, all `ModuleNotFoundError: No module named 'fb_scraper.postmeta'`.

- [ ] **Step 3: Write the minimal implementation**

Create `fb_scraper/postmeta.py`:

```python
"""Pure parsers for post captions, engagement counts, permalinks, timestamps.

No Playwright and no DOM. ``inventory.py`` hands raw strings in; these
functions decide what they mean.
"""

from __future__ import annotations

import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

# parse_post_date_iso and MONTHS live HERE, not in storage.py — storage
# imports them from this module. See Global Constraints.

SEE_MORE_RE = re.compile(r"\s*(?:…|\.\.\.)?\s*(?:See more|Xem thêm)\s*$", re.I)
TRANSLATION_TAIL_RE = re.compile(
    r"\s*·?\s*(?:See original|See translation|Rate this translation"
    r"|Xem bản gốc|Xem bản dịch).*$",
    re.I,
)
COUNT_RE = re.compile(r"(\d[\d,]*(?:\.\d+)?)\s*([KkMm])?")
TIME_OF_DAY_RE = re.compile(r"\b(\d{1,2}):(\d{2})\b")

CAPTION_CHROME_RE = re.compile(
    r"^(?:Like|Reply|Share|Comment|Follow|Top fan|Author"
    r"|Thích|Trả lời|Chia sẻ|Bình luận|Theo dõi"
    r"|\d+[smhdwy]|\d+\s+(?:comments?|shares?|likes?))$",
    re.I,
)

# Params Facebook appends for click tracking — never part of post identity.
TRACKING_PARAMS = frozenset(
    {"__tn__", "comment_id", "reply_comment_id", "notif_id", "notif_t", "ref", "rdid"}
)


def clean_caption(raw: str) -> str:
    """Collapse whitespace and drop See more / translation chrome."""
    if not raw:
        return ""
    text = " ".join(str(raw).split())
    text = TRANSLATION_TAIL_RE.sub("", text)
    text = SEE_MORE_RE.sub("", text)
    return text.strip(" ·")


def truncate_title(caption: str, limit: int = 180) -> str:
    """The back-compat ``title`` field: a cleaned caption, hard-truncated."""
    return clean_caption(caption)[:limit]


def parse_engagement_count(raw: str) -> int | None:
    """Parse counts out of labelled text: 1.2K, 1,234, "12 comments"."""
    if not raw:
        return None
    match = COUNT_RE.search(" ".join(str(raw).split()))
    if not match:
        return None
    try:
        value = float(match.group(1).replace(",", ""))
    except ValueError:
        return None
    suffix = (match.group(2) or "").lower()
    if suffix == "k":
        value *= 1_000
    elif suffix == "m":
        value *= 1_000_000
    return int(round(value))


def _is_tracking_param(key: str) -> bool:
    lowered = key.lower()
    return lowered.startswith("__cft__") or lowered in TRACKING_PARAMS


def canonical_href(url: str) -> str:
    """Strip click-tracking params, keeping identity params like fbid."""
    if not url:
        return ""
    parts = urlsplit(url)
    kept = [
        (key, value)
        for key, value in parse_qsl(parts.query, keep_blank_values=True)
        if not _is_tracking_param(key)
    ]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(kept), ""))


def parse_post_datetime_iso(label: str) -> str | None:
    """``YYYY-MM-DDTHH:MM`` from a permalink aria-label, or None.

    Returns None rather than guessing when the label carries no time of day —
    ``post_date_iso`` remains the date-only field.
    """
    date_iso = parse_post_date_iso(label)
    if not date_iso:
        return None
    match = TIME_OF_DAY_RE.search(label or "")
    if not match:
        return None
    hour, minute = int(match.group(1)), int(match.group(2))
    if hour > 23 or minute > 59:
        return None
    return f"{date_iso}T{hour:02d}:{minute:02d}"


def pick_caption_candidate(candidates: list[str], *, author: str = "") -> str:
    """Longest candidate that is neither UI chrome nor the author's own name."""
    best = ""
    for raw in candidates or []:
        text = clean_caption(raw)
        if not text or len(text) > 5000:
            continue
        if CAPTION_CHROME_RE.match(text):
            continue
        if author and text == clean_caption(author):
            continue
        if len(text) > len(best):
            best = text
    return best
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `venv/bin/python -m pytest test_scraper.py -q`
Expected: 9 more tests passing than before this task, all green.

- [ ] **Step 5: Commit**

```bash
git add fb_scraper/postmeta.py test_scraper.py
git commit -m "Add post metadata parsers."
```

---

### Task 3: DOM fixture harness

This is the layer that catches selector regressions offline. The fixtures below are hand-authored to mirror the structures the existing JS already targets, as observed in `data/evals/2026-08-13_113635/discovery_eval.csv`: a text post carries `[data-ad-comet-preview="message"]`, a reel carries none and only has `dir=auto` nodes, and comment previews are nested `role="article"` elements inside the same feed unit.

**Files:**
- Create: `tests/fixtures/post_text_card.html`
- Create: `tests/fixtures/reel_card.html`
- Create: `test_dom_fixtures.py`
- Create: `capture_fixture.py`

- [ ] **Step 1: Confirm the bundled Chromium is available**

The scraper runs `channel="chrome"`, so the bundled Chromium build might be
absent. Already verified present on this machine — `chromium.launch()` plus
`set_content()` works — so this step should be a no-op, but check rather than
assume:

Run: `venv/bin/python -c "from playwright.sync_api import sync_playwright;
p=sync_playwright().start(); b=p.chromium.launch(); print('ok'); b.close(); p.stop()"`

Expected: `ok`. If it raises, run `venv/bin/playwright install chromium`.

- [ ] **Step 2: Write the fixtures**

**Structure matters, and an earlier draft of this plan got it wrong.** The
comment-preview `role="article"` must be nested **inside** the post's
`role="article"`, and the "Leave a comment" button must be a sibling of the post
article inside a wrapper that contains no *other* top-level article. That is
what the production JS assumes: `inCommentPreview` tests
`node.closest('[role="article"]') !== primaryArticle`, and the top-level filter
drops any article whose parent has an `[role="article"]` ancestor. The first
draft made the comment article a *sibling* of the post article, which makes
`resolveUnit` refuse to climb into `.feed-unit` — verified to yield
`hasLeave: False, uiCount: None`, i.e. a fixture that tests a DOM Facebook does
not produce.

Both fixtures below were verified against the real `TAG_AND_READ_JS` before
being written down. `post_text_card.html` yields
`hasLeave=True, uiCount=14, titleText="Học được gì sau chia tay … See more"`
with an empty `skipped` list.

Create `tests/fixtures/post_text_card.html`:

```html
<!doctype html>
<meta charset="utf-8">
<div class="feed-unit">
  <div role="article" aria-posinset="1">
    <h2><a href="https://www.facebook.com/tieumyday">Tieu My</a></h2>
    <a aria-label="Friday 19 June 2026 at 21:21"
       href="https://www.facebook.com/tieumyday/posts/pfbid0Heg?__cft__[0]=AZY&__tn__=R-R">19 June</a>
    <div data-ad-comet-preview="message">
      <div dir="auto">Học được gì sau chia tay đã có mặt trên mọi nền tảng … See more</div>
    </div>
    <img src="https://scontent.example/photo1.jpg" style="height:300px;width:400px">
    <div role="article" aria-label="Comment by Nguyễn Nghĩa 4 days ago">
      <div dir="auto">Nguyễn Nghĩa</div>
      <div dir="auto">a comment that must never become the caption</div>
    </div>
  </div>
  <div role="button" aria-label="Leave a comment">14</div>
</div>
```

Create `tests/fixtures/reel_card.html` — note the deliberate absence of any
`data-ad-comet-preview` node, which is why reels currently produce no caption:

```html
<!doctype html>
<meta charset="utf-8">
<div class="feed-unit">
  <div role="article" aria-posinset="1">
    <h2><a href="https://www.facebook.com/tieumyday">Tieu My</a></h2>
    <a aria-label="Saturday 8 August 2026 at 21:46"
       href="https://www.facebook.com/reel/1073237811932972/?comment_id=1078&__tn__=R-R">8 August</a>
    <div dir="auto">Tieu My</div>
    <div dir="auto">lúc này lúc kia</div>
    <div dir="auto">Like</div>
    <video src="https://video.example/reel.mp4"></video>
    <div role="article" aria-label="Comment by Nguyễn Nghĩa 4 days ago">
      <div dir="auto">Nguyễn Nghĩa</div>
      <div dir="auto">a reel comment that must never become the caption</div>
    </div>
  </div>
  <div role="button" aria-label="Leave a comment">2</div>
</div>
```

**Verify each fixture's structure before writing tests against it.** Run
`TAG_AND_READ_JS` over it and confirm `skipped` is empty and `hasLeave` /
`uiCount` are what you expect. A fixture that silently fails the feed-post
heuristic will make every later assertion meaningless.

**These remain approximations of real markup.** They are faithful to the
structural contract the production JS depends on, but real Facebook DOM carries
far more nesting and generated class names. Once a live session is available,
run `capture_fixture.py` (below) and replace them with genuine captures — then
re-run the tests and fix whatever breaks. That divergence is itself information.

- [ ] **Step 3: Write the failing tests**

Create `test_dom_fixtures.py`:

```python
"""Offline DOM tests: run the real extraction JS against saved feed-card HTML."""

from pathlib import Path

import pytest

FIXTURES = Path(__file__).parent / "tests" / "fixtures"


async def _read_cards(html: str) -> list[dict]:
    """Run TAG_AND_READ_JS against static HTML and return its raw items."""
    from playwright.async_api import async_playwright

    from fb_scraper.inventory import TAG_AND_READ_JS

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch()
        try:
            page = await browser.new_page()
            await page.set_content(html)
            result = await page.evaluate(TAG_AND_READ_JS, 0)
        finally:
            await browser.close()
    return (result or {}).get("newly") or []


@pytest.mark.asyncio
async def test_text_post_card_reads_caption_and_badge():
    html = (FIXTURES / "post_text_card.html").read_text(encoding="utf-8")
    cards = await _read_cards(html)

    assert len(cards) == 1
    card = cards[0]
    assert card["uiCount"] == 14
    assert card["hasLeave"] is True
    assert "Học được gì sau chia tay" in " ".join(card["captionCandidates"])


@pytest.mark.asyncio
async def test_reel_card_offers_caption_candidates_without_preview_node():
    html = (FIXTURES / "reel_card.html").read_text(encoding="utf-8")
    cards = await _read_cards(html)

    assert len(cards) == 1
    candidates = cards[0]["captionCandidates"]
    assert "lúc này lúc kia" in candidates


@pytest.mark.asyncio
async def test_comment_preview_text_never_becomes_a_caption_candidate():
    html = (FIXTURES / "reel_card.html").read_text(encoding="utf-8")
    cards = await _read_cards(html)

    joined = " ".join(cards[0]["captionCandidates"])
    assert "must never become the caption" not in joined
```

- [ ] **Step 4: Run the tests and watch them fail**

Run: `venv/bin/python -m pytest test_dom_fixtures.py -q`
Expected: 3 failures with `KeyError: 'captionCandidates'` — `TAG_AND_READ_JS` does not emit that field yet. Task 6 adds it. If instead you see a Playwright launch error, go back to Step 1.

- [ ] **Step 5: Write the capture script**

Create `capture_fixture.py` — used to refresh fixtures when Facebook's DOM shifts:

```python
"""Save a real feed card's HTML into tests/fixtures/ for offline DOM tests.

Usage:
    venv/bin/python capture_fixture.py https://www.facebook.com/tieumyday reel_card
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from fb_scraper.browser import apply_stealth_if_needed, default_page, launch_browser_context

PROJECT_ROOT = Path(__file__).resolve().parent
FIXTURES = PROJECT_ROOT / "tests" / "fixtures"

OUTER_HTML_JS = """(index) => {
    const articles = Array.from(document.querySelectorAll('div[role="article"]'))
        .filter(el => !el.parentElement?.closest('[role="article"]'));
    const el = articles[index];
    if (!el) return null;
    let unit = el;
    for (let i = 0; i < 6 && unit.parentElement; i++) {
        unit = unit.parentElement;
        if (unit.querySelector('[role="button"][aria-label*="Leave a comment" i]')) break;
    }
    return unit.outerHTML;
}"""


async def capture(profile_url: str, name: str, index: int = 0) -> None:
    FIXTURES.mkdir(parents=True, exist_ok=True)
    async with launch_browser_context(PROJECT_ROOT, headless=False) as (context, _b, used_cloak):
        page = await default_page(context)
        await apply_stealth_if_needed(page, used_cloak=used_cloak)
        await page.goto(profile_url, timeout=60000, wait_until="domcontentloaded")
        await page.wait_for_timeout(8000)
        html = await page.evaluate(OUTER_HTML_JS, index)
    if not html:
        raise SystemExit(f"No feed card at index {index}")
    out = FIXTURES / f"{name}.html"
    out.write_text(
        '<!doctype html>\n<meta charset="utf-8">\n' + html, encoding="utf-8"
    )
    print(f"Wrote {out} ({len(html)} bytes)")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    asyncio.run(capture(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 0))
```

- [ ] **Step 6: Commit**

The DOM tests stay red until Task 6. That is expected and is the point of TDD — commit them as the failing specification.

```bash
git add tests/fixtures test_dom_fixtures.py capture_fixture.py
git commit -m "Add offline DOM fixture harness (tests red until caption work lands)."
```

---

### Task 4: Drive expansion from the controller

**Files:**
- Modify: `fb_scraper/constants.py` (add `REPLY_LABEL_RE`)
- Modify: `fb_scraper/timeline.py:435-530` (`_click_expand_controls`, `_expand_all_comments`)
- Modify: `test_scraper.py`

- [ ] **Step 1: Write the failing test**

Append to `test_scraper.py`:

```python
def test_reply_label_re_matches_reply_controls_only():
    from fb_scraper.constants import REPLY_LABEL_RE

    assert REPLY_LABEL_RE.search("View 3 replies")
    assert REPLY_LABEL_RE.search("2 replies")
    assert REPLY_LABEL_RE.search("Xem các phản hồi")
    assert not REPLY_LABEL_RE.search("View more comments")
    assert not REPLY_LABEL_RE.search("Xem thêm bình luận")
```

- [ ] **Step 2: Run it and watch it fail**

Run: `venv/bin/python -m pytest test_scraper.py -q -k reply_label`
Expected: `ImportError: cannot import name 'REPLY_LABEL_RE'`

- [ ] **Step 3: Add the pattern**

Append to `fb_scraper/constants.py`:

```python
# Reply-only expanders — the "replies" rung of the escalation ladder.
# Deliberately excludes "view more comments", which the click rung handles.
REPLY_LABEL_RE = re.compile(
    r"(?i)("
    r"view\s+\d+\s+repl(?:y|ies)"
    r"|view\s+\d*\s*more\s+repl(?:y|ies)"
    r"|\d+\s*repl(?:y|ies)"
    r"|xem\s+c[aá]c\s+ph[aả]n\s+h[oồ]i"
    r"|\d+\s*ph[aả]n\s+h[oồ]i"
    r")"
)
```

- [ ] **Step 4: Run it and watch it pass**

Run: `venv/bin/python -m pytest test_scraper.py -q -k reply_label`
Expected: `1 passed`

- [ ] **Step 5: Generalize the click helper**

In `fb_scraper/timeline.py`, `_click_expand_controls` currently hardcodes
`EXPAND_LABEL_RE`. Give it a pattern argument so the ladder can reuse it.
Change the signature at line 435 and the `page.evaluate` argument at line 470:

```python
    async def _click_expand_controls(self, page, pattern: str | None = None) -> int:
        """Click visible expand-more comment/reply controls. Returns click count."""
        clicked = await page.evaluate(
            """(patternSource) => {
                ...unchanged JS body...
            }""",
            # Strip Python-only (?i) — JS RegExp gets flags via the second arg.
            (pattern or EXPAND_LABEL_RE.pattern).replace("(?i)", ""),
        )
        return int(clicked or 0)

    async def _click_reply_controls(self, page) -> int:
        """Click only reply expanders — the "replies" rung of the ladder."""
        return await self._click_expand_controls(page, REPLY_LABEL_RE.pattern)
```

Update the import at `fb_scraper/timeline.py:7`:

```python
from .constants import EXPAND_LABEL_RE, REPLY_LABEL_RE
```

- [ ] **Step 6: Replace the expansion loop**

Replace `_expand_all_comments` (currently `fb_scraper/timeline.py:499-530`) with:

```python
    async def _expand_all_comments(
        self,
        page,
        comment_baseline: set[str] | None = None,
        target: int | None = None,
    ):
        """Expand until the UI badge target is met, the ladder is exhausted, or
        max_expand_rounds is hit. Returns the final ExpandState."""
        state = ExpandState(target=target, max_rounds=self.max_expand_rounds)
        prev_count = 0
        while True:
            action = next_expand_action(state)
            if action == "stop":
                break

            clicks = 0
            if action == "click":
                clicks = await self._click_expand_controls(page)
            elif action == "scroll":
                await self._scroll_comment_area(page)
            elif action == "sort_all":
                await self._prefer_all_comments(page)
            elif action == "replies":
                clicks = await self._click_reply_controls(page)

            await page.wait_for_timeout(
                int(random.uniform(*self.expand_delay_range) * 1000)
            )

            if comment_baseline is not None:
                # Do not parse page-wide HTML JSON — it mixes neighboring posts.
                only = await self._comment_arias_for_post(page, comment_baseline)
                new_count = len(await self._extract_from_dom(page, only_aria=only))
            else:
                await self._extract_from_html(page)
                await self._extract_from_dom(page)
                new_count = len(self.active_comments)

            # Progress means the comment count actually grew. A click that
            # returns a non-zero count but adds nothing is NOT progress —
            # EXPAND_LABEL_RE matches bare "see more", which fires on truncated
            # comment text, and such a node gets re-clicked every round. Treating
            # that as progress pins the controller on "click" for all 30 rounds
            # and it never scrolls.
            grew = new_count > prev_count
            state = replace(
                state,
                scraped=new_count,
                rounds=state.rounds + 1,
                quiet_rounds=0 if grew else state.quiet_rounds + 1,
                last_clicks=clicks if grew else 0,
                tried=frozenset() if grew else (state.tried | {action}),
            )
            logger.info(
                f"[expand] round {state.rounds}: action={action} clicks={clicks} "
                f"comments={new_count}/{target if target is not None else '?'} "
                f"(delta={new_count - prev_count})"
            )
            prev_count = new_count
            if clicks:
                await self._random_delay(self.expand_delay_range)
        return state
```

Add to the imports at the top of `fb_scraper/timeline.py`:

```python
from dataclasses import replace

from .expansion import ExpandState, next_expand_action
```

**Known inefficiency, do not fix here — record it and let Task 9 decide.**
Because `quiet_rounds == 0` always means `"click"`, a post whose comments load
by scrolling alternates `click, scroll, click, scroll, …`. A simulated post
where only `scroll` grows the count reaches its target in 14 rounds, half of
them no-op clicks. The old loop ran click *and* scroll every round, so within
the same 30-round budget this does roughly half as many scrolls. Irrelevant for
the measured defects (11/14, 5/6, 1/2 all finish in 5 rounds), but it could bite
on a post with a few hundred comments. If Task 9 shows a residual gap on a
high-count post, the fix is a `last_action` field so a rung that just produced
growth is retried before falling back to `click` — or simply a larger
`max_expand_rounds`. Do not pre-emptively add either.

- [ ] **Step 7: Pass the badge target at the call site**

In `scrape_timeline_with_previews` (`fb_scraper/timeline.py:599`), change:

```python
                    await self._expand_all_comments(page, comment_baseline=baseline)
```

to:

```python
                    await self._expand_all_comments(
                        page,
                        comment_baseline=baseline,
                        target=card.get("ui_count"),
                    )
```

`LegacyMixin.scrape_reel` (`fb_scraper/legacy.py:186`) also calls
`_expand_all_comments(page)` with no target — that still works, since
`target=None` falls back to the quiet-round rule.

- [ ] **Step 8: Run the full suite**

Run: `venv/bin/python -m pytest test_scraper.py -q`
Expected: 1 more test passing than before this task, all green.

- [ ] **Step 9: Commit**

```bash
git add fb_scraper/constants.py fb_scraper/timeline.py test_scraper.py
git commit -m "Drive comment expansion from the badge-targeted controller."
```

---

### Task 5: Permalink escalation

When the ladder finishes and the post is still short of its badge, open the
canonical permalink and merge whatever the full post page yields.

**Files:**
- Modify: `fb_scraper/comments.py` (add `merge_comment_lists`)
- Modify: `fb_scraper/timeline.py` (`scrape_timeline_with_previews`)
- Modify: `test_scraper.py`

- [ ] **Step 1: Write the failing test**

Append to `test_scraper.py`:

```python
def test_merge_comment_lists_dedupes_by_text_and_identity():
    from fb_scraper.comments import merge_comment_lists

    primary = [
        {"text": "hi", "author": "Alice", "author_id": "1", "time": "1d"},
        {"text": "yo", "author": "Bob", "author_id": "2", "time": "2d"},
    ]
    extra = [
        {"text": "hi", "author": "Alice", "author_id": "1", "time": "1d"},
        {"text": "new one", "author": "Cara", "author_id": "3", "time": "3d"},
    ]

    merged = merge_comment_lists(primary, extra)

    assert [c["text"] for c in merged] == ["hi", "yo", "new one"]


def test_merge_comment_lists_keeps_primary_order_and_handles_empty():
    from fb_scraper.comments import merge_comment_lists

    assert merge_comment_lists([], []) == []
    only_extra = merge_comment_lists([], [{"text": "a", "author": "A", "author_id": None}])
    assert len(only_extra) == 1
```

- [ ] **Step 2: Run it and watch it fail**

Run: `venv/bin/python -m pytest test_scraper.py -q -k merge_comment_lists`
Expected: `ImportError: cannot import name 'merge_comment_lists'`

- [ ] **Step 3: Implement it**

Append to `fb_scraper/comments.py` at module level (outside `CommentMixin`):

```python
def merge_comment_lists(primary: list[dict], extra: list[dict]) -> list[dict]:
    """Append comments from ``extra`` that ``primary`` does not already have.

    Identity is (text, author_id or author) — the same key ``CommentMixin``
    uses for in-run dedupe.
    """

    def key(item: dict):
        return (item.get("text"), item.get("author_id") or item.get("author"))

    merged = list(primary or [])
    seen = {key(c) for c in merged}
    for item in extra or []:
        item_key = key(item)
        if item_key in seen:
            continue
        seen.add(item_key)
        merged.append(item)
    return merged
```

- [ ] **Step 4: Run it and watch it pass**

Run: `venv/bin/python -m pytest test_scraper.py -q -k merge_comment_lists`
Expected: `2 passed`

- [ ] **Step 5: Wire escalation into the scrape loop**

In `fb_scraper/timeline.py:598-608`, replace the `if open_status == "opened":`
branch body with:

```python
                if open_status == "opened":
                    await self._expand_all_comments(
                        page,
                        comment_baseline=baseline,
                        target=card.get("ui_count"),
                    )
                    only = await self._comment_arias_for_post(page, baseline)
                    scoped = await self._extract_from_dom(page, only_aria=only)
                    cleaned = [
                        {**c, "content_type": content_type, "post_url": post_key}
                        for c in self._finalize_scoped_comments(scoped)
                    ]
                    gap = coverage_gap(len(cleaned), card.get("ui_count"))
                    # Keep the `or ""` — should_escalate_to_permalink calls
                    # href.strip() and would raise AttributeError on None.
                    permalink = card.get("canonical_href") or card.get("href") or ""
                    if context is not None and should_escalate_to_permalink(
                        gap, permalink, attempted=False
                    ):
                        logger.info(
                            f"[timeline] gap={gap} on {post_key} — "
                            f"escalating to permalink {permalink}"
                        )
                        extra = await self.scrape_content(context, permalink, content_type)
                        extra_clean = [
                            {**c, "content_type": content_type, "post_url": post_key}
                            for c in extra
                            if self._is_valid_comment(c)
                        ]
                        cleaned = merge_comment_lists(cleaned, extra_clean)
                        gap = coverage_gap(len(cleaned), card.get("ui_count"))
                    card["coverage_gap"] = gap
                    status = "ok" if cleaned else "no_comments"
                else:
                    status = open_status  # no_comments | open_failed
```

Add to the imports at the top of `fb_scraper/timeline.py`:

```python
from .comments import merge_comment_lists
from .expansion import (
    ExpandState,
    coverage_gap,
    next_expand_action,
    should_escalate_to_permalink,
)
```

Then add `coverage_gap` to the `post_meta` dict built at
`fb_scraper/timeline.py:610`:

```python
                "coverage_gap": card.get("coverage_gap"),
```

**Watch for a circular import:** `comments.py` must not import from
`timeline.py`. It does not today — keep it that way.

- [ ] **Step 6: Run the full suite**

Run: `venv/bin/python -m pytest test_scraper.py -q`
Expected: 2 more tests passing than before this task, all green.

- [ ] **Step 7: Commit**

```bash
git add fb_scraper/comments.py fb_scraper/timeline.py test_scraper.py
git commit -m "Escalate to the post permalink when comments fall short of the badge."
```

---

### Task 6: Caption capture

Three fixes: click *See more* before reading, offer scoped `dir=auto`
candidates so reels get a caption, and pick the winner in Python.

**Files:**
- Modify: `fb_scraper/inventory.py` (`_FEED_HELPERS_JS`, `TAG_AND_READ_JS`, `card_from_raw_item`)
- Modify: `fb_scraper/timeline.py` (`_discover_feed_cards`, re-capture at scrape time)
- Modify: `test_scraper.py`

- [ ] **Step 1: Write the failing test**

Append to `test_scraper.py`:

```python
def test_card_from_raw_item_builds_caption_and_title():
    from fb_scraper.inventory import card_from_raw_item

    card = card_from_raw_item(
        {
            "links": ["https://www.facebook.com/reel/1073237811932972"],
            "captionCandidates": ["Tieu My", "lúc này lúc kia", "Like"],
            "authorText": "Tieu My",
            "timeText": "Saturday 8 August 2026 at 21:46",
            "hasLeave": True,
            "uiCount": 2,
        },
        uid="u0",
        uid_order=0,
    )

    assert card["caption"] == "lúc này lúc kia"
    assert card["title"] == "lúc này lúc kia"
    assert card["post_datetime_iso"] == "2026-08-08T21:46"


def test_card_from_raw_item_truncates_long_caption_into_title():
    from fb_scraper.inventory import card_from_raw_item

    long_text = "y" * 400
    card = card_from_raw_item(
        {
            "links": ["https://www.facebook.com/reel/999"],
            "captionCandidates": [long_text],
            "hasLeave": True,
        },
        uid="u1",
        uid_order=1,
    )

    assert len(card["caption"]) == 400
    assert len(card["title"]) == 180
```

- [ ] **Step 2: Run it and watch it fail**

Run: `venv/bin/python -m pytest test_scraper.py -q -k "caption_and_title or long_caption"`
Expected: 2 failures with `KeyError: 'caption'`.

- [ ] **Step 3: Emit caption candidates from the JS**

In `fb_scraper/inventory.py`, inside `_FEED_HELPERS_JS`, add a *See more*
expander and replace `pickCaption` with a candidate collector.

**Correction to an earlier draft of this plan:** it said to keep `pickCaption`
because `eval_timeline_discovery.py` calls it. That is false — the eval script
has its own inlined copy (`eval_timeline_discovery.py:53`). Inventory's
`pickCaption` (`inventory.py:44`) has exactly one caller, `inventory.py:190`,
which is the line this step replaces. After this change it is dead code; delete
it rather than leaving a second, now-divergent definition of "what a caption
is" sitting next to the real one.

**There are three copies of this helper JS, and this step only fixes one.**

| Copy | Reached by | Fixed by this step? |
|---|---|---|
| `inventory.py:_FEED_HELPERS_JS` | the live two-phase scrape | yes |
| `timeline.py:_discover_feed_cards` (own inlined `pickCaption`/`pickAuthor`/`pickPostDate`) | `export_post_metadata.py:41` | **no** |
| `eval_timeline_discovery.py:53` | the discovery eval script | **no** |

So after this task, `export_post_metadata.py` still emits empty reel captions
and still has the polluted-author bug from Step 3a. Decide deliberately, and say
which you chose in your report:

- **Preferred:** make `_discover_feed_cards` build its JS from
  `_FEED_HELPERS_JS` instead of carrying a third definition, so the fix reaches
  `export_post_metadata.py` too. This is a genuine DRY improvement to a file the
  task already touches, not unrelated refactoring.
- **Acceptable:** leave it, and add a comment at `timeline.py:80` stating that
  this copy is intentionally frozen and that `export_post_metadata.py` does not
  get the caption or author fixes.

Do NOT silently fix one and leave the others looking equivalent.

```javascript
const expandSeeMore = (primaryArticle) => {
    // Click See more inside the post body only — never inside a comment preview.
    for (const node of primaryArticle.querySelectorAll('[role="button"], span, div')) {
        if (node.closest('[role="article"]') !== primaryArticle) continue;
        const t = (node.innerText || '').replace(/\\s+/g, ' ').trim();
        if (/^(See more|Xem thêm)$/i.test(t)) {
            try { node.click(); return true; } catch (e) {}
        }
    }
    return false;
};
const pickCaptionCandidates = (unit, primaryArticle) => {
    const out = [];
    const push = (t) => {
        const text = (t || '').replace(/\\s+/g, ' ').trim();
        if (text.length >= 2 && text.length <= 5000 && !out.includes(text)) out.push(text);
    };
    for (const sel of ['[data-ad-comet-preview="message"]', '[data-ad-preview="message"]']) {
        for (const node of unit.querySelectorAll(sel)) {
            if (inCommentPreview(unit, node, primaryArticle)) continue;
            push(node.innerText);
        }
    }
    for (const bq of primaryArticle.querySelectorAll('blockquote')) {
        if (inCommentPreview(unit, bq, primaryArticle)) continue;
        push(bq.innerText);
    }
    // Reels carry no preview node at all, so fall back to dir=auto — but the
    // four exclusions below are what make that fallback safe. The unscoped
    // version of this fallback is what leaked comment text before.
    const header = primaryArticle.querySelector('h2, h3');
    for (const node of primaryArticle.querySelectorAll('[dir="auto"]')) {
        // (1) comment bodies — reuse inCommentPreview, do not reimplement it,
        //     so the caption path and the date path agree on what a comment is.
        if (inCommentPreview(unit, node, primaryArticle)) continue;
        // (2) the h2/h3 heading subtree. Facebook renders the whole activity
        //     header — "<Name> is at <Place>", "is feeling", "shared a post",
        //     "is with … and N others" — inside the same heading block as the
        //     author name. Excluding it removes that entire class of false
        //     caption structurally, which no text-level blocklist can do:
        //     "<Name> is at <Place>" is lexically identical to the ordinary
        //     sentence "This is at the top of my list".
        if (header && header.contains(node)) continue;
        if (node.closest('h2, h3, h4')) continue;
        // (3) control chrome: Like/Comment/Share bar, the audience pill
        //     (Public / Công khai), the timestamp permalink. Belt-and-braces
        //     given those are exact-match chrome in Python, but it catches the
        //     localized variants nobody enumerated.
        if (node.closest('[role="button"], [role="menuitem"], [role="toolbar"], [role="tablist"]')) continue;
        if (node.closest('a[aria-label]')) continue;
        // (4) LEAVES ONLY — the one that matters most, and the one that is
        //     invisible from the Python side. dir=auto nests: an ancestor's
        //     innerText concatenates header + caption + engagement bar, so that
        //     composite is by construction the longest candidate and would win
        //     longest-wins every single time, defeating the blocklist entirely.
        if (node.querySelector('[dir="auto"]')) continue;
        push(node.innerText);
    }
    return out;
};
```

In `TAG_AND_READ_JS`, call the expander before reading and emit the candidates.
Replace the `const titleText = pickCaption(scope, el);` line with:

```javascript
        expandSeeMore(el);
        const captionCandidates = pickCaptionCandidates(scope, el);
        const titleText = captionCandidates[0] || '';
```

and add `captionCandidates,` to the object pushed into `newly`.

- [ ] **Step 3a: Fix `pickAuthor` — the guard in 3b depends on it**

The Task 3 DOM harness found a real defect on its first run. `pickAuthor`
(`fb_scraper/inventory.py:65-72`) takes `h2.innerText` wholesale, so Facebook's
activity suffix pollutes the author field:

```
authorText == "Tieu My is at Hanoi, Vietnam"     # should be "Tieu My"
```

This is not cosmetic. Step 3b's guard rejects `<author> is at <place>` by
matching the author name against the start of the candidate — so a polluted
author makes it silently fail. Verified:

```
_is_activity_header("Tieu My is at Hanoi, Vietnam", author="Tieu My")  -> True
_is_activity_header("Tieu My is at Hanoi, Vietnam", author=<polluted>) -> False
```

Fix `pickAuthor` to take the author *link* text rather than the whole heading —
`primaryArticle.querySelector('h2 a, h3 a, strong a')` first, falling back to
`h2.innerText` only when no link exists. `test_dom_fixtures.py` has a red test
asserting `authorText == "Tieu My"` on both fixtures; that is what should turn
green here. Do not weaken that test to match current behavior.

- [ ] **Step 3b: Add the author-anchored activity-header guard**

Defense in depth for the same class the DOM exclusion handles, for when a
capture has a flatter structure than expected. Task 2 deliberately refused a
plain substring blocklist for `is at` / `is with` / `is feeling` / `shared a
post`, because each collides with ordinary prose — verified: `\bis at\b`
rejects `"This is at the top of my list"`. This formulation avoids that by
anchoring on the author name `pick_caption_candidate` already receives.
Verified 8/8 chrome rejected, 8/8 real captions preserved, and inert when
`author` is empty so it cannot regress the no-author path.

Add to `fb_scraper/postmeta.py` and call it from `pick_caption_candidate`:

```python
ACTIVITY_TAIL = (
    r"is (?:at|with|feeling|celebrating|listening to|watching|playing|eating"
    r"|drinking|travelling to|traveling to|going to|looking for|thinking about)\b"
    r"|shared (?:a|an|his|her|their)\b"
    r"|added \d+ new\b|updated (?:his|her|their)\b|posted \d+\b"
    r"|đang (?:cảm thấy|ở|nghe|xem|ăn|uống|chơi)\b"
    r"|đã (?:chia sẻ|thêm|cập nhật)\b"
    r"|cùng với\b|với\b"
)


def _is_activity_header(text: str, clean_author: str) -> bool:
    """``<author> is at <place>`` etc. — chrome only when the author name leads."""
    if not clean_author:
        return False
    return bool(re.match(rf"^{re.escape(clean_author)}\s+(?:{ACTIVITY_TAIL})", text, re.I))
```

The closed verb set is load-bearing: a bare `is ` wrongly rejects
`"<Name> is the best friend anyone could ask for"`. Keep Task 2's
`test_pick_caption_candidate_does_not_blocklist_words_prone_to_false_positives`
green — this pattern passes it unchanged.

- [ ] **Step 4: Build caption and title in Python**

In `fb_scraper/inventory.py`, add the import:

```python
from .postmeta import canonical_href, parse_post_datetime_iso, pick_caption_candidate, truncate_title
```

In `card_from_raw_item`, replace the `title` assignment near the top:

```python
    candidates = item.get("captionCandidates") or []
    author = (item.get("authorText") or item.get("author") or "").strip()
    caption = pick_caption_candidate(candidates, author=author)
    if not caption:
        caption = (item.get("titleText") or item.get("title") or "").strip()
    title = truncate_title(caption)
```

and add these keys to the returned `card` dict:

```python
        "caption": caption,
        "canonical_href": canonical_href(best_href),
        "post_datetime_iso": parse_post_datetime_iso(post_date),
```

The existing `"title": title,` entry now receives the truncated value, and the
existing `author = ...` line above it becomes redundant — delete the duplicate.

- [ ] **Step 5: Run the pure tests and watch them pass**

Run: `venv/bin/python -m pytest test_scraper.py -q`
Expected: 2 more tests passing than before this task, all green.

- [ ] **Step 5b: Add the fixture that proves the deferral was honored**

Add an activity-header block to `tests/fixtures/post_text_card.html` — a
`<h2>` containing `Tieu My is at Hanoi, Vietnam` alongside the author link —
and assert the candidate list contains the caption but NOT the
`is at Hanoi` string. Without this test, the structural exclusion is a
comment in the code rather than a checked property, and the next person to
touch the JS will not know it was load-bearing.

- [ ] **Step 6: Run the DOM tests from Task 3 — they should now go green**

Run: `venv/bin/python -m pytest test_dom_fixtures.py -q`
Expected: `3 passed`. This is the moment Task 3's red tests turn green.

- [ ] **Step 7: Re-capture the caption at scrape time**

The eval showed captions going missing after expansion (`title_before_expand`
non-empty, `title_current` empty). In `fb_scraper/timeline.py`, immediately
after `open_status == "opened"` is confirmed and before expanding, re-read the
caption and keep the first non-empty value:

```python
                if open_status == "opened":
                    fresh = await page.evaluate(
                        """(uid) => {
                            const unit = document.querySelector(`[data-fc-uid="${uid}"]`);
                            const art = unit && (unit.matches('[role="article"]')
                                ? unit : unit.querySelector('[role="article"]'));
                            if (!art) return [];
                            const out = [];
                            for (const n of art.querySelectorAll('div[dir="auto"], span[dir="auto"]')) {
                                if (n.closest('[role="article"]') !== art) continue;
                                const t = (n.innerText || '').replace(/\\s+/g, ' ').trim();
                                if (t && !out.includes(t)) out.push(t);
                            }
                            return out;
                        }""",
                        uid,
                    )
                    if not card.get("caption"):
                        recovered = pick_caption_candidate(
                            fresh or [], author=card.get("author") or ""
                        )
                        if recovered:
                            card["caption"] = recovered
                            card["title"] = truncate_title(recovered)
```

Add to the `fb_scraper/timeline.py` imports:

```python
from .postmeta import pick_caption_candidate, truncate_title
```

and add `"caption": card.get("caption") or "",` to the `post_meta` dict.

- [ ] **Step 8: Run everything**

Run: `venv/bin/python -m pytest -q`
Expected: all green, including the 3 DOM-fixture tests that were red since Task 3.

- [ ] **Step 9: Commit**

```bash
git add fb_scraper/inventory.py fb_scraper/timeline.py fb_scraper/postmeta.py test_scraper.py
git commit -m "Capture full captions, including reels."
```

---

### Task 7: Engagement counts and media URLs

**Files:**
- Modify: `fb_scraper/inventory.py` (`_FEED_HELPERS_JS`, `TAG_AND_READ_JS`, `card_from_raw_item`)
- Modify: `test_dom_fixtures.py`
- Modify: `test_scraper.py`

- [ ] **Step 1: Write the failing tests**

Append to `test_scraper.py`:

```python
def test_card_from_raw_item_parses_engagement_and_media():
    from fb_scraper.inventory import card_from_raw_item

    card = card_from_raw_item(
        {
            "links": ["https://www.facebook.com/reel/555"],
            "captionCandidates": ["a caption"],
            "hasLeave": True,
            "reactionRaw": "1.2K",
            "shareRaw": "34 shares",
            "mediaUrls": ["https://video.example/reel.mp4"],
        },
        uid="u2",
        uid_order=2,
    )

    assert card["reaction_count"] == 1200
    assert card["share_count"] == 34
    assert card["media_urls"] == ["https://video.example/reel.mp4"]


def test_engagement_counts_are_label_anchored_not_first_number():
    """Regression guard for the defect Task 2's label parameter exists to stop.

    Without label anchoring these return the first number in the string, so a
    combined engagement label yields the wrong count for both fields.
    """
    from fb_scraper.inventory import card_from_raw_item

    card = card_from_raw_item(
        {
            "links": ["https://www.facebook.com/reel/557"],
            "hasLeave": True,
            "reactionRaw": "Like: 1.2K, Comment: 340, Share: 12",
            "reactionLabel": "reaction",   # absent from the string
            "shareRaw": "Like: 1.2K, Comment: 340, Share: 12",
            "shareLabel": "Share",
        },
        uid="u4",
        uid_order=4,
    )

    # "reaction" does not appear in the string, so refuse rather than guess.
    assert card["reaction_count"] is None
    # "Share" does appear, and 12 sits next to it — not the leading 1.2K.
    assert card["share_count"] == 12


def test_card_from_raw_item_tolerates_missing_engagement():
    from fb_scraper.inventory import card_from_raw_item

    card = card_from_raw_item(
        {"links": ["https://www.facebook.com/reel/556"], "hasLeave": True},
        uid="u3",
        uid_order=3,
    )

    assert card["reaction_count"] is None
    assert card["share_count"] is None
    assert card["media_urls"] == []
```

Append to `test_dom_fixtures.py`:

```python
@pytest.mark.asyncio
async def test_reel_card_reports_media_url():
    html = (FIXTURES / "reel_card.html").read_text(encoding="utf-8")
    cards = await _read_cards(html)

    assert "https://video.example/reel.mp4" in cards[0]["mediaUrls"]
```

- [ ] **Step 2: Run them and watch them fail**

Run: `venv/bin/python -m pytest -q -k "engagement or media_url"`
Expected: 3 failures — `KeyError: 'reaction_count'` and `KeyError: 'mediaUrls'`.

- [ ] **Step 3: Read engagement and media in the JS**

Add to `_FEED_HELPERS_JS` in `fb_scraper/inventory.py`:

```javascript
// Returns the matched keyword alongside the raw string. The keyword is NOT
// decoration — Python passes it to parse_engagement_count(label=...) so the
// number must sit adjacent to that word. Without it the parser returns the
// first number found anywhere, which on a real aria-label means
// "Like: 1.2K, Comment: 340, Share: 12" yields 1200 as the SHARE count, and
// "Top fan 5" yields a reaction count of 5. Task 2 added the label parameter
// specifically to close this; an earlier draft of this task forgot to use it.
const readEngagement = (unit, primaryArticle) => {
    const REACTION_WORDS = ['reaction', 'reactions', 'lượt thích', 'người khác'];
    const SHARE_WORDS = ['share', 'shares', 'chia sẻ'];
    const findWord = (text, words) =>
        words.find(w => text.toLowerCase().includes(w.toLowerCase())) || '';
    let reactionRaw = '', reactionLabel = '', shareRaw = '', shareLabel = '';
    for (const node of unit.querySelectorAll('[aria-label], [role="button"]')) {
        if (inCommentPreview(unit, node, primaryArticle)) continue;
        const label = (node.getAttribute('aria-label') || node.innerText || '')
            .replace(/\\s+/g, ' ').trim();
        if (!label || label.length > 60) continue;
        if (!reactionRaw) {
            const w = findWord(label, REACTION_WORDS);
            if (w) { reactionRaw = label; reactionLabel = w; }
        }
        if (!shareRaw) {
            const w = findWord(label, SHARE_WORDS);
            if (w) { shareRaw = label; shareLabel = w; }
        }
    }
    return { reactionRaw, reactionLabel, shareRaw, shareLabel };
};
const readMedia = (unit, primaryArticle) => {
    const out = [];
    for (const n of primaryArticle.querySelectorAll('img[src], video[src], video source[src]')) {
        // STRUCTURAL exclusion first. Comment-preview articles are DESCENDANTS
        // of primaryArticle, so the querySelectorAll above walks straight into
        // them and picks up commenter avatars. Reuse inCommentPreview — the
        // same helper the caption path uses — rather than relying on the size
        // heuristic below to do a structural job. Task 6a's review established
        // exactly this for captions: a heuristic standing in for a structural
        // rule fails the moment the rendering changes.
        if (inCommentPreview(unit, n, primaryArticle)) continue;
        const src = n.getAttribute('src') || '';
        const r = n.getBoundingClientRect ? n.getBoundingClientRect() : { height: 999 };
        // Size filter is now only for reaction sprites and inline icons INSIDE
        // the post body, not for avatars. Note the `r.height &&` guard: an
        // image that has not loaded yet reports height 0 and is kept — dropping
        // real media because the network was slow is worse than an occasional
        // icon. That tolerance is only safe because the structural check above
        // already removed the avatars it would otherwise have let through.
        if (n.tagName === 'IMG' && r.height && r.height < 80) continue;
        if (src && !out.includes(src)) out.push(src);
    }
    return out;
};
// KNOWN LIMITATION, do not pretend otherwise in the commit message: real
// Facebook video is usually a `blob:` src or a <source> child, and images
// arrive via `srcset` / lazy-load attributes rather than a plain `src`. This
// reads the one form that is easiest to test and least common in production.
// The DOM fixtures use plain `src` for the same reason. Treat media capture as
// best-effort until it has been checked against a real captured fixture.
```

In `TAG_AND_READ_JS`, after the `const ui = readUiCount(leaveRoot);` line add:

```javascript
        const engagement = readEngagement(scope, el);
        const mediaUrls = readMedia(scope, el);
```

and add these to the object pushed into `newly`:

```javascript
            reactionRaw: engagement.reactionRaw,
            reactionLabel: engagement.reactionLabel,
            shareRaw: engagement.shareRaw,
            shareLabel: engagement.shareLabel,
            mediaUrls,
```

- [ ] **Step 4: Parse them in Python**

Extend the import in `fb_scraper/inventory.py`:

```python
from .postmeta import (
    canonical_href,
    parse_engagement_count,
    parse_post_datetime_iso,
    pick_caption_candidate,
    truncate_title,
)
```

Add to the `card` dict in `card_from_raw_item`:

```python
        "reaction_count": parse_engagement_count(
            item.get("reactionRaw") or "", label=item.get("reactionLabel") or None
        ),
        "share_count": parse_engagement_count(
            item.get("shareRaw") or "", label=item.get("shareLabel") or None
        ),
        "media_urls": list(item.get("mediaUrls") or []),
```

- [ ] **Step 5: Run everything**

Run: `venv/bin/python -m pytest -q`
Expected: 3 more tests passing than before this task (2 pure + 1 DOM), all green.

- [ ] **Step 6: Commit**

```bash
git add fb_scraper/inventory.py test_scraper.py test_dom_fixtures.py
git commit -m "Read reaction counts, share counts, and media URLs from feed cards."
```

---

### Task 8: Persist the new fields

**Files:**
- Modify: `fb_scraper/storage.py` (`_init_db`, `_db_upsert_post`, `write_timeline_csv`)
- Modify: `fb_scraper/timeline.py` (`post_meta` dict)
- Modify: `test_scraper.py`

> **Decide what `title` and `caption` mean before persisting them.** After Task 6
> they are not "short version / long version" of one thing — they diverge along
> four axes at once:
>
> | | `title` | `caption` |
> |---|---|---|
> | source | preview node / blockquote only | full candidate pool incl. `dir="auto"` |
> | selection | first-wins | longest-wins among survivors |
> | length | 180-char slice | up to 5000 |
> | cleaning | raw — keeps `… See more` and translation tails | `clean_caption` applied |
>
> Two consequences a consumer will hit: the same post shows the truncation
> marker in one column and silently hides it in the other, and **`caption` can
> be empty while `title` is populated** when every candidate is rejected by the
> chrome or author-equality checks — so "caption is the richer field" is not
> reliably true. Consider a `caption_truncated` flag rather than leaving the
> asymmetry implicit, and document the difference where a CSV reader will see it.
>
> **`title` must keep its current derivation regardless.**
> `is_qualified_inventory_card` reads it and `discover_inventory` counts that
> against `max_posts` — widening it is what admitted a "Suggested for you" block
> as a post in Task 6a. `caption` is additive only.
>
> Note also that `post_meta` already carries `caption` and `post_datetime_iso`
> into `posts.json` (whole-dict `json.dumps`), but sqlite and `write_timeline_csv`
> both drop them today. That split — persisted in JSON, absent from the canonical
> DB — is what this task closes.

- [ ] **Step 1: Write the failing test**

Append to `test_scraper.py`:

```python
def test_run_storage_persists_new_post_columns(tmp_path):
    import json
    import sqlite3

    from fb_scraper.storage import RunStorage

    store = RunStorage(tmp_path, profile_url="https://www.facebook.com/x")
    store.save_post_result(
        {
            "post_key": "https://www.facebook.com/reel/555",
            "content_type": "reel",
            "title": "a caption",
            "caption": "a caption that is longer than the title would be",
            "post_date": "Saturday 8 August 2026 at 21:46",
            "post_datetime_iso": "2026-08-08T21:46",
            "href": "https://www.facebook.com/reel/555?__tn__=R-R",
            "canonical_href": "https://www.facebook.com/reel/555",
            "reaction_count": 1200,
            "share_count": 34,
            "media_urls": ["https://video.example/reel.mp4"],
            "coverage_gap": 0,
            "escalated": True,
            "status": "ok",
        },
        [],
        {},
        {},
        set(),
    )

    with sqlite3.connect(store.db_path) as conn:
        conn.row_factory = sqlite3.Row
        row = dict(
            conn.execute(
                "SELECT caption, reaction_count, share_count, media_urls, escalated, "
                "canonical_href, post_datetime_iso, coverage_gap FROM posts"
            ).fetchone()
        )

    assert row["caption"].startswith("a caption that is longer")
    assert row["reaction_count"] == 1200
    assert row["share_count"] == 34
    # JSON, not a comma join — see the note in Step 4 on why.
    assert json.loads(row["media_urls"]) == ["https://video.example/reel.mp4"]
    assert row["canonical_href"] == "https://www.facebook.com/reel/555"
    assert row["post_datetime_iso"] == "2026-08-08T21:46"
    assert row["coverage_gap"] == 0
    assert row["escalated"] == 1


def test_timeline_csv_includes_coverage_gap(tmp_path):
    from fb_scraper.storage import RunStorage

    store = RunStorage(tmp_path, profile_url="https://www.facebook.com/x")
    store.write_timeline_csv(
        [{"timeline_seq": 1, "post_key": "k", "coverage_gap": -3, "caption": "cap"}]
    )
    text = store.timeline_csv.read_text(encoding="utf-8-sig")

    assert "coverage_gap" in text.splitlines()[0]
    assert "-3" in text
```

- [ ] **Step 2: Run them and watch them fail**

Run: `venv/bin/python -m pytest test_scraper.py -q -k "new_post_columns or coverage_gap"`
Expected: `sqlite3.OperationalError: no such column: caption`, and a `KeyError`
or missing-header assertion for the CSV.

- [ ] **Step 3: Add the columns and migration**

In `fb_scraper/storage.py:_init_db`, add to the `CREATE TABLE posts` body:

```sql
                    caption TEXT,
                    reaction_count INTEGER,
                    share_count INTEGER,
                    media_urls TEXT,
                    canonical_href TEXT,
                    post_datetime_iso TEXT,
                    coverage_gap INTEGER,
                    escalated INTEGER,
```

`escalated` was missing from an earlier draft of this list. Task 5 added it to
`post_meta` after this task was written — it records whether the permalink
fallback fired for a post, which is what makes the escalation circuit-breaker
diagnostic queryable from data instead of a log grep. It also distinguishes a
post that failed to open in-page but was rescued by the permalink from one that
opened cleanly, since both now report `status = "ok"`. Store it as 0/1.

and extend the existing migration tuple so older DBs pick the columns up:

```python
            for col, decl in (
                ("status", "TEXT"),
                ("timeline_seq", "INTEGER"),
                ("key_kind", "TEXT"),
                ("ui_comment_count", "INTEGER"),
                ("flags", "TEXT"),
                ("caption", "TEXT"),
                ("reaction_count", "INTEGER"),
                ("share_count", "INTEGER"),
                ("media_urls", "TEXT"),
                ("canonical_href", "TEXT"),
                ("post_datetime_iso", "TEXT"),
                ("coverage_gap", "INTEGER"),
                ("escalated", "INTEGER"),
            ):
```

- [ ] **Step 4: Write the columns in `_db_upsert_post`**

Add to the INSERT column list, the `VALUES` placeholders, the `DO UPDATE SET`
clause, and the parameter tuple.

**Do NOT copy the `flags` comma-join precedent for `media_urls`.** An earlier
draft of this step did, and it silently corrupts. `flags` are short comma-free
tokens; URLs are not. Every `data:` URI contains a comma by specification — the
separator after the mediatype — and Facebook query strings can carry them too.
Verified round trip:

```
join : data:image/svg+xml,%3Csvg%3E,https://scontent.example/a.jpg
split: ['data:image/svg+xml', '%3Csvg%3E', 'https://scontent.example/a.jpg']
```

Two entries become three garbage rows, undetectably. `readMedia` can genuinely
emit such URLs: its `r.height &&` guard deliberately keeps height-0 images, and
a lazy-load placeholder is exactly that.

Use JSON instead, next to the existing `flags` handling at the top of the method:

```python
        media = post.get("media_urls")
        if isinstance(media, list):
            media = json.dumps(media, ensure_ascii=False)
```

(`"\n".join(media)` is also acceptable, since a newline cannot appear in a URL —
but JSON round-trips unambiguously and needs no parsing convention.)

Note also that the call site in `timeline.py` already pre-joins `flags` before
`_db_upsert_post` joins again. Pick one layer for `media_urls` and be
consistent — do not repeat that.

then pass `post.get("caption")`, `post.get("reaction_count")`,
`post.get("share_count")`, `media`, `post.get("canonical_href")`,
`post.get("post_datetime_iso")`, `post.get("coverage_gap")`, and
`int(bool(post.get("escalated")))` in the same order as the column list.

- [ ] **Step 5: Add the CSV fields**

In `write_timeline_csv`, add `"caption"`, `"coverage_gap"`, `"reaction_count"`,
`"share_count"`, `"canonical_href"`, and `"media_urls"` to `fields`, and the
matching entries to the `w.writerow({...})` dict, following the existing
`row.get(...) or ""` style.

`media_urls` was missing from an earlier draft of this list, which would have
made it DB-only for no stated reason. In the CSV, join with a separator that
cannot occur in a URL — a space or a pipe — rather than a comma, since the file
is comma-delimited and `csv` would otherwise quote the whole field into one
hard-to-read cell.

- [ ] **Step 6: Populate them at the call site**

In `fb_scraper/timeline.py`, extend the `post_meta` dict with:

```python
                "caption": card.get("caption") or "",
                "canonical_href": card.get("canonical_href") or "",
                "post_datetime_iso": card.get("post_datetime_iso"),
                "reaction_count": card.get("reaction_count"),
                "share_count": card.get("share_count"),
                "media_urls": card.get("media_urls") or [],
                "coverage_gap": card.get("coverage_gap"),
```

- [ ] **Step 7: Run everything**

Run: `venv/bin/python -m pytest -q`
Expected: 2 more tests passing than before this task, all green.

- [ ] **Step 8: Verify an old run still loads**

Run:

```bash
venv/bin/python -c "
from fb_scraper.storage import RunStorage
s = RunStorage('.', run_id='2026-08-14_002148', resume=True)
print('posts', len(s.load_posts()), 'comments', len(s.load_comments()))
print('done', len(s.load_done_keys(s.load_comments())))
"
```

Expected: `posts 2 comments 2` and `done 2` — the migration must not break
resume against a pre-existing run.

- [ ] **Step 9: Commit**

```bash
git add fb_scraper/storage.py fb_scraper/timeline.py test_scraper.py
git commit -m "Persist captions, engagement, media, and coverage gap."
```

---

### Task 9: Verify against a live profile

Offline tests cannot prove the badge target is actually reachable. This task is
the acceptance gate from the spec.

**Files:** none modified unless a failure is found.

> **Resolve before running: the working tree and git history have diverged.**
> `fb_scraper/browser.py`, `fb_scraper/session_import.py`, `login_session.py`,
> and `import_chrome_to_cloak.py` are **untracked** — they exist only on disk.
> The committed `fb_scraper/scraper.py` has no `from .browser import` line while
> the working-tree copy does, so the committed code is an older architecture than
> the scraper that actually runs. This task therefore verifies the working tree,
> not the branch. Two consequences: a fresh clone of this branch will not
> reproduce the result, and `capture_fixture.py` cannot run there either.
> This is the repository owner's call, not the implementer's — ask before
> committing any of those files.

- [ ] **Step 1: Confirm the full suite is green and the output is pristine**

Run: `venv/bin/python -m pytest -q`
Expected: everything green, no warnings, no stray output.

> **A green result here does NOT prove the high-count case works.** The Task 4
> review simulated it: because `tried` clears on every growth, `click` is
> re-tried at the head of each stall, so a post that only grows by scrolling
> alternates `click, scroll, click, scroll…` and wastes half its rounds. The
> effective ceiling is roughly `(max_rounds / 2) × comments_per_scroll` — a
> 200-comment post that grows ~10 per scroll reaches about **150 of 200** and
> then hits the 30-round budget. Click-driven posts are unaffected (200/200 in
> 20 rounds). The five posts on `tieumyday` are all small, so this run will pass
> without ever exercising the ceiling. To actually cover it, include a post with
> more than ~150 comments in Step 2 and check its gap specifically. If it comes
> up short, the pre-authorized fixes are a `last_action` field so a rung that
> just produced growth is retried before falling back to `click`, or simply a
> larger `max_expand_rounds`.

- [ ] **Step 2: Run a live scrape against the profile the demos used**

Run: `venv/bin/python scraper.py https://www.facebook.com/tieumyday --max-posts 5`

Headed (no `--headless`) so you can complete login/2FA if prompted. Note the
run id printed as `Run storage: data/runs/<run_id>`.

- [ ] **Step 3: Check the coverage gap**

Run:

```bash
venv/bin/python -c "
import csv, sys, pathlib
run = sorted(pathlib.Path('data/runs').iterdir())[-1]
rows = list(csv.DictReader((run / 'timeline.csv').open(encoding='utf-8-sig')))
for r in rows:
    print(r['seq'], r['content_type'], 'ui=' + r['ui_count'], 'scraped=' + r['scraped'],
          'gap=' + r['coverage_gap'], 'caption=' + r['caption'][:40])
short = [r for r in rows if r['coverage_gap'] not in ('', '0') and int(r['coverage_gap']) < 0]
blank = [r for r in rows if r['coverage_gap'] in ('', None)]
print('SHORT:', len(short), 'of', len(rows), '| BLANK gap:', len(blank))
"
```

Expected: `SHORT: 0` AND `BLANK gap: 0` — every post reached its badge, and no
post is missing a gap reading. The three posts that read −1, −1, −3 in
`data/demos/2026-08-14_005923/gap_report.csv` are the ones to watch.

> **`SHORT: 0` alone does not mean the feature worked.** Two ways it can lie,
> both found in the Task 5 review:
>
> 1. **Blank gaps hide total failures.** `coverage_gap` was only set on the
>    `opened` path, so an `open_failed` post — zero comments scraped, the worst
>    outcome in the run — recorded `None` and slipped through the `not in ('','0')`
>    filter. Hence the `BLANK gap` check above.
> 2. **Duplicates can close the gap without recovering anything.** The gap is
>    `len(cleaned) - ui_count`, so any comment counted twice moves it toward
>    zero. Task 5's merge originally deduped on one identity key while the rest
>    of the pipeline used two, letting the same comment appear once by author
>    name and once by numeric id. Before trusting a green result, spot-check one
>    escalated post for repeated `(author, text)` pairs in `comments.json`.

- [ ] **Step 3b: Do NOT treat media capture as verified**

`readMedia` reads `img[src]`, `video[src]`, and `video source[src]`. Both the
fixtures and those selectors use the plain `src` form, which is the form least
common in production. Task 7's implementer assessed the real markup and the
answer is not encouraging:

- Facebook video frequently attaches via `blob:` URLs (Media Source Extensions)
  rather than a static file URL. Those get captured as strings but are
  page- and session-local — not fetchable later, so a populated `media_urls`
  column can be entirely useless.
- Images commonly arrive via `srcset` and/or lazy-load attributes before `src`
  is set. An `<img>` with no `src` yet yields nothing, and when `src` does
  appear it is often the lowest-resolution variant rather than the best one in
  `srcset`.
- `video source[src]` does genuinely handle the `<video><source>` shape.

So: check what `media_urls` actually contains on the live run, count how many
entries are `blob:`, and record the answer. **Do not report media capture as
working on the strength of the fixture tests.** If most entries are `blob:` or
empty, the honest outcome is that media capture needs rework against a real
captured fixture — which is what `capture_fixture.py` exists for.

- [ ] **Step 4: Confirm captions**

Expected from the same output: reel rows have a non-empty `caption` (they were
empty before), and at least one post's `caption` is longer than its 180-char
`title`.

- [ ] **Step 4b: Watch for repeated permalink navigations into a checkpoint**

Task 5 surfaced an architectural gap it correctly declined to fix in scope.
`scrape_post` returns `[]` both when a post genuinely has no comments and when
the session has died — the caller cannot tell those apart. `scrape_timeline_with_previews`
re-checks session validity nowhere except inside escalation. So if the session
dies mid-run, every subsequent short post triggers another full permalink
navigation that lands on an auth-challenge page. Repeatedly hitting a checkpoint
is exactly the pattern that worsens anti-bot standing.

`MAX_PERMALINK_ESCALATIONS_PER_PROFILE = 15` bounds the damage but does not
detect the condition. During the run, watch the log for consecutive
`escalating to permalink` lines that yield zero extra comments — that is the
signature. If you see it, stop the run rather than letting it burn through the
cap. The real fix is to let `scrape_post` distinguish "session dead" from
"genuinely short" in its return contract, which means changing `legacy.py`.

- [ ] **Step 4c: Separate "expansion fell short" from "the parser dropped them"**

These need opposite fixes, and the run produces no evidence distinguishing
them unless you look.

**First, check the badge was read at all.** Everything is gated on
`readUiCount` parsing the Leave-a-comment button's `innerText` against
`^([\d,.]+)\s*([KkMm])?$`. If it misses, `ui_count` is None, there is no
`target`, `should_escalate_to_permalink(None, …)` returns False, and **the
entire feature silently reverts to pre-branch behaviour with every test still
green.** `ui_count_raw` is persisted for exactly this — if it holds something
like `"Comment"` or an empty string rather than a number, stop and fix the
badge parse before drawing any conclusion about coverage.

**Then, for any post still at `coverage_gap < 0` after escalation**, check
whether the missing comments were ever extractable. `_extract_from_dom`
(`comments.py`) discards a comment when it has no author and no author_id,
when its text is `_is_noise`, and — most consequentially — when the aria-label
yields no time (`if not time_s: continue`). Sticker-only and emoji-only
comments have empty text. **The badge counts all of those.**

So a post can be permanently 11/14 for parsing reasons no amount of expansion
will fix, and the machinery would spend up to 15 permalink loads per profile
chasing an unreachable number — trading anti-bot budget for nothing. If the
shortfall is parser-side, the fix belongs in `_extract_from_dom`, not in the
ladder.

- [ ] **Step 5: If a post is still short**

Do not paper over it by loosening the target. Use
`skills/systematic-debugging/SKILL.md`: find which rung of the ladder ran last
in the `[expand]` log lines, reproduce that single post via
`venv/bin/python scraper.py <permalink>`, and write a failing test for the real
cause before changing anything.

- [ ] **Step 6: Commit any fixes and finish**

```bash
git add -A
git commit -m "Fix <specific issue found in live verification>."
```

Then follow `skills/finishing-a-development-branch/SKILL.md` to merge
`comment-coverage-and-post-metadata`.

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| `next_expand_action` / `is_expansion_complete` / `coverage_gap` | 1 |
| `should_escalate_to_permalink` + permalink fallback | 1, 5 |
| `clean_caption`, `truncate_title`, `parse_engagement_count`, `canonical_href`, `parse_post_datetime_iso`, `pick_caption_candidate` | 2 |
| DOM fixtures + `capture_fixture.py` | 3 |
| Controller wired into `_expand_all_comments` | 4 |
| See more click, scoped reel fallback, capture twice | 6 |
| Reaction/share counts, media URLs | 7 |
| New `posts` columns + migration + CSV | 8 |
| Acceptance: `coverage_gap == 0` | 9 |

**Placeholder scan:** none. Every code step carries the code; every run step
carries the command and its expected output.

**Type consistency:** `ExpandState` fields are identical in Tasks 1 and 4.
`pick_caption_candidate(candidates, *, author)` is called with that signature in
Tasks 2, 6, and 7. `media_urls` is a `list[str]` everywhere in memory and only
becomes a comma-joined string inside `_db_upsert_post` (Task 8). `coverage_gap`
is `int | None` in the controller, the card, `post_meta`, and the DB column.

**Known ordering note:** Task 3 deliberately commits failing tests. They turn
green in Task 6 Step 6. Anyone running the suite between those two tasks will
see 3 failures in `test_dom_fixtures.py`; that is expected, not a regression.

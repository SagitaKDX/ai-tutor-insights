# Preserve Comments Across Expansion Rounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the comment expansion loop from throwing away comments it has already seen, so a rung that re-renders the comment panel (`sort_all`) can no longer destroy a post's harvest.

**Architecture:** `_expand_all_comments` already calls `_extract_from_dom` once per round but keeps only `len()` of the result. This plan keeps the list instead — accumulating it across rounds with the existing `merge_comment_lists` — and merges that accumulator into the single post-loop DOM read at the `timeline.py` call site. The expansion *decision* logic is untouched: `new_count` still comes from the live DOM snapshot, so the ladder escalates exactly as it does today.

**Tech Stack:** Python 3.14, Playwright 1.60 (async), pytest 9.1 + pytest-asyncio 1.4.

---

## Evidence this is real

From `data/runs/2026-08-17_161334`, reel `978830841224924` (badge = 40 comments):

```
[expand] round 1: action=click    clicks=2 comments=15/40 (delta=15)
[expand] round 2: action=click    clicks=4 comments=17/40 (delta=2)
[expand] round 3: action=click    clicks=2 comments=17/40 (delta=0)
[expand] round 4: action=scroll   clicks=0 comments=17/40 (delta=0)
[expand] round 5: action=sort_all clicks=0 comments=7/40  (delta=-10)   <-- panel re-rendered
[expand] round 6: action=replies  clicks=1 comments=7/40  (delta=-10)
```

17 comments were confirmed present in round 2. `sort_all` switched the comment
sort order, Facebook re-rendered the list from scratch, and the post-loop read
at `timeline.py:208` — the only read whose result is actually kept — saw 6
survivors. `coverage_gap` = 6 − 40 = **−34**. Permalink escalation recovered
some, final save was 12.

`advance_expand_state` already clamps `scraped` with `max(state.scraped,
new_count)`, and its docstring is explicit that this protects only the
controller's own stop/escalate decision:

> *"The clamp only affects the controller's own stop/escalate decision — it does
> not touch what ultimately gets saved, since the caller always does one more
> independent DOM read after the loop ends."*

So the clamp is working as designed. The gap is that nothing preserves the
**data** behind those counts. This plan closes exactly that.

Frequency in the same run: 5 `sort_all` rounds, 1 of them destructive — but it
landed on the highest-comment post in the run, so the damage concentrated where
it hurt most.

---

## Global Constraints

- **TDD is mandatory.** Write the test, run it, watch it fail for the right
  reason, then write the minimal code.
- **Do not change how `new_count` is measured.** It must keep coming from the
  current DOM read, not from the accumulator's length. The accumulator is
  monotonic by construction; feeding its length into `advance_expand_state`
  would make `grew` true on rounds where the DOM did not actually grow, which
  clears `tried` and pins the controller on `"click"` — the exact failure the
  existing "clicks alone are not progress" reasoning exists to prevent.
- **Do not add a new dedupe rule.** `merge_comment_lists` (`comments.py:18`)
  already implements the dual-key `(text, author)` / `(text, author_id)` match
  this needs, and its docstring explains why a single key inflates
  `coverage_gap`. Reuse it.
- **The accumulator only applies to the scoped path.** The `comment_baseline is
  None` branch already accumulates into `self.active_comments`, so it loses
  nothing and must not be touched.
- Run the whole suite before every commit: `venv/bin/python -m pytest -q`.
  Baseline on this branch is **156 passed**.
- Commit after each task.

**Do not start Task 1 while a scrape is running.** `venv/bin/python -m pytest`
imports the same modules the running scraper does; editing them mid-run risks a
partially-written module being imported. Check first:

```bash
ps aux | grep "scraper.py" | grep -v grep
```

Expected: no output.

## File map

| File | Responsibility |
|------|----------------|
| `fb_scraper/expanding.py:218-286` | Accumulate each round's extraction; return it alongside `ExpandState` |
| `fb_scraper/timeline.py:203-212` | Merge the accumulator into the post-loop read before finalizing |
| `test_expansion.py` | Round-by-round regression test reproducing the `sort_all` drop |
| `test_comments.py` | Guard that `_finalize_scoped_comments` keeps recovered rows |

---

### Task 1: Accumulate each round's harvest

**Files:**
- Modify: `fb_scraper/expanding.py:218-286`
- Modify: `test_expansion.py`

- [ ] **Step 1: Write the failing test**

Append to `test_expansion.py`:

```python
# ---------- Expansion preserves what it has already seen ----------

import pytest

from fb_scraper import FacebookCommentScraper


def _rows(n: int) -> list[dict]:
    """n distinct comment dicts shaped like _extract_from_dom's output."""
    return [
        {"text": f"c{i}", "time": "1d", "author": f"A{i}", "author_id": str(i)}
        for i in range(n)
    ]


class _FakePage:
    async def wait_for_timeout(self, ms):
        return None


def _stub_expansion_browser_calls(scraper, readings: list[list[dict]]):
    """Drive _expand_all_comments off a fixed list of per-round DOM readings."""
    calls = {"i": 0}

    async def fake_extract(page, only_aria=None):
        i = min(calls["i"], len(readings) - 1)
        calls["i"] += 1
        return readings[i]

    async def fake_arias(page, baseline):
        return set()

    async def noop(*args, **kwargs):
        return 0

    scraper._extract_from_dom = fake_extract
    scraper._comment_arias_for_post = fake_arias
    scraper._click_expand_controls = noop
    scraper._scroll_comment_area = noop
    scraper._prefer_all_comments = noop
    scraper._click_reply_controls = noop
    scraper._random_delay = noop


@pytest.mark.asyncio
async def test_expansion_returns_every_comment_it_saw_not_just_the_last_read():
    """Reproduces reel 978830841224924 from data/runs/2026-08-17_161334.

    click grows the panel to 17, then the sort_all rung re-renders it and only
    7 survive. The 17 were confirmed present and must not be lost.
    """
    scraper = FacebookCommentScraper("http://dummy-url")
    scraper.max_expand_rounds = 8
    scraper.expand_delay_range = (0, 0)
    _stub_expansion_browser_calls(
        scraper,
        [_rows(15), _rows(17), _rows(17), _rows(17), _rows(7), _rows(7)],
    )

    state, harvested = await scraper._expand_all_comments(
        _FakePage(), comment_baseline=set(), target=40
    )

    assert len(harvested) == 17
    assert {c["text"] for c in harvested} == {f"c{i}" for i in range(17)}
    # The controller's own view is unchanged: it still clamps at the high-water
    # mark and still walked the whole ladder before stopping.
    assert state.scraped == 17


@pytest.mark.asyncio
async def test_expansion_ladder_decisions_are_unchanged_by_accumulation():
    """The accumulator must not feed back into progress detection.

    Reading the same 5 rows every round is NOT progress, so the ladder has to
    escalate and stop rather than treating a growing accumulator as growth.
    """
    scraper = FacebookCommentScraper("http://dummy-url")
    scraper.max_expand_rounds = 30
    scraper.expand_delay_range = (0, 0)
    _stub_expansion_browser_calls(scraper, [_rows(5)])

    state, harvested = await scraper._expand_all_comments(
        _FakePage(), comment_baseline=set(), target=99
    )

    assert len(harvested) == 5
    # Round 1 grows 0 -> 5, then four stalled rounds walk click/scroll/
    # sort_all/replies and the ladder is exhausted. Nowhere near max_rounds.
    assert state.rounds == 5
    assert state.scraped == 5


@pytest.mark.asyncio
async def test_expansion_without_a_baseline_returns_an_empty_harvest():
    """The legacy path accumulates into self.active_comments already.

    It must keep working and must not silently start returning a second,
    divergent copy of the same comments.
    """
    scraper = FacebookCommentScraper("http://dummy-url")
    scraper.max_expand_rounds = 3
    scraper.expand_delay_range = (0, 0)
    _stub_expansion_browser_calls(scraper, [_rows(4)])

    async def fake_extract_html(page):
        return None

    scraper._extract_from_html = fake_extract_html
    scraper.active_comments = _rows(4)

    state, harvested = await scraper._expand_all_comments(
        _FakePage(), comment_baseline=None, target=None
    )

    assert harvested == []
    assert state.scraped == 4
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `venv/bin/python -m pytest test_expansion.py -q -k "harvest or accumulation or saw_not_just"`

Expected: 3 failures with `TypeError: cannot unpack non-sequence ExpandState`
(the method returns a bare `ExpandState` today). If you see `AttributeError` on
one of the stubbed methods instead, the stub list is out of date with
`expanding.py` — fix the stub, not the assertion.

- [ ] **Step 3: Write the minimal implementation**

In `fb_scraper/expanding.py`, add the import at the top of the file:

```python
from .comments import merge_comment_lists
```

**Check for a circular import before running anything.** `comments.py` must not
import from `expanding.py`. It does not today (`comments.py` imports only from
`.constants`) — verify with:

```bash
grep -n "^from \.\|^import " fb_scraper/comments.py
```

Then change `_expand_all_comments` (`fb_scraper/expanding.py:218-286`). Replace
the signature docstring and the two lines that discard the extraction:

```python
    async def _expand_all_comments(
        self,
        page,
        comment_baseline: set[str] | None = None,
        target: int | None = None,
    ):
        """Expand until the UI badge target is met, the ladder is exhausted, or
        max_expand_rounds is hit.

        Returns ``(state, harvested)``. ``harvested`` is every distinct comment
        seen across ALL rounds on the scoped path, not just the ones still in
        the DOM when the loop ended — the ``sort_all`` rung re-renders the
        comment list from scratch, and the caller's single post-loop read would
        otherwise save only the survivors. It is ``[]`` on the unscoped
        (``comment_baseline is None``) path, which accumulates into
        ``self.active_comments`` instead and so loses nothing.
        """
        state = ExpandState(target=target, max_rounds=self.max_expand_rounds)
        harvested: list[dict] = []
        while True:
```

and inside the `try:` block, replace:

```python
                if comment_baseline is not None:
                    # Do not parse page-wide HTML JSON — it mixes neighboring posts.
                    only = await self._comment_arias_for_post(page, comment_baseline)
                    new_count = len(await self._extract_from_dom(page, only_aria=only))
```

with:

```python
                if comment_baseline is not None:
                    # Do not parse page-wide HTML JSON — it mixes neighboring posts.
                    only = await self._comment_arias_for_post(page, comment_baseline)
                    round_items = await self._extract_from_dom(page, only_aria=only)
                    harvested = merge_comment_lists(harvested, round_items)
                    # new_count stays the LIVE reading, never len(harvested).
                    # harvested only grows, so using it here would report growth
                    # on a round where the DOM did not grow, clearing `tried` and
                    # pinning the ladder on "click" for all max_rounds.
                    new_count = len(round_items)
```

Finally, change the return at the end of the method:

```python
        return state, harvested
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `venv/bin/python -m pytest test_expansion.py -q`
Expected: 3 more tests passing than before this task, all green.

- [ ] **Step 5: Confirm the existing callers still work**

`legacy.py:224` and `legacy.py:411` call this method as a bare statement and
discard the result, so a tuple return is inert for them. Verify rather than
assume — both lines must still be bare `await` statements with no assignment:

```bash
grep -n "_expand_all_comments" fb_scraper/legacy.py fb_scraper/timeline.py
```

Expected: `legacy.py:224` and `legacy.py:411` show `await self._expand_all_comments(page, target=target)`
with no `=` before it. `timeline.py:204` is the one Task 2 changes.

- [ ] **Step 6: Run the whole suite**

Run: `venv/bin/python -m pytest -q`
Expected: `159 passed`.

- [ ] **Step 7: Commit**

```bash
git add fb_scraper/expanding.py test_expansion.py
git commit -m "Keep every comment expansion sees, not just the last DOM read."
```

---

### Task 2: Merge the accumulator at the timeline call site

Task 1 returns the harvest; nothing consumes it yet. This task wires it in.

**Files:**
- Modify: `fb_scraper/timeline.py:203-212`
- Modify: `test_comments.py`

- [ ] **Step 1: Write the failing test**

The risk this task introduces is downstream: `_finalize_scoped_comments`
re-validates and re-dedupes everything handed to it, and it could drop the
recovered rows for reasons the accumulator cannot see. Pin that behavior.

Append to `test_comments.py`:

```python
def test_finalize_keeps_comments_recovered_from_earlier_expansion_rounds():
    """Rows lost to a panel re-render must survive the finalize pass.

    They arrive via merge_comment_lists rather than the final DOM read, so
    nothing about them is fresher than the round that saw them — but they are
    already past _extract_from_dom's author/time/noise filters, so
    _finalize_scoped_comments must not discard them.
    """
    from fb_scraper.comments import merge_comment_lists

    scraper = FacebookCommentScraper("http://dummy-url")
    scraper.active_comments = []

    final_read = [
        {"text": "survived the re-render", "time": "1d", "author": "A", "author_id": "1"}
    ]
    harvested = [
        {"text": "survived the re-render", "time": "1d", "author": "A", "author_id": "1"},
        {"text": "wiped by sort_all", "time": "2d", "author": "B", "author_id": "2"},
    ]

    cleaned = scraper._finalize_scoped_comments(
        merge_comment_lists(final_read, harvested)
    )
    texts = [c["text"] for c in cleaned]

    assert "wiped by sort_all" in texts
    assert "survived the re-render" in texts
    # The duplicate shared by both lists must collapse, not double-count —
    # coverage_gap is computed from this length.
    assert len(cleaned) == 2
```

- [ ] **Step 2: Run it and watch it fail — or pass for the right reason**

Run: `venv/bin/python -m pytest test_comments.py -q -k recovered_from_earlier`

This test may well pass immediately: it exercises `_finalize_scoped_comments`
and `merge_comment_lists`, both of which already exist. **That is an acceptable
outcome here and does not mean you skipped TDD** — the test's job is to pin
behavior Task 2's edit depends on, and a characterization test that passes on
the first run is doing exactly that. What is NOT acceptable is assuming it
passes. Run it, and if it fails, the recovered rows are being dropped
downstream — stop and find out why before editing `timeline.py`, because the
whole task is pointless if finalize discards what you just recovered.

- [ ] **Step 3: Wire the accumulator into the call site**

In `fb_scraper/timeline.py`, replace lines 203-212:

```python
                if open_status == "opened":
                    await self._expand_all_comments(
                        page, comment_baseline=baseline, target=card.get("ui_count")
                    )
                    only = await self._comment_arias_for_post(page, baseline)
                    scoped = await self._extract_from_dom(page, only_aria=only)
                    cleaned = [
                        {**c, "content_type": content_type, "post_url": post_key}
                        for c in self._finalize_scoped_comments(scoped)
                    ]
```

with:

```python
                if open_status == "opened":
                    _state, harvested = await self._expand_all_comments(
                        page, comment_baseline=baseline, target=card.get("ui_count")
                    )
                    only = await self._comment_arias_for_post(page, baseline)
                    scoped = await self._extract_from_dom(page, only_aria=only)
                    # The final read is the freshest view, so it leads; anything
                    # the loop saw but a panel re-render since removed is appended
                    # rather than lost. See the sort_all evidence in
                    # docs/superpowers/plans/2026-08-17-preserve-comments-across-expansion-rounds.md
                    scoped = merge_comment_lists(scoped, harvested)
                    cleaned = [
                        {**c, "content_type": content_type, "post_url": post_key}
                        for c in self._finalize_scoped_comments(scoped)
                    ]
```

`merge_comment_lists` is already imported at `fb_scraper/timeline.py:5` — do not
add a second import. Confirm:

```bash
grep -n "merge_comment_lists" fb_scraper/timeline.py
```

Expected: the existing import on line 5, plus the new call site.

- [ ] **Step 4: Run the whole suite**

Run: `venv/bin/python -m pytest -q`
Expected: `160 passed`.

- [ ] **Step 5: Commit**

```bash
git add fb_scraper/timeline.py test_comments.py
git commit -m "Merge the expansion harvest into the post's saved comments."
```

---

### Task 3: Verify against the live profile

Offline tests prove the plumbing. Only a live run proves the gap actually
narrows.

**Files:** none modified unless a failure is found.

- [ ] **Step 1: Confirm the suite is green and no scrape is running**

```bash
venv/bin/python -m pytest -q
ps aux | grep "scraper.py" | grep -v grep
```

Expected: `160 passed`, and no scraper process.

- [ ] **Step 2: Re-scrape the exact post that exposed the bug**

Reel `978830841224924` read 12 comments against a badge of 40 (`gap = -28`
after escalation) in `data/runs/2026-08-17_161334`.

**Scrape the PROFILE, not the reel URL.** An earlier draft of this step said to
run `scraper.py https://www.facebook.com/reel/978830841224924 --max-posts 1`,
and that verifies nothing. A bare post/reel URL takes the direct path
(`legacy.py:scrape_reel` → `_expand_all_comments(page, target=target)`), which
leaves `comment_baseline` at `None` — the unscoped branch, where `harvested` is
`[]` by design because `self.active_comments` already accumulates. The fix
lives on the scoped timeline path and is unreachable that way. Confirmed
empirically: `data/runs/2026-08-17_165236` came back with 6 comments and **no
`ui_comment_count` and no `coverage_gap` at all**, because the direct path
never builds a card or reads the badge — so there was not even a number to
compare against.

The reel was `seq=16` in the baseline run, so 20 posts is enough to reach it:

```bash
venv/bin/python scraper.py https://www.facebook.com/tieumyday \
  --cloak --headless --max-posts 20
```

Note the run id printed as `Run storage: data/runs/<run_id>`.

- [ ] **Step 3: Compare against the pre-fix baseline**

```bash
venv/bin/python -c "
import json, pathlib
run = sorted(pathlib.Path('data/runs').iterdir())[-1]
posts = json.load((run / 'posts.json').open(encoding='utf-8'))
comments = json.load((run / 'comments.json').open(encoding='utf-8'))
for key, meta in posts.items():
    n = len(comments.get(key) or [])
    print(f'{n} comments | ui={meta.get(\"ui_comment_count\")} | gap={meta.get(\"coverage_gap\")} | {key}')
"
```

Expected: **more than 12 comments**, and `gap` closer to 0 than −34. Getting to
exactly 0 is NOT the bar — see Step 5.

- [ ] **Step 4: Confirm no duplicates were introduced**

The merge is the one place this change could inflate counts, and an inflated
count moves `coverage_gap` toward 0 while recovering nothing — a false green.

```bash
venv/bin/python -c "
import json, pathlib
from collections import Counter
run = sorted(pathlib.Path('data/runs').iterdir())[-1]
comments = json.load((run / 'comments.json').open(encoding='utf-8'))
for key, rows in comments.items():
    dupes = [k for k, n in Counter(
        (r.get('text'), r.get('author') or r.get('author_id')) for r in rows
    ).items() if n > 1]
    print(len(rows), 'rows |', len(dupes), 'duplicated identities |', key)
    for d in dupes[:5]:
        print('   DUPE:', d)
"
```

Expected: `0 duplicated identities` for every post. If not, the merge key is
wrong — fix `merge_comment_lists` usage, do not loosen this check.

- [ ] **Step 5: Decide honestly whether a residual gap is a bug**

A gap that does not reach 0 is not automatically a failure of this plan. Two
different causes need opposite responses, and the run gives no evidence
distinguishing them unless you look:

- **Expansion still short** — the `[expand]` log shows the ladder stopping
  while the count was still climbing, or hitting `max_expand_rounds`. That is
  an expansion problem.
- **Parser dropped them** — `_extract_from_dom` (`comments.py:370-398`)
  discards a comment with no author *and* no author_id, one whose text is
  `_is_noise`, and any whose aria-label yields no time (`if not time_s:
  continue`). Sticker-only and emoji-only comments have empty text. **The badge
  counts all of those.** No amount of expansion recovers them.

Read the `[expand]` lines for this post and say which one it is in your report.
Do not loosen the target or the filters to make a number look better.

- [ ] **Step 6: Run the broader regression**

One post proves the specific fix. Run a wider scrape to confirm nothing else
regressed, and to compare against `data/runs/2026-08-17_161334`:

```bash
venv/bin/python scraper.py https://www.facebook.com/tieumyday \
  --cloak --headless --max-posts 50
```

Then:

```bash
venv/bin/python -c "
import json, pathlib
run = sorted(pathlib.Path('data/runs').iterdir())[-1]
posts = json.load((run / 'posts.json').open(encoding='utf-8'))
gaps = [m.get('coverage_gap') for m in posts.values() if isinstance(m.get('coverage_gap'), int)]
short = [g for g in gaps if g < 0]
print('posts:', len(posts), '| gaps read:', len(gaps))
print('still short:', len(short), sorted(short)[:10])
print('worst:', min(gaps) if gaps else None)
"
```

Baseline to beat, from `data/runs/2026-08-17_161334`: worst gap **−34**.

- [ ] **Step 7: Record what the escalation budget did**

`MAX_PERMALINK_ESCALATIONS_PER_PROFILE = 15` was 14/15 spent by post 30 of 71
in the pre-fix run, meaning the last 40 posts got no permalink fallback at all.
If this fix reduces short posts, fewer escalations should fire.

```bash
grep -c "escalating to permalink" <the run's log>
```

Report the number. **Do not raise the cap in this plan** — it is the main
anti-bot exposure in the scraper, and whether it needs raising depends on
numbers this task is producing for the first time.

- [ ] **Step 8: Commit any fixes found**

```bash
git add -A
git commit -m "Fix <specific issue found in live verification>."
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Stop discarding per-round extraction | 1 |
| Preserve comments across a panel re-render | 1 |
| Leave ladder decisions untouched | 1 (test 2) |
| Leave the legacy path untouched | 1 (test 3) |
| Consume the harvest when saving | 2 |
| No duplicate inflation of `coverage_gap` | 2 (test), 3 Step 4 |
| Live proof the gap narrows | 3 |

**Placeholder scan:** none. Every code step carries the code; every run step
carries the command and its expected output.

**Type consistency:** `_expand_all_comments` returns `(ExpandState, list[dict])`
in Task 1 and is unpacked that way in Task 2 and in all three Task 1 tests.
`harvested` is `list[dict]` everywhere. `merge_comment_lists(primary, extra)`
keeps its existing signature and is called with `(harvested, round_items)` in
Task 1 and `(scoped, harvested)` in Task 2 — primary-first in both, which is
what preserves the freshest ordering.

**Known non-goal:** this plan does not stop `sort_all` from re-rendering the
panel, and does not reorder or remove it from the ladder. It makes the
re-render harmless instead. Removing the rung would be a behavior change with
its own risk (it is the only rung that reaches comments hidden behind "Most
relevant" sorting), and it should not be bundled with a data-preservation fix.

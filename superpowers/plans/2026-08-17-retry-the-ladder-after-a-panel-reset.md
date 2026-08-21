# Retry the Ladder After a Panel Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the expansion ladder keep working after `sort_all` re-renders the comment panel, instead of walking off the end of the ladder while the freshly-sorted list sits unexpanded.

**Architecture:** Progress is currently measured from a live DOM snapshot, which goes *down* when Facebook re-renders the comment list — so a re-sort that reveals genuinely new comments reads as "no progress" and the ladder gives up. This plan measures progress from the accumulator instead (unique comments ever seen, which `merge_comment_lists` already dedupes), so a reset that reveals new comments correctly reads as growth and re-arms the ladder. `sort_all` is then capped at one firing per post so the re-armed ladder cannot spend rounds re-running a rung that provably no-ops.

**Tech Stack:** Python 3.14, Playwright 1.60 (async), pytest 9.1 + pytest-asyncio 1.4.

**Predecessor:** `docs/superpowers/plans/2026-08-17-preserve-comments-across-expansion-rounds.md` — that plan stopped the re-render from *destroying* data. This one stops it from *ending the expansion early*. Do not start this plan until that one's Task 1 and Task 2 are committed; this plan reads the accumulator those tasks introduced.

---

## Evidence this is real

From the verification run `data/runs/2026-08-17_165346`, reel `978830841224924`,
badge = 40, **after** the predecessor plan landed:

```
[expand] round 1: action=click    clicks=2 comments=15/40 (delta=15)
[expand] round 2: action=click    clicks=4 comments=17/40 (delta=2)
[expand] round 3: action=click    clicks=2 comments=17/40 (delta=0)
[expand] round 4: action=scroll   clicks=0 comments=17/40 (delta=0)
[expand] round 5: action=sort_all clicks=0 comments=7/40  (delta=-10)
[expand] round 6: action=replies  clicks=1 comments=7/40  (delta=-10)
```

Final: 20 comments saved (17 preserved by the accumulator + 3 from permalink
escalation), `coverage_gap = -20`.

The ladder stopped at **round 6 of a 30-round budget** — it ran out of
*strategies*, not rounds. And it ran out at the worst possible moment:

1. `sort_all` switched the panel to "All comments", the sort mode that shows
   the most comments.
2. That re-render collapsed the list back to 7 visible.
3. By then `tried` already held `click`, `scroll`, and `sort_all`, so only
   `replies` remained. After that rung the ladder was exhausted and the loop
   stopped.

**The freshly-sorted list was never clicked or scrolled.** The scraper switched
to the best possible view of the comments and then walked away from it.

The root cause is how progress is measured. `advance_expand_state` computes
`grew = new_count > state.scraped` where `new_count` is a live DOM snapshot.
After a re-render the snapshot is *smaller*, so `grew` is False and `tried`
keeps accumulating — even in the case where the re-rendered list contains
comments never seen before. The controller cannot tell "the panel shrank and
showed me nothing new" from "the panel shrank but revealed 7 new comments".

**This revises a claim in commit `f154a23`.** That commit's message argued the
accumulator must not feed progress detection because "the accumulator only
grows, so feeding it back into progress detection would report growth on rounds
where the DOM did not grow". That is imprecise, and the imprecision is what
this plan corrects: `merge_comment_lists` dedupes, so the accumulator grows
*only* when a round yields comments not previously seen. Re-reading the same 17
comments does not grow it. The accumulator is therefore a strictly better
progress signal than the snapshot — it is exactly "did this round teach us
anything new", which is the question `grew` is supposed to answer.

---

## Global Constraints

- **TDD is mandatory.** Write the test, run it, watch it fail for the right
  reason, then write the minimal code.
- **`advance_expand_state`'s signature and semantics do not change.** Only what
  the caller passes as `new_count` changes. The existing tests in
  `test_expansion.py` that pin `advance_expand_state` directly must stay green
  untouched — if one goes red, you changed the wrong thing.
- **Keep both counts in the log.** The `delta=-10` line is literally how the
  panel-reset bug was found. Switching the log to accumulator-only would have
  made it invisible. Log the live panel count *and* the accumulated total.
- **Bound every loop.** `max_expand_rounds` is 30 and is the real budget for
  high-count posts. A change that lets the ladder re-arm must not let it
  re-arm indefinitely — that is what Task 2 is for, and it is not optional.
- Run the whole suite before every commit: `venv/bin/python -m pytest -q`.
  Baseline entering this plan is **160 passed**.
- Commit after each task.

**Do not start Task 1 while a scrape is running:**

```bash
ps aux | grep "scraper.py" | grep -v grep
```

Expected: no output.

## File map

| File | Responsibility |
|------|----------------|
| `fb_scraper/expanding.py` | Pass the accumulated total as `new_count`; log both counts |
| `fb_scraper/expansion.py` | `sort_applied` flag; skip a spent `sort_all` in selection and in exhaustion |
| `test_expansion.py` | Reset-reveals-new-comments test; sort_all-fires-once test |

---

### Task 1: Measure progress by what was learned, not by what is on screen

**Files:**
- Modify: `fb_scraper/expanding.py`
- Modify: `test_expansion.py`

- [ ] **Step 1: Write the failing test**

The two tests added by the predecessor plan both stay green under this change —
verified by hand: their readings never reveal *new* comments after the reset
(`_rows(7)` is a subset of `_rows(17)`), so the accumulator does not grow and
both counting schemes agree. They therefore do not pin the behavior this task
changes, and a new test is required.

Append to `test_expansion.py`:

```python
@pytest.mark.asyncio
async def test_ladder_re_arms_when_a_panel_reset_reveals_new_comments():
    """A re-sort that shrinks the panel but shows NEW comments is progress.

    Reproduces reel 978830841224924 in data/runs/2026-08-17_165346, with the
    one detail the real run could not show: whether the re-sorted list held
    anything new. Here it does — 7 rows the earlier sort never displayed. The
    controller must notice, clear `tried`, and click the fresh list rather
    than reading the smaller snapshot as failure and walking off the ladder.
    """
    from scraper import FacebookCommentScraper

    def _other_rows(n: int) -> list[dict]:
        return [
            {"text": f"n{i}", "time": "1d", "author": f"B{i}", "author_id": f"b{i}"}
            for i in range(n)
        ]

    actions: list[str] = []
    scraper = FacebookCommentScraper("http://dummy-url")
    scraper.max_expand_rounds = 12
    scraper.expand_delay_range = (0, 0)
    _stub_expansion_browser_calls(
        scraper,
        [
            _rows(15),        # click
            _rows(17),        # click
            _rows(17),        # click  -> stall
            _rows(17),        # scroll -> stall
            _other_rows(7),   # sort_all -> panel reset, 7 NEW rows
            _other_rows(7),   # whatever comes next
        ],
    )

    original_click = scraper._click_expand_controls
    original_sort = scraper._prefer_all_comments
    original_scroll = scraper._scroll_comment_area
    original_replies = scraper._click_reply_controls

    async def rec_click(*a, **k):
        actions.append("click")
        return await original_click(*a, **k)

    async def rec_scroll(*a, **k):
        actions.append("scroll")
        return await original_scroll(*a, **k)

    async def rec_sort(*a, **k):
        actions.append("sort_all")
        return await original_sort(*a, **k)

    async def rec_replies(*a, **k):
        actions.append("replies")
        return await original_replies(*a, **k)

    scraper._click_expand_controls = rec_click
    scraper._scroll_comment_area = rec_scroll
    scraper._prefer_all_comments = rec_sort
    scraper._click_reply_controls = rec_replies

    state, harvested = await scraper._expand_all_comments(
        _FakePage(), comment_baseline=set(), target=40
    )

    # Every distinct comment is kept regardless — that is the predecessor fix.
    assert len(harvested) == 24

    # The point of THIS task: the reset counted as progress, so the ladder
    # went back to work on the re-sorted list instead of stopping.
    assert "sort_all" in actions
    after_sort = actions[actions.index("sort_all") + 1:]
    assert "click" in after_sort, f"ladder did not retry after the reset: {actions}"
    assert state.scraped == 24
```

- [ ] **Step 2: Run it and watch it fail**

Run: `venv/bin/python -m pytest test_expansion.py -q -k re_arms`

Expected: `AssertionError: ladder did not retry after the reset: ['click',
'click', 'click', 'scroll', 'sort_all', 'replies']` — the snapshot count of 7
read as a drop, so `tried` kept growing and the loop stopped one rung later.

If instead it fails on `len(harvested) == 24`, the predecessor plan's
accumulator is not in place — stop and confirm commits `f154a23` and `2f1bd0f`
are present before continuing.

- [ ] **Step 3: Pass the accumulated total as the progress signal**

In `fb_scraper/expanding.py`, replace the scoped measurement block:

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

with:

```python
                if comment_baseline is not None:
                    # Do not parse page-wide HTML JSON — it mixes neighboring posts.
                    only = await self._comment_arias_for_post(page, comment_baseline)
                    round_items = await self._extract_from_dom(page, only_aria=only)
                    harvested = merge_comment_lists(harvested, round_items)
                    panel_count = len(round_items)
                    # Progress is "did this round show us anything new", NOT
                    # "is the panel bigger". merge_comment_lists dedupes, so
                    # this grows only on genuinely new comments — re-reading
                    # the same rows does not move it. Using the panel snapshot
                    # instead makes a re-render (sort_all) look like failure
                    # even when the re-sorted list is full of comments the old
                    # sort never showed, which ended expansion early on
                    # reel 978830841224924 in data/runs/2026-08-17_165346.
                    new_count = len(harvested)
```

Then update the log line so the panel snapshot stays visible — it is the only
signal that a re-render happened at all:

```python
            logger.info(
                f"[expand] round {state.rounds}: action={action} clicks={clicks} "
                f"seen={new_count}/{target if target is not None else '?'} "
                f"panel={panel_count} (delta={new_count - prev_scraped})"
            )
```

`panel_count` is only bound on the scoped path, so initialize it next to
`new_count` at the top of the loop body so the unscoped path still logs:

```python
            clicks = 0
            new_count = state.scraped
            panel_count = -1
```

A `panel=-1` in the log therefore means "unscoped path, no panel reading" — not
a bug.

- [ ] **Step 4: Run the tests and watch them pass**

Run: `venv/bin/python -m pytest test_expansion.py -q`
Expected: 1 more test passing than before this task, all green — including the
two predecessor tests, which must NOT need editing.

- [ ] **Step 5: Run the whole suite**

Run: `venv/bin/python -m pytest -q`
Expected: `161 passed`.

- [ ] **Step 6: Commit**

```bash
git add fb_scraper/expanding.py test_expansion.py
git commit -F - <<'MSG'
Measure expansion progress by what was learned, not what is on screen.

grew was computed from a live DOM snapshot, so a re-render that shrank the
panel read as failure even when the re-rendered list held comments never
seen before. On reel 978830841224924 the sort_all rung switched to "All
comments" — the sort that shows the most — the panel collapsed 17 -> 7, the
controller scored that as no progress, and the ladder ran out of rungs one
round later. The best available view of the comments was never clicked or
scrolled. It stopped at round 6 of a 30-round budget.

Progress now comes from the accumulator. merge_comment_lists dedupes, so it
moves only when a round yields something new — which is precisely the
question grew is meant to answer, and unlike the snapshot it can tell "the
panel shrank and showed nothing new" from "the panel shrank but revealed 7
new comments".

This revises the reasoning in f154a23, which argued the accumulator must not
feed progress detection because it "only grows". Imprecise: it only grows on
NEW comments. Re-reading the same rows does not move it.

The panel snapshot stays in the log next to the accumulated total. The
delta=-10 line is how the reset was found in the first place; logging only
the accumulator would have hidden it.

Plan: docs/superpowers/plans/2026-08-17-retry-the-ladder-after-a-panel-reset.md
MSG
```

---

### Task 2: Fire `sort_all` at most once per post

Task 1 lets a growing round clear `tried`, which re-arms the whole ladder —
including `sort_all`. `_prefer_all_comments` (`fb_scraper/expanding.py:27-55`)
early-returns when the panel is already on "All comments":

```python
            already = scope.get_by_role(
                "button", name=re.compile(r"^(All comments|Tất cả bình luận)$", re.I)
            )
            if await already.count() > 0 and await already.first.is_visible():
                logger.info("[timeline] Sort already All comments")
                return
```

So every firing after the first is a guaranteed no-op that still costs a round
plus its randomized delay. On a post that needs its full 30-round budget, that
is budget spent on nothing.

**Files:**
- Modify: `fb_scraper/expansion.py`
- Modify: `test_expansion.py`

- [ ] **Step 1: Write the failing test**

Append to `test_expansion.py`:

```python
def test_sort_all_is_offered_once_and_then_counts_as_spent():
    from fb_scraper.expansion import ExpandState, is_expansion_complete, next_expand_action

    # Stalled, nothing tried yet but click: sort_all is still available.
    fresh = ExpandState(scraped=5, target=40, quiet_rounds=1, tried=frozenset({"click", "scroll"}))
    assert next_expand_action(fresh) == "sort_all"

    # Once applied, it is never offered again even on a cleared `tried` —
    # a second firing hits _prefer_all_comments' already-sorted early return.
    spent = ExpandState(
        scraped=5, target=40, quiet_rounds=1,
        tried=frozenset({"click", "scroll"}), sort_applied=True,
    )
    assert next_expand_action(spent) == "replies"

    # And it must count as spent for exhaustion, or the ladder can never end.
    exhausted = ExpandState(
        scraped=5, target=40, quiet_rounds=2,
        tried=frozenset({"click", "scroll", "replies"}), sort_applied=True,
    )
    assert is_expansion_complete(exhausted)
    assert next_expand_action(exhausted) == "stop"


@pytest.mark.asyncio
async def test_expansion_never_runs_sort_all_twice_even_when_the_ladder_re_arms():
    """Growth clears `tried`, which would otherwise re-offer a spent rung."""
    from scraper import FacebookCommentScraper

    actions: list[str] = []
    scraper = FacebookCommentScraper("http://dummy-url")
    scraper.max_expand_rounds = 20
    scraper.expand_delay_range = (0, 0)

    # Every round reveals one brand-new comment, so `tried` clears constantly
    # and the ladder keeps re-arming for the full budget.
    readings = [
        [{"text": f"c{j}", "time": "1d", "author": f"A{j}", "author_id": str(j)}
         for j in range(i + 1)]
        for i in range(20)
    ]
    _stub_expansion_browser_calls(scraper, readings)

    async def rec(name):
        async def inner(*a, **k):
            actions.append(name)
            return 0
        return inner

    scraper._click_expand_controls = await rec("click")
    scraper._scroll_comment_area = await rec("scroll")
    scraper._prefer_all_comments = await rec("sort_all")
    scraper._click_reply_controls = await rec("replies")

    await scraper._expand_all_comments(_FakePage(), comment_baseline=set(), target=999)

    assert actions.count("sort_all") <= 1, actions
```

- [ ] **Step 2: Run them and watch them fail**

Run: `venv/bin/python -m pytest test_expansion.py -q -k "sort_all"`

Expected: `TypeError: ExpandState.__init__() got an unexpected keyword argument
'sort_applied'` for the first test. The second may pass or fail depending on
whether the readings happen to stall — **if it passes, do not accept it**;
tighten the readings until it fails first, or the test is not pinning anything.

- [ ] **Step 3: Add the flag and honor it in both places**

In `fb_scraper/expansion.py`, add the field to `ExpandState`:

```python
    tried: frozenset[str] = frozenset()
    max_rounds: int = 30
    # Set once "sort_all" has been performed. _prefer_all_comments early-returns
    # when the panel is already on "All comments", so a second firing is a
    # guaranteed no-op that still costs a round from max_rounds. Kept separate
    # from `tried` because `tried` is cleared on every growing round.
    sort_applied: bool = False
```

Add a shared helper so selection and exhaustion can never disagree, right above
`_ladder_exhausted`:

```python
def _spent_rungs(state: ExpandState) -> frozenset[str]:
    """Rungs unavailable this round: already tried, or permanently spent.

    A stalled round (``quiet_rounds > 0``) already implies "click" was tried —
    it is the first thing every round does — even if the caller has not
    recorded it in ``tried`` yet. ``sort_all`` is added once applied, because
    unlike the others it cannot usefully repeat.
    """
    spent = state.tried | {"click"} if state.quiet_rounds > 0 else state.tried
    if state.sort_applied:
        spent = spent | {"sort_all"}
    return frozenset(spent)
```

Then rewrite `_ladder_exhausted` to use it:

```python
def _ladder_exhausted(state: ExpandState) -> bool:
    """Has every rung been tried or spent during the current stall?"""
    return _LADDER_SET <= _spent_rungs(state)
```

and the selection loop in `next_expand_action`:

```python
def next_expand_action(state: ExpandState) -> ExpandAction:
    if is_expansion_complete(state):
        return "stop"
    if state.quiet_rounds == 0 and not state.tried:
        return "click"
    spent = _spent_rungs(state)
    for action in LADDER:
        if action not in spent:
            return action
    return "stop"
```

**Note the `and not state.tried` added to the `quiet_rounds == 0` shortcut.**
Without it, a growing round clears `quiet_rounds` to 0 and the controller
returns to `"click"` unconditionally — which is the pre-existing behavior and
is fine today, but combined with Task 1 it means a re-sorted panel that keeps
yielding new comments never advances past `click`. With it, a cleared `tried`
still starts at `click` (since `tried` is empty), while a *partially* tried
ladder resumes where it left off.

- [ ] **Step 4: Set the flag in the browser layer**

In `fb_scraper/expanding.py`, inside the action dispatch:

```python
                elif action == "sort_all":
                    await self._prefer_all_comments(page)
                    sort_applied = True
```

Initialize `sort_applied = False` next to `harvested` before the loop, and pass
it through when advancing:

```python
            state = replace(
                advance_expand_state(state, action, clicks, new_count),
                sort_applied=state.sort_applied or sort_applied,
            )
```

Add `from dataclasses import replace` to the imports at the top of
`fb_scraper/expanding.py` if it is not already there — check first:

```bash
grep -n "^from dataclasses\|^import dataclasses" fb_scraper/expanding.py
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `venv/bin/python -m pytest test_expansion.py -q`
Expected: 2 more tests passing than before this task, all green.

- [ ] **Step 6: Run the whole suite**

Run: `venv/bin/python -m pytest -q`
Expected: `163 passed`.

- [ ] **Step 7: Commit**

```bash
git add fb_scraper/expansion.py fb_scraper/expanding.py test_expansion.py
git commit -F - <<'MSG'
Fire the sort_all rung at most once per post.

Task 1 lets a growing round clear `tried`, which re-arms the whole ladder.
That is what we want for click/scroll/replies and wrong for sort_all:
_prefer_all_comments early-returns once the panel is already on "All
comments", so every firing after the first is a guaranteed no-op that still
costs a round and its delay out of a 30-round budget — on exactly the
high-comment posts that need those rounds.

sort_applied is tracked separately from `tried` because `tried` is cleared
on every growing round, and it feeds a shared _spent_rungs helper so
selection and exhaustion cannot disagree about whether the ladder is done.

Also tightens the quiet_rounds == 0 shortcut to require an empty `tried`.
Without that, a partially-walked ladder restarts at "click" every time a
round grows, which with Task 1's more sensitive progress signal means a
productive re-sorted panel never advances past clicking.

Plan: docs/superpowers/plans/2026-08-17-retry-the-ladder-after-a-panel-reset.md
MSG
```

---

### Task 3: Verify against the same reel

**Files:** none modified unless a failure is found.

- [ ] **Step 1: Confirm the suite is green and nothing is scraping**

```bash
venv/bin/python -m pytest -q
ps aux | grep "scraper.py" | grep -v grep
```

Expected: `163 passed`, and no scraper process.

- [ ] **Step 2: Scrape the profile, not the reel URL**

A bare reel URL takes the direct path (`legacy.py:scrape_reel`), which leaves
`comment_baseline` at `None` and never reaches the scoped code this plan
changes. This mistake already cost one wasted verification run
(`data/runs/2026-08-17_165236`, 6 comments and no badge reading at all). The
reel is `seq=16` in the feed, so:

```bash
venv/bin/python scraper.py https://www.facebook.com/tieumyday \
  --cloak --headless --max-posts 20
```

- [ ] **Step 3: Read the expansion rounds for the reel**

```bash
awk '/978830841224924/,0' <the run log> | grep -E "\[expand\]|gap=|Saved status" | head -20
```

Expected shape — the ladder must NOT stop right after `sort_all`:

```
round 5: action=sort_all ... panel=7
round 6: action=click    ...          <-- the fix: it works the new list
```

- [ ] **Step 4: Compare the numbers**

```bash
venv/bin/python -c "
import json, pathlib
key = 'https://www.facebook.com/reel/978830841224924'
for run_id in ('2026-08-17_161334', '2026-08-17_165346', sorted(p.name for p in pathlib.Path('data/runs').iterdir())[-1]):
    run = pathlib.Path('data/runs') / run_id
    try:
        posts = json.load((run / 'posts.json').open(encoding='utf-8'))
        comments = json.load((run / 'comments.json').open(encoding='utf-8'))
    except FileNotFoundError:
        continue
    meta = posts.get(key)
    if not meta:
        continue
    print(run_id, '->', len(comments.get(key) or []), 'comments | gap =', meta.get('coverage_gap'))
"
```

Reference points: `2026-08-17_161334` (before any fix) = 12 comments, gap −28.
`2026-08-17_165346` (accumulator only) = 20 comments, gap −20. This run should
beat 20.

- [ ] **Step 5: Re-check for duplicates**

A more aggressive ladder means more merging, which is exactly where inflation
would hide. An inflated count moves `coverage_gap` toward zero while recovering
nothing.

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
    if dupes:
        print(len(rows), 'rows |', len(dupes), 'DUPES |', key)
        for d in dupes[:5]:
            print('   ', d)
print('checked', len(comments), 'posts')
"
```

Expected: no `DUPES` lines.

- [ ] **Step 6: Confirm the round budget did not blow up**

The whole risk of re-arming the ladder is that posts now spend more rounds.
Check the worst case:

```bash
grep -oE "round [0-9]+" <the run log> | awk '{print $2}' | sort -n | tail -1
```

Expected: below 30. A post hitting exactly 30 means it exhausted the budget —
report which post, and whether it was still growing when it stopped (that would
argue for raising `max_expand_rounds`, which this plan does NOT do).

- [ ] **Step 7: Classify any residual gap honestly**

Same rule as the predecessor plan. A gap that does not reach 0 is not
automatically this plan's failure:

- **Expansion still short** — the `[expand]` lines show it still climbing when
  it stopped, or it hit `max_expand_rounds`.
- **Parser dropped them** — `_extract_from_dom` (`comments.py:370-398`)
  discards a comment with no author *and* no author_id, one whose text is
  `_is_noise`, and any whose aria-label yields no time. Sticker-only and
  emoji-only comments have empty text. **The badge counts all of those.**

Say which one it is. Do not loosen the target or the filters to make a number
look better.

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
| A reset that reveals new comments counts as progress | 1 |
| The ladder re-arms and works the re-sorted list | 1 |
| Panel snapshot stays visible for debugging | 1 (log line) |
| Re-arming cannot re-run a provably no-op rung | 2 |
| Exhaustion still terminates once sort_all is spent | 2 (`_spent_rungs`) |
| Live proof the gap narrows past 20 | 3 |
| No duplicate inflation | 3 Step 5 |
| Round budget not blown | 3 Step 6 |

**Placeholder scan:** none. Every code step carries the code; every run step
carries the command and its expected output. The two `<the run log>`
placeholders in Task 3 are a path the operator learns from Step 2's output,
not undecided content.

**Type consistency:** `sort_applied` is `bool` on `ExpandState` (Task 2) and is
set from a local `bool` in `expanding.py` (Task 2 Step 4). `_spent_rungs`
returns `frozenset[str]` and is consumed by both `_ladder_exhausted` and
`next_expand_action`. `new_count` stays `int` throughout; `panel_count` is
`int` and is `-1` on the unscoped path. `harvested` remains `list[dict]`.
`advance_expand_state`'s signature is unchanged, as required.

**Known non-goal:** this plan does not raise `max_expand_rounds` and does not
change the permalink escalation budget (`MAX_PERMALINK_ESCALATIONS_PER_PROFILE
= 15`, which was fully spent by post ~35 of 71 in `data/runs/2026-08-17_161334`).
Both are anti-bot-exposure knobs and should be decided from the numbers Task 3
Step 6 produces, not bundled here.

# Recover Emoji and Sticker Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop discarding comments whose content Facebook renders as an image — large emoji and stickers — by reading the `alt` attribute the extraction currently ignores.

**Architecture:** `_extract_from_dom`'s JS builds its text candidates from `innerText` over `[dir="auto"]` nodes. `innerText` cannot see `<img alt="…">`, and Facebook renders standalone emoji and stickers exactly that way. Such a comment yields no candidates, comes back with `text: ''`, and is dropped by the `_is_noise("")` guard even though its author and timestamp parsed cleanly. The fix reads `img[alt]` as a fallback source of text — only when the normal candidates come back empty, so no comment that works today changes value.

**Tech Stack:** Python 3.14, Playwright 1.60 (async), pytest 9.1 + pytest-asyncio 1.4.

**Predecessors:** `2026-08-17-preserve-comments-across-expansion-rounds.md` and `2026-08-17-retry-the-ladder-after-a-panel-reset.md`. Those closed the *expansion* half of the coverage gap (reel `978830841224924`: 12 → 24 of a 40 badge). This plan attacks what is left, which is no longer an expansion problem.

---

## Evidence this is real

Measured on `https://www.facebook.com/tieumyday/posts/pfbid0HnLViDNeCUUbbNt9empA1r27YzR4ySbaUbxQCH143CcokYh2KUHMNppCJmstQ3nel`
(badge 14, scraper saved 13, `coverage_gap = -1`) by replaying the production
extraction JS — pulled out of `comments.py` via AST so it could not drift — and
classifying every raw row against `_extract_from_dom`'s filters in order:

```
RAW rows returned by the production JS: 19

  13  KEPT
   6  empty_or_noise_text      <- 3 distinct comments, each seen twice
   0  no_author_and_no_author_id
   0  no_timestamp_in_aria_label
   0  text_is_just_the_author_name
```

**Every single drop was the empty-text guard.** Zero were caused by the missing
timestamp rule, which earlier notes in
`2026-08-17-preserve-comments-across-expansion-rounds.md` (Task 9 Step 4c) had
flagged as "most consequential". That guess was wrong on this data, and the
plan should not have been written around it.

Probing the DOM of those three comments shows why they came back empty — and
that they are three *different* cases, not one:

| Author | `[dir=auto]` text nodes | What the comment actually is |
|---|---|---|
| Pham Thiện | `["Pham Thiện", "8w"]` | `<img alt="❤️">` × 3 — **emoji rendered as an image** |
| K Xuân Đơn | `["K Xuân Đơn", "8w"]` | `<img alt="Hacker Girl Love, girl holding heart sticker">` |
| Chien Anh | `["Chien Anh", "8w"]` | `<img alt="">`, height 120 — an image with no alt at all |

So the text nodes exist; they are just all chrome. The production JS already
strips the author name and the `\d+[smhdwy]` timestamp, correctly leaving
nothing — the content was never in a text node to begin with.

Two consequences worth stating plainly:

1. The first two cases are **fully recoverable**: the content is sitting in an
   attribute the extraction never reads.
2. The third is not recoverable as text, and this plan does not try. See
   "Known non-goal" in the Self-Review.

---

## Global Constraints

- **TDD is mandatory.** Write the test, run it, watch it fail for the right
  reason, then write the minimal code.
- **Only fill an empty result.** `img[alt]` must be consulted *after* the normal
  candidates fail, never merged into a candidate that already has text. A
  comment reading `"Hay quá"` today must still read exactly `"Hay quá"` after
  this change. Appending inline emoji would rewrite the text of comments
  already stored in `data/runs/`, and `_comment_identity_key` is
  `(text, author_id or author)` — changing text changes identity, so every
  re-scrape would re-add the same comment as a new row and inflate the very
  counts `coverage_gap` is computed from.
- **The author avatar is an `img[alt]` too.** Its alt is the author's name.
  Excluding it is not optional; without that guard every empty comment would
  come back as its author's name, which the `text == author` guard would then
  drop anyway — silently turning a fixable bug into an unfixable one.
- Run the whole suite before every commit: `venv/bin/python -m pytest -q`.
  Baseline entering this plan is **163 passed**.
- Commit after each task.

**Do not start Task 1 while a scrape is running:**

```bash
ps aux | grep "scraper.py" | grep -v grep
```

Expected: no output.

## File map

| File | Responsibility |
|------|----------------|
| `fb_scraper/comments.py` | Read `img[alt]` as a fallback text source in `_extract_from_dom`'s JS |
| `test_dom_fixtures.py` | Offline DOM tests driving the real method against fixture HTML |
| `tests/fixtures/comment_media.html` | Comment markup covering all three measured cases |

---

### Task 1: Read emoji and sticker alt text

**Files:**
- Create: `tests/fixtures/comment_media.html`
- Modify: `test_dom_fixtures.py`
- Modify: `fb_scraper/comments.py`

- [ ] **Step 1: Write the fixture**

Mirrors the three cases measured above, plus two controls: a normal text
comment that must not change, and an avatar whose alt is the author's name.

Create `tests/fixtures/comment_media.html`:

```html
<!doctype html>
<meta charset="utf-8">
<div id="feed">
  <div role="article" aria-label="Comment by Pham Thiện 8 weeks ago">
    <img alt="Pham Thiện" src="https://scontent.example/avatar1.jpg">
    <div dir="auto">Pham Thiện</div>
    <img alt="❤️" src="https://static.example/emoji-heart.png">
    <img alt="❤️" src="https://static.example/emoji-heart.png">
    <div dir="auto">8w</div>
  </div>
  <div role="article" aria-label="Comment by K Xuân Đơn 8 weeks ago">
    <img alt="K Xuân Đơn" src="https://scontent.example/avatar2.jpg">
    <div dir="auto">K Xuân Đơn</div>
    <img alt="Hacker Girl Love, girl holding heart sticker"
         src="https://static.example/sticker.png">
    <div dir="auto">8w</div>
  </div>
  <div role="article" aria-label="Comment by Chien Anh 8 weeks ago">
    <img alt="Chien Anh" src="https://scontent.example/avatar3.jpg">
    <div dir="auto">Chien Anh</div>
    <img alt="" src="https://scontent.example/photo.jpg">
    <div dir="auto">8w</div>
  </div>
  <div role="article" aria-label="Comment by Lê Xuân Thao 8 weeks ago">
    <img alt="Lê Xuân Thao" src="https://scontent.example/avatar4.jpg">
    <div dir="auto">Lê Xuân Thao</div>
    <div dir="auto">Xinh thật</div>
    <img alt="😍" src="https://static.example/emoji-smile.png">
    <div dir="auto">8w</div>
  </div>
</div>
```

- [ ] **Step 2: Write the failing tests**

Append to `test_dom_fixtures.py`:

```python
@pytest.mark.asyncio
async def _extract_comments_from(html: str) -> list[dict]:
    """Run the REAL _extract_from_dom against static HTML."""
    from playwright.async_api import async_playwright

    from scraper import FacebookCommentScraper

    scraper = FacebookCommentScraper("http://dummy-url")
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch()
        try:
            page = await browser.new_page()
            await page.set_content(html)
            return await scraper._extract_from_dom(page)
        finally:
            await browser.close()


@pytest.mark.asyncio
async def test_emoji_rendered_as_an_image_becomes_the_comment_text():
    """Facebook renders standalone emoji as <img alt="❤️">, invisible to innerText.

    Measured on a real post: three comments came back with text='' purely
    because their content lived in an alt attribute. See
    docs/superpowers/plans/2026-08-17-recover-emoji-and-sticker-comments.md
    """
    html = (FIXTURES / "comment_media.html").read_text(encoding="utf-8")
    comments = await _extract_comments_from(html)
    by_author = {c["author"]: c for c in comments}

    assert "Pham Thiện" in by_author, f"emoji-only comment was dropped: {comments}"
    assert "❤️" in by_author["Pham Thiện"]["text"]


@pytest.mark.asyncio
async def test_sticker_alt_text_becomes_the_comment_text():
    html = (FIXTURES / "comment_media.html").read_text(encoding="utf-8")
    comments = await _extract_comments_from(html)
    by_author = {c["author"]: c for c in comments}

    assert "K Xuân Đơn" in by_author, f"sticker comment was dropped: {comments}"
    assert "sticker" in by_author["K Xuân Đơn"]["text"].lower()


@pytest.mark.asyncio
async def test_the_author_avatar_alt_never_becomes_the_comment_text():
    """Every comment carries an <img alt="<author name>"> avatar.

    Without an explicit guard the fallback would return the author's name,
    which the existing text==author rule then drops — the bug would look
    fixed in the JS and still lose the comment.
    """
    html = (FIXTURES / "comment_media.html").read_text(encoding="utf-8")
    comments = await _extract_comments_from(html)

    for c in comments:
        assert c["text"] != c["author"], f"avatar alt leaked into text: {c}"


@pytest.mark.asyncio
async def test_a_comment_that_already_has_text_is_left_exactly_as_it_was():
    """The fallback must fill an EMPTY result only.

    _comment_identity_key is (text, author_id or author), so appending the
    trailing emoji here would change this comment's identity and make every
    re-scrape re-add it as a new row.
    """
    html = (FIXTURES / "comment_media.html").read_text(encoding="utf-8")
    comments = await _extract_comments_from(html)
    by_author = {c["author"]: c for c in comments}

    assert by_author["Lê Xuân Thao"]["text"] == "Xinh thật"
```

- [ ] **Step 3: Run them and watch them fail**

Run: `venv/bin/python -m pytest test_dom_fixtures.py -q -k "emoji or sticker or avatar or already_has_text"`

Expected: the emoji and sticker tests fail with `assert "Pham Thiện" in {...}` /
`assert "K Xuân Đơn" in {...}` — those comments are dropped entirely, so they
are absent from the result. The avatar and unchanged-text tests should already
pass; they are guards on behavior this task must not break.

If the emoji test instead fails on the `"❤️" in ...` assertion, the comment
survived but with wrong text — read what it actually holds before editing.

- [ ] **Step 4: Add the alt fallback to the extraction JS**

In `fb_scraper/comments.py`, inside `_extract_from_dom`'s JS, after the existing
candidate loop and the `best` selection, before the `out.push({...})`:

```javascript
                    let best = '';
                    for (const t of candidates) {
                        if (!best) best = t;
                        else if (t.length > best.length && t.length <= 500) best = t;
                    }
                    if (!best && candidates.length) best = candidates[0];
                    // Facebook renders standalone emoji and stickers as
                    // <img alt="…">, which innerText cannot see — so a comment
                    // whose whole content is one of those yields no candidates
                    // and gets dropped by the empty-text guard in Python.
                    // Consulted ONLY when nothing else was found: merging alts
                    // into a comment that already has text would change its
                    // value, and _comment_identity_key is (text, author) — a
                    // changed text is a changed identity, so every re-scrape
                    // would re-add the same comment as a new row.
                    if (!best) {
                        const alts = [];
                        for (const im of el.querySelectorAll('img[alt]')) {
                            const a = (im.getAttribute('alt') || '').trim();
                            if (!a) continue;
                            // The avatar's alt is the author's name. Without
                            // this the fallback returns the name, which the
                            // text===author rule then drops anyway.
                            if (nameGuess && a === nameGuess) continue;
                            if (!alts.includes(a)) alts.push(a);
                        }
                        best = alts.join(' ');
                    }
```

- [ ] **Step 5: Run them and watch them pass**

Run: `venv/bin/python -m pytest test_dom_fixtures.py -q`
Expected: 4 more tests passing than before this task, all green.

- [ ] **Step 6: Run the whole suite**

Run: `venv/bin/python -m pytest -q`
Expected: `167 passed`.

- [ ] **Step 7: Commit**

```bash
git add fb_scraper/comments.py test_dom_fixtures.py tests/fixtures/comment_media.html
git commit -F - <<'MSG'
Recover comments whose content is an emoji or sticker image.

_extract_from_dom built its text from innerText over [dir=auto] nodes, and
innerText cannot see <img alt="…">. Facebook renders standalone emoji and
stickers exactly that way, so such a comment produced no candidates, came
back as text='', and was dropped by the empty-text guard — despite its
author and timestamp having parsed cleanly.

Measured by replaying the production JS (pulled from source via AST so it
could not drift) over a real post with a -1 gap: 19 raw rows, 13 kept, and
ALL 6 drops were the empty-text guard. Zero came from the missing-timestamp
rule that earlier notes had flagged as the likely culprit.

The three dropped comments turned out to be three different cases: an
<img alt="❤️"> emoji, a sticker carrying a descriptive alt, and a bare
<img alt=""> photo. The first two are pure attribute-reading problems and
are fixed here. The third has no text to recover and is left dropped
deliberately — see the plan's non-goal.

The fallback fires only when the normal candidates come back empty.
_comment_identity_key is (text, author_id or author), so folding alts into
a comment that already has text would change its identity and make every
re-scrape re-add it as a new row.

Plan: docs/superpowers/plans/2026-08-17-recover-emoji-and-sticker-comments.md
MSG
```

---

### Task 2: Verify against the live profile

**Files:** none modified unless a failure is found.

- [ ] **Step 1: Confirm the suite is green and the session is alive**

```bash
venv/bin/python -m pytest -q
ps aux | grep "scraper.py" | grep -v grep
```

Expected: `167 passed`, no scraper process.

The Facebook session dies without warning (it did mid-run at 17:57 on
2026-08-17, which cost a verification run). Check before spending 30 minutes:

```bash
venv/bin/python /private/tmp/claude-501/-Users-minhlethanh/4579f567-929f-4476-a154-c1e08eaab83f/scratchpad/check_session.py
```

Expected: `SESSION_VALID: True`. If False, log in first — do not start the run.

- [ ] **Step 2: Re-measure the diagnostic post directly**

Before a full scrape, confirm the fix on the exact post the evidence came from.
Re-run the drop classifier:

```bash
venv/bin/python /private/tmp/claude-501/-Users-minhlethanh/4579f567-929f-4476-a154-c1e08eaab83f/scratchpad/diag_drops.py \
  "https://www.facebook.com/tieumyday/posts/pfbid0HnLViDNeCUUbbNt9empA1r27YzR4ySbaUbxQCH143CcokYh2KUHMNppCJmstQ3nel"
```

Expected: `empty_or_noise_text` falls from **6** to **2** — the emoji and
sticker comments now carry text, the alt-less photo comment still does not.
`KEPT` should rise from 13 to 17 (each recovered comment appears twice in the
raw rows).

- [ ] **Step 3: Scrape the profile**

The reel that drove the previous two plans is `seq=16`, so 20 posts reaches it:

```bash
venv/bin/python scraper.py https://www.facebook.com/tieumyday \
  --cloak --headless --max-posts 20
```

- [ ] **Step 4: Compare against the recorded baselines**

```bash
venv/bin/python -c "
import json, pathlib
runs = {
    'baseline (no fixes)': '2026-08-17_161334',
    'accumulator':         '2026-08-17_165346',
    'accumulator+ladder':  '2026-08-17_174334',
    'this run':            sorted(p.name for p in pathlib.Path('data/runs').iterdir())[-1],
}
key = 'https://www.facebook.com/reel/978830841224924'
for label, rid in runs.items():
    run = pathlib.Path('data/runs') / rid
    try:
        posts = json.load((run / 'posts.json').open(encoding='utf-8'))
        comments = json.load((run / 'comments.json').open(encoding='utf-8'))
    except FileNotFoundError:
        continue
    meta = posts.get(key)
    if meta:
        print(f'{label:22} {len(comments.get(key) or []):>3} comments | gap {meta.get(\"coverage_gap\")}')
"
```

Reference points for that reel: 12 (gap −28) → 20 (gap −20) → 24 (gap −16).

- [ ] **Step 5: Check for duplicate inflation**

Recovered comments are new rows, which is exactly where an identity mistake
would show up as a fake improvement.

```bash
venv/bin/python -c "
import json, pathlib
from collections import Counter
run = sorted(pathlib.Path('data/runs').iterdir())[-1]
comments = json.load((run / 'comments.json').open(encoding='utf-8'))
bad = 0
for key, rows in comments.items():
    dupes = [k for k, n in Counter(
        (r.get('text'), r.get('author') or r.get('author_id')) for r in rows
    ).items() if n > 1]
    if dupes:
        bad += 1
        print(len(rows), 'rows |', len(dupes), 'DUPES |', key)
        for d in dupes[:5]:
            print('   ', d)
print('checked', len(comments), 'posts |', bad, 'with dupes')
"
```

Expected: `0 with dupes`.

**One expected-but-acceptable collapse to watch for.** Two emoji-only comments
by the *same* author on the *same* post now share `("❤️", "Name")` and will
merge into one row. That is a genuine under-count, and it is the reason the
`img[alt]` fallback is preferable to a generic `"[image]"` placeholder, which
would collapse *every* media comment by an author instead of only identical
ones. If the dupe check above reports collapses that matter, the fix is to give
`_comment_identity_key` a third component, which is a change to shared identity
logic and does NOT belong in this task.

- [ ] **Step 6: Confirm existing comments did not change value**

The strongest regression signal available: text of comments that existed before
must be byte-identical.

```bash
venv/bin/python -c "
import json, pathlib
old = json.load(open('data/runs/2026-08-17_174334/comments.json'))
run = sorted(pathlib.Path('data/runs').iterdir())[-1]
new = json.load((run / 'comments.json').open(encoding='utf-8'))
changed = 0
for key, rows in new.items():
    if key not in old:
        continue
    old_by = {(r.get('author'), r.get('time')): r.get('text') for r in old[key]}
    for r in rows:
        k = (r.get('author'), r.get('time'))
        if k in old_by and old_by[k] != r.get('text') and old_by[k]:
            changed += 1
            print('CHANGED', k, repr(old_by[k]), '->', repr(r.get('text')))
print('changed texts:', changed)
"
```

Expected: `changed texts: 0`. Anything else means the fallback fired on a
comment that already had text — go back to Task 1 Step 4.

- [ ] **Step 7: Commit any fixes found**

```bash
git add -A
git commit -m "Fix <specific issue found in live verification>."
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Emoji-as-image comments survive | 1 (fixture + test) |
| Sticker comments survive with their alt text | 1 |
| Avatar alt never becomes the text | 1 (guard + test) |
| Existing comment text is unchanged | 1 (test), 2 Step 6 |
| Measured drop rate falls | 2 Step 2 |
| No duplicate inflation | 2 Step 5 |

**Placeholder scan:** none. Every code step carries the code; every run step
carries the command and its expected output.

**Type consistency:** the JS still pushes `{ariaLabel, text, author_id}` with
`text` a string — the fallback only changes how that string is computed, so the
Python side (`_extract_from_dom`'s filter chain, `_finalize_scoped_comments`,
`merge_comment_lists`) needs no change and its existing tests must stay green
untouched.

**Known non-goal — alt-less media, measured at 1 of 3 dropped comments.** A
comment that is a bare `<img alt="">` photo or GIF has no text anywhere to
recover, and this plan leaves it dropped. The obvious move is a `"[image]"`
placeholder, and it is rejected deliberately: `_comment_identity_key` is
`(text, author_id or author)`, so every media comment by one author would
collapse to a single row — trading a visible under-count for an invisible one,
and moving `coverage_gap` toward zero while recovering nothing real. Fixing it
properly means extending the identity key (e.g. with the image src or the
comment's timestamp), which touches dedupe logic shared by the permalink merge
and the in-run accumulator, and deserves its own plan with its own evidence.

**Correction recorded:** the earlier note in
`2026-08-17-preserve-comments-across-expansion-rounds.md` (Task 9 Step 4c)
naming the missing-timestamp rule as "most consequential" is not supported by
measurement — it accounted for **zero** drops on the post examined here. The
empty-text guard accounted for all of them. Do not carry that guess forward.

# Anchor Caption Extraction Outside role="article" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `title` and `caption` non-empty again by anchoring caption and author extraction on the attributes Facebook actually marks the post body with, instead of on a `role="article"` ancestor that no longer contains it.

**Architecture:** Every caption path — the preview-node loop, the blockquote loop, and the `dir="auto"` fallback — is scoped to `primaryArticle`, a `role="article"` element. On current Facebook the post body is **not** inside any `role="article"`; only comments and replies are. So the scoping guarantees an empty result no matter which exclusion rules are tuned. The fix anchors on `[data-ad-rendering-role="story_message"]` / `[data-ad-comet-preview="message"]` within the feed *unit*, and identifies comments by their `aria-label` rather than by article containment.

**Tech Stack:** Python 3.14, Playwright 1.60 (async), pytest 9.1 + pytest-asyncio 1.4.

---

## Evidence this is real

**Production impact, from `data/runs/2026-08-17_174334` (72 posts):**

```
posts=72   non-empty title=0   non-empty caption=0
```

Meanwhile the same run populated `ui_count` on 31 rows and `post_date` on 35 —
so card building works; caption specifically does not. `CAPTION_DIR_AUTO_FALLBACK`
is currently `true` in `fb_scraper/feed_js.py:18`, so this is not the flag being
off.

**Running the real `TAG_AND_READ_JS` against the live profile:**

```
cards returned: 2
card 0: author='' uiCount=9 hasLeave=True   candidates (0): []   titleText: ""
card 1: author='' uiCount=2 hasLeave=True   candidates (0): []   titleText: ""
```

`uiCount` and `hasLeave` resolve; `captionCandidates` and `authorText` are
empty. Both of the latter are scoped to `primaryArticle`.

**Why they are empty — probing the DOM of a real post permalink.** Every
top-level `role="article"` on the page is a *comment*:

```
CARD 0  height=286  aria=''                                dir=auto: 0
CARD 1  height=286  aria=''                                dir=auto: 0
CARD 2  height=68   aria='Comment by Nyong An 8 weeks ago' dir=auto: 4
CARD 3  height=68   aria='Comment by Bắc Sea 8 weeks ago'  dir=auto: 4
```

The two article-shaped elements that are not comments carry **zero** `dir=auto`
nodes and no preview node — they are media containers, which is also why they
are rejected as `reason=not_feed_post`.

**And here is the caption, found by content rather than by selector:**

```
len=25  dir='auto'  inArticle=None
  ancestry: div|data-ad-comet-preview=message|data-ad-preview=message
            div|data-ad-rendering-role=story_message
  text: 'Chuẩn bị ra nhạc mới thui'
```

Three things follow, and each one matters:

1. **`data-ad-comet-preview="message"` still exists.** The selector was never
   the problem.
2. **`inArticle=None`** — the caption node has no `role="article"` ancestor at
   all. `pickCaptionCandidates` receives `primaryArticle` and every one of its
   loops either searches inside it or filters against it, so the node is
   unreachable by construction.
3. **A newer attribute set is present**: `data-ad-rendering-role` with values
   `story_message` (the post body), `title`, and `description`. This is the
   stable anchor to build on.

**This also corrects the diagnosis in commit `8dab5a9`.** That commit concluded
the `dir=auto` fallback "harvests comments instead of captions" and disabled it,
reasoning that `inCommentPreview` can never fire because comments are siblings
rather than descendants. The sibling observation was right. The conclusion drawn
from it was too narrow: the problem is not that comment *exclusion* fails, it is
that the post body is not in the article being searched, so the fallback had
nothing correct to find in the first place. Tuning exclusions could never have
fixed it.

---

## Global Constraints

- **TDD is mandatory.** Write the test, run it, watch it fail for the right
  reason, then write the minimal code.
- **`title` keeps its current meaning and derivation rules.**
  `is_qualified_inventory_card` reads `title` and `discover_inventory` counts
  that against `max_posts`; widening what counts as a title is what previously
  admitted a "Suggested for you" block as a post. `title` stays
  `truncate_title(caption)`; this plan changes only where the caption text is
  *found*.
- **Never take text from a comment.** The previous attempt shipped commenter
  names into the caption column. The guard here is `aria-label`-based
  (`/^(Comment|Reply|Bình luận|Phản hồi)\s+(by|của)\s+/i`), which is what the
  live DOM actually provides — not article containment, which does not
  discriminate.
- **Prefer empty over wrong.** A wrong caption lands in SQLite and is worse
  than a missing one. Every widening step in this plan is paired with a test
  that pins a specific thing it must *not* pick up.
- Run the whole suite before every commit: `venv/bin/python -m pytest -q`.
  Baseline entering this plan is **167 passed**.
- Commit after each task.

**Do not start Task 1 while a scrape is running**, and do not run diagnostics
against `cloak_profile/` while one is running either — see the session note in
Task 3.

```bash
ps aux | grep -E "scraper.py|chromium" | grep -v grep
```

## File map

| File | Responsibility |
|------|----------------|
| `fb_scraper/feed_js.py` | Anchor caption + author on `data-ad-rendering-role` / preview attrs; comment test by aria-label |
| `tests/fixtures/live_post_card.html` | Card markup matching the measured live shape (caption outside any article) |
| `test_dom_fixtures.py` | Offline tests driving the real JS against that fixture |

---

### Task 1: A fixture that matches the live DOM shape

The existing fixtures encode a shape Facebook no longer produces — caption
inside `role="article"`, comments nested within it. Tests against them pass
while production returns nothing, which is exactly how this bug survived.

**Files:**
- Create: `tests/fixtures/live_post_card.html`
- Modify: `test_dom_fixtures.py`

- [ ] **Step 1: Write the fixture from the measured shape**

Create `tests/fixtures/live_post_card.html`. Note what is deliberate: the
caption sits **outside** every `role="article"`, the comment is a **sibling**
carrying an `aria-label`, and the only article-shaped elements around the media
are empty.

```html
<!doctype html>
<meta charset="utf-8">
<div class="feed-unit">
  <div data-ad-rendering-role="story_message">
    <div data-ad-comet-preview="message" data-ad-preview="message">
      <div dir="auto">Chuẩn bị ra nhạc mới thui</div>
    </div>
  </div>
  <h2><a href="https://www.facebook.com/tieumyday">Tieu My</a></h2>
  <a aria-label="Friday 19 June 2026 at 21:21"
     href="https://www.facebook.com/tieumyday/posts/pfbid0Heg?__tn__=R-R">19 June</a>
  <div role="article" aria-label=""><video src="https://video.example/v.mp4"></video></div>
  <div role="article" aria-label="Comment by Nyong An 8 weeks ago">
    <div dir="auto">Nyong An</div>
    <div dir="auto">a comment that must never become the caption</div>
  </div>
  <div role="article" aria-label="Reply by Bắc Sea to Nyong An's comment 8 weeks ago">
    <div dir="auto">Bắc Sea</div>
    <div dir="auto">a reply that must never become the caption</div>
  </div>
  <div role="button" aria-label="Leave a comment">14</div>
</div>
```

- [ ] **Step 2: Write the failing tests**

Append to `test_dom_fixtures.py`:

```python
@pytest.mark.asyncio
async def test_live_shaped_card_finds_the_caption_outside_any_article():
    """The caption node has no role="article" ancestor on current Facebook.

    Measured: ancestry is
    div[data-ad-comet-preview=message] < div[data-ad-rendering-role=story_message]
    with inArticle=None. See
    docs/superpowers/plans/2026-08-17-anchor-caption-extraction-outside-role-article.md
    """
    html = (FIXTURES / "live_post_card.html").read_text(encoding="utf-8")
    cards = await _read_cards(html)

    assert len(cards) == 1, f"card not recognized at all: {cards}"
    joined = " ".join(cards[0]["captionCandidates"])
    assert "Chuẩn bị ra nhạc mới thui" in joined


@pytest.mark.asyncio
async def test_live_shaped_card_never_takes_a_comment_as_the_caption():
    """Comments are SIBLINGS here, so containment cannot exclude them.

    This is the shape that put commenter names in the caption column on
    2026-08-15; the guard must be the aria-label, not the article ancestor.
    """
    html = (FIXTURES / "live_post_card.html").read_text(encoding="utf-8")
    cards = await _read_cards(html)

    joined = " ".join(cards[0]["captionCandidates"])
    assert "must never become the caption" not in joined
    assert "Nyong An" not in joined
    assert "Bắc Sea" not in joined


@pytest.mark.asyncio
async def test_live_shaped_card_reads_the_author_from_the_heading_link():
    html = (FIXTURES / "live_post_card.html").read_text(encoding="utf-8")
    cards = await _read_cards(html)

    assert cards[0]["authorText"] == "Tieu My"
```

- [ ] **Step 3: Run them and watch them fail**

Run: `venv/bin/python -m pytest test_dom_fixtures.py -q -k live_shaped`

Expected: all three fail. The first two on an empty `captionCandidates`, the
third on `authorText == ''`. If instead the card itself is not recognized
(`len(cards) == 1` fails), the unit-resolution heuristic rejects this shape —
fix that first, and say so, because it means the live feed is being parsed by
luck rather than by design.

- [ ] **Step 4: Anchor the caption search on the story-message attributes**

In `fb_scraper/feed_js.py`, replace the body of `pickCaptionCandidates` so it
searches the **unit** for the post-body anchors and never requires an article
ancestor. Keep the existing `push` helper and its length bounds:

```javascript
const CAPTION_ANCHORS = [
    '[data-ad-rendering-role="story_message"]',
    '[data-ad-comet-preview="message"]',
    '[data-ad-preview="message"]',
];
// A comment is identified by its aria-label, NOT by article containment.
// On current Facebook the post body has no role="article" ancestor and
// comments are siblings, so containment cannot tell them apart.
const COMMENT_ARIA = /^(Comment|Reply|Bình luận|Phản hồi)\\s+(by|của)\\s+/i;
const inCommentByLabel = (node) => {
    const art = node.closest('[role="article"]');
    if (!art) return false;
    return COMMENT_ARIA.test(art.getAttribute('aria-label') || '');
};
```

and use them:

```javascript
const pickCaptionCandidates = (unit, primaryArticle) => {
    const out = [];
    const push = (t) => {
        const text = (t || '').replace(/\\s+/g, ' ').trim();
        if (text.length >= 2 && text.length <= 5000 && !out.includes(text)) out.push(text);
    };
    for (const sel of CAPTION_ANCHORS) {
        for (const node of unit.querySelectorAll(sel)) {
            if (inCommentByLabel(node)) continue;
            push(node.innerText);
        }
    }
    for (const bq of unit.querySelectorAll('blockquote')) {
        if (inCommentByLabel(bq)) continue;
        push(bq.innerText);
    }
    return out;
};
```

**The `dir="auto"` fallback stays disabled.** It is not needed once the anchors
work, and it is the path that previously harvested comment text. Leave
`CAPTION_DIR_AUTO_FALLBACK` alone in this task; Task 2 decides its fate with
measurements rather than assumption.

- [ ] **Step 5: Fix the author lookup the same way**

`pickAuthor` reads `h2 a, h3 a, strong a` from `primaryArticle`. The measured
card has its heading in the unit, not in the comment article that
`primaryArticle` resolves to — which is why `authorText` was `''`. Search the
unit, and reject a heading that belongs to a comment:

```javascript
const pickAuthor = (unit, primaryArticle) => {
    for (const sel of ['h2 a', 'h3 a', 'strong a', 'h2', 'h3']) {
        for (const node of unit.querySelectorAll(sel)) {
            if (inCommentByLabel(node)) continue;
            const t = (node.innerText || '').replace(/\\s+/g, ' ').trim();
            if (t) return t;
        }
    }
    return '';
};
```

Update its call site to pass `unit` first. Check every caller before editing:

```bash
grep -n "pickAuthor" fb_scraper/feed_js.py fb_scraper/*.py
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `venv/bin/python -m pytest test_dom_fixtures.py -q`
Expected: 3 more tests passing than before this task. **The pre-existing
fixture tests must also stay green** — if `post_text_card.html` or
`reel_card.html` now fails, the new anchors changed behavior on the old shape;
work out which shape is right before touching either.

- [ ] **Step 7: Run the whole suite**

Run: `venv/bin/python -m pytest -q`
Expected: `170 passed`.

- [ ] **Step 8: Commit**

```bash
git add fb_scraper/feed_js.py tests/fixtures/live_post_card.html test_dom_fixtures.py
git commit -F - <<'MSG'
Find the caption where Facebook actually puts it.

title and caption were empty for all 72 posts of data/runs/2026-08-17_174334
while ui_count and post_date populated normally, so card building worked and
caption specifically did not.

Cause: every caption path is scoped to primaryArticle, a role="article"
element. Probing a real post permalink shows the post body has NO
role="article" ancestor at all — on current Facebook that role is used for
comments and replies. The caption node's real ancestry is

  div[data-ad-comet-preview=message][data-ad-preview=message]
    < div[data-ad-rendering-role=story_message]

with inArticle=None. The selector was never wrong; the scope was. No amount
of exclusion tuning could have reached it.

This also corrects 8dab5a9, which concluded the dir=auto fallback "harvests
comments instead of captions" and disabled it. The sibling-comment
observation there was right, but the conclusion was too narrow: the post
body was not in the searched article, so the fallback had nothing correct to
find. Comments are now excluded by their aria-label, which is what the live
DOM provides, rather than by containment, which cannot discriminate when
they are siblings.

Adds a fixture matching the measured live shape — caption outside every
article, comments as labelled siblings, empty article-shaped media
containers — because the existing fixtures encode a shape Facebook no longer
produces, which is how this bug passed its tests while returning nothing.

Plan: docs/superpowers/plans/2026-08-17-anchor-caption-extraction-outside-role-article.md
MSG
```

---

### Task 2: Verify against the live profile

**Files:** none modified unless a failure is found.

- [ ] **Step 1: Confirm the suite is green and the session is alive**

```bash
venv/bin/python -m pytest -q
venv/bin/python /private/tmp/claude-501/-Users-minhlethanh/4579f567-929f-4476-a154-c1e08eaab83f/scratchpad/check_session.py
```

Expected: `170 passed` and `SESSION_VALID: True`. If the session is invalid,
log in first — do not start the run.

- [ ] **Step 2: Re-run the caption diagnostic before a full scrape**

```bash
venv/bin/python /private/tmp/claude-501/-Users-minhlethanh/4579f567-929f-4476-a154-c1e08eaab83f/scratchpad/diag_caption.py
```

Expected: `captionCandidates` non-empty for cards that have a story message,
and `authorText` no longer `''`. This costs 30 seconds and gates a 20-minute
run.

- [ ] **Step 3: Scrape and measure the fill rate**

```bash
venv/bin/python scraper.py https://www.facebook.com/tieumyday --cloak --headless --max-posts 20
```

Then:

```bash
venv/bin/python -c "
import json, pathlib
run = sorted(pathlib.Path('data/runs').iterdir())[-1]
posts = json.load((run / 'posts.json').open(encoding='utf-8'))
ok = [m for m in posts.values() if m.get('status') == 'ok']
cap = sum(1 for m in ok if (m.get('caption') or '').strip())
tit = sum(1 for m in ok if (m.get('title') or '').strip())
print(f'ok posts: {len(ok)} | with caption: {cap} | with title: {tit}')
for m in ok[:8]:
    print(f'  {m.get(\"content_type\"):>5} | {(m.get(\"caption\") or \"\")[:60]!r}')
"
```

Baseline to beat: **0 of 72**. Expect text posts to fill first; reels may still
be empty, and that is a separate question — record the split by `content_type`
rather than reporting one number.

- [ ] **Step 4: Read every caption produced, by eye**

This is the step that catches the failure mode this feature has already had
once. A wrong caption is worse than an empty one and no automated check will
tell you the difference.

```bash
venv/bin/python -c "
import json, pathlib
run = sorted(pathlib.Path('data/runs').iterdir())[-1]
posts = json.load((run / 'posts.json').open(encoding='utf-8'))
comments = json.load((run / 'comments.json').open(encoding='utf-8'))
for key, m in posts.items():
    cap = (m.get('caption') or '').strip()
    if not cap:
        continue
    texts = {(c.get('text') or '').strip() for c in comments.get(key) or []}
    authors = {(c.get('author') or '').strip() for c in comments.get(key) or []}
    flag = ''
    if cap in texts: flag = '  <<< IS A COMMENT'
    elif cap in authors: flag = '  <<< IS A COMMENTER NAME'
    print(f'{cap[:70]!r}{flag}')
"
```

Expected: no `<<<` lines. Any hit means the aria-label guard is not holding and
the change must be reverted, not patched — that was the 2026-08-15 outcome.

- [ ] **Step 5: Decide the `dir=auto` fallback on evidence**

If Step 3 shows reels still empty, check whether a reel's body carries any of
the three anchors before re-enabling `CAPTION_DIR_AUTO_FALLBACK`:

```bash
venv/bin/python /private/tmp/claude-501/-Users-minhlethanh/4579f567-929f-4476-a154-c1e08eaab83f/scratchpad/find_caption.py "<a reel permalink>"
```

Report what anchors the reel body has. **Do not re-enable the fallback on the
assumption that it is needed** — that flag is off because it previously wrote
commenter names into SQLite, and turning it back on without evidence repeats
the mistake this plan exists to correct.

- [ ] **Step 6: Commit any fixes found**

```bash
git add -A
git commit -m "Fix <specific issue found in live verification>."
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Caption found outside `role="article"` | 1 |
| Comments excluded by aria-label, not containment | 1 (test + guard) |
| Author read from the unit's heading | 1 Step 5 |
| Old fixtures still pass | 1 Step 6 |
| Live fill rate measured, split by content type | 2 Step 3 |
| Every caption eyeballed against comment text | 2 Step 4 |
| `dir=auto` fallback decided on evidence | 2 Step 5 |

**Placeholder scan:** none. The `<a reel permalink>` in Task 2 Step 5 is a value
the operator reads from Step 3's output, not undecided content.

**Type consistency:** `pickCaptionCandidates(unit, primaryArticle)` keeps its
signature; `pickAuthor` changes to `(unit, primaryArticle)` and Task 1 Step 5
requires auditing its callers before editing. `captionCandidates` stays
`list[str]` and `authorText` stays `str`, so `card_from_raw_item` and
`pick_caption_candidate` need no change and their tests must stay green.

**Known non-goal:** reels. If they carry no `story_message` anchor, giving them
captions needs a different source and its own evidence — bundling a guess for
them into this change is how the column filled with comment text last time.

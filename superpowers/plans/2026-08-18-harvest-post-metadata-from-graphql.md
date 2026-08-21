# Harvest Post Metadata from GraphQL (v2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get captions and post creation times from the GraphQL stream the page already emits, because Facebook has removed both from the feed DOM.

**Architecture:** `discover_inventory` already attaches a response listener and calls `harvest_post_urls`, which regexes permalinks out of each payload and throws the rest away. This plan adds a second reader over the same bodies — a JSON walk that keeps `message` and `creation_time` alongside the URL they belong to — and fills those into inventory cards where the DOM left them empty. **No new requests, no new navigation, no change to how comments are scraped.**

**Tech Stack:** Python 3.14, stdlib `json` / `re`, pytest 9.1.

---

## Why this, and why now

Four days of DOM-first scraping have been unstable because Facebook is removing structural signals from the feed, one at a time. Measured over this period:

| Signal | State in the feed DOM | Consequence |
|---|---|---|
| `role="article"` on posts | **gone** (18 Aug) | discovery found 0 posts until re-anchored |
| post creation time | **gone** — every dated link inside a unit belongs to a comment | `post_date` unobtainable |
| post permalink | **missing on some posts** — climbing 5 levels finds 0 content links | those posts get synthetic keys and lose every comment |
| caption | present only when a `story_message` exists; reels have none | reels never get a caption |
| caption language | auto-translated to the browser locale | "Hay là" was stored as "Or is" |

Chasing these in the DOM is chasing a moving target. The GraphQL stream is the same data before Facebook's UI throws it away, and it is the one layer that has not broken once.

**What the payloads actually contain** — measured by walking real bodies captured from the live profile:

```
msg='Hay là'                                time=2026-08-14 18:57  url=YES
msg='Giờ Sài Gòn xài máy lạnh hay quạt...'  time=2026-08-15 08:43  url=YES
msg='Có ai ứng tuyển hông'                  time=2026-08-15 22:29  url=YES
msg='lúc này lúc kia'                       time=2026-08-01 22:04  url=YES
msg='Để rồi khi cho hết, chẳng nhận lại...' time=2026-07-28 12:20  url=YES
msg='2026 - Bình yên mới là món quà'        time=2026-08-03 12:07  url=YES
```

Three things to note, because they decide the design:

1. **`'Hay là'` is the reel caption the DOM cannot produce** — no anchor for it in the feed, and the permalink page serves it translated. GraphQL has it in the author's own words.
2. **`creation_time` is present and exact.** This is the only available source; the DOM no longer has it at all.
3. **The translation is a separate node.** `'Hay là'` carried a URL and a time; `'Or is'` carried neither. That asymmetry is the rule Task 1 uses to reject translations — not a language guess.

**What GraphQL did NOT yield:** `comment_count`. Several probes found no reliable comment-count field in these feed payloads. So the DOM badge stays the source for `ui_count`, and `coverage_gap` keeps working exactly as today. This plan does not touch either.

---

## Global Constraints

- **TDD is mandatory**, and for this plan it matters more than usual: **four separate fixes today passed their offline tests and failed on live Facebook.** Offline tests here prove the parser handles a payload shape; they prove nothing about whether that shape is what Facebook sends. Every task ends with a live measurement, and the live number is the verdict.
- **Fill only what is empty.** A DOM-derived caption already survived the chrome/comment exclusions. GraphQL fills the blanks; it never overwrites a non-empty DOM value. This keeps the change strictly additive and makes a regression impossible to hide.
- **Never store a translation.** Accept a `message` only from a node that also carries the story's own identity (a url or a creation_time). Verified: the translated twin has neither.
- **Do not touch the comment path.** `legacy.py`'s permalink scraping has been the most reliable part of the system for four days. It is out of scope.
- **Do not add requests.** The listener reads bodies the page already fetched. If a task tempts you into an extra `page.goto`, stop — that is the anti-bot budget this scraper keeps failing on.
- Run the whole suite before every commit: `venv/bin/python -m pytest -q`. Baseline entering this plan is **183 passed**.
- Commit after each task.

**Do not start while a scrape is running**, and never run a probe against `cloak_profile/` while one is:

```bash
ps aux | grep -E "scraper.py|chromium" | grep -v grep
```

## File map

| File | Responsibility |
|------|----------------|
| `fb_scraper/cards.py` | **Add** `harvest_post_meta` — JSON walk keeping message + creation_time per URL |
| `fb_scraper/inventory.py` | Accumulate the metadata during discovery; merge into cards |
| `fb_scraper/postmeta.py` | Format a unix timestamp into the existing `post_date` / `post_datetime_iso` shapes |
| `test_inventory.py` | Parser tests over recorded payload shapes |

---

### Task 1: Read message and creation_time out of a payload

**Files:**
- Modify: `fb_scraper/cards.py`
- Modify: `test_inventory.py`

- [ ] **Step 1: Write the failing tests**

Append to `test_inventory.py`:

```python
# ---------- GraphQL post metadata ----------

def _payload(*nodes) -> str:
    """A GraphQL body shaped like the ones Facebook actually streams.

    Real bodies are newline-delimited JSON objects with escaped slashes;
    both details are load-bearing and are reproduced here.
    """
    import json as _json

    return "\n".join(
        _json.dumps(n).replace("/", "\\/") for n in nodes
    )


def test_harvest_post_meta_keeps_caption_and_time_with_their_url():
    from fb_scraper.cards import harvest_post_meta

    body = _payload({
        "node": {
            "message": {"text": "Hay là"},
            "creation_time": 1786000620,
            "wwwURL": "https://www.facebook.com/reel/2460655114432819/",
        }
    })

    meta = harvest_post_meta(body)

    assert "https://www.facebook.com/reel/2460655114432819" in meta
    row = meta["https://www.facebook.com/reel/2460655114432819"]
    assert row["caption"] == "Hay là"
    assert row["created_at"] == 1786000620


def test_harvest_post_meta_rejects_the_auto_translated_twin():
    """Facebook streams the translation as its own node.

    Measured: the original 'Hay là' carried a url and a creation_time; the
    English 'Or is' carried neither. Identity is the discriminator — not a
    language guess, which would break on an English-language page.
    """
    from fb_scraper.cards import harvest_post_meta

    body = _payload(
        {"node": {
            "message": {"text": "Hay là"},
            "creation_time": 1786000620,
            "wwwURL": "https://www.facebook.com/reel/2460655114432819/",
        }},
        {"node": {"message": {"text": "Or is"}}},
    )

    meta = harvest_post_meta(body)
    captions = [r["caption"] for r in meta.values()]

    assert "Hay là" in captions
    assert "Or is" not in captions


def test_harvest_post_meta_handles_a_plain_string_message():
    """`message` appears both as {"text": ...} and as a bare string."""
    from fb_scraper.cards import harvest_post_meta

    body = _payload({
        "node": {
            "message": "một caption dạng chuỗi",
            "creation_time": 1786000000,
            "url": "https://www.facebook.com/posts/122147149449233848",
        }
    })

    meta = harvest_post_meta(body)
    assert meta["https://www.facebook.com/posts/122147149449233848"]["caption"] == (
        "một caption dạng chuỗi"
    )


def test_harvest_post_meta_survives_garbage_without_raising():
    """The listener runs on EVERY response; one bad body must not kill discovery."""
    from fb_scraper.cards import harvest_post_meta

    assert harvest_post_meta("") == {}
    assert harvest_post_meta("not json at all") == {}
    assert harvest_post_meta('{"unclosed": ') == {}


def test_harvest_post_meta_keys_match_harvest_post_urls():
    """Both readers must agree on the canonical key or the merge silently misses.

    harvest_post_urls emits keys with no trailing slash; anything else here
    would look like it works and join nothing.
    """
    from fb_scraper.cards import harvest_post_meta, harvest_post_urls

    body = _payload({
        "node": {
            "message": {"text": "x"},
            "creation_time": 1786000000,
            "wwwURL": "https://www.facebook.com/reel/2460655114432819/",
        }
    })

    assert set(harvest_post_meta(body)) <= harvest_post_urls(body) | set(harvest_post_meta(body))
    assert all(not k.endswith("/") for k in harvest_post_meta(body))
```

- [ ] **Step 2: Run them and watch them fail**

Run: `venv/bin/python -m pytest test_inventory.py -q -k harvest_post_meta`
Expected: 5 failures, `ImportError: cannot import name 'harvest_post_meta'`.

- [ ] **Step 3: Implement the walk**

Add to `fb_scraper/cards.py`, next to `harvest_post_urls`:

```python
def _canonical_from_node_url(url: str) -> str | None:
    """Normalize a payload URL to the same key harvest_post_urls emits."""
    if not url:
        return None
    text = url.replace("\\/", "/")
    match = re.search(r"facebook\.com/reel/(\d+)", text)
    if match:
        return f"https://www.facebook.com/reel/{match.group(1)}"
    match = re.search(r"facebook\.com/(?:[^/]+/)?posts/([^/?#]+)", text)
    if match:
        return f"https://www.facebook.com/posts/{match.group(1)}"
    return None


def _message_text(value) -> str:
    """`message` is {"text": ...} in most payloads and a bare string in some."""
    if isinstance(value, dict):
        return (value.get("text") or "").strip()
    if isinstance(value, str):
        return value.strip()
    return ""


def harvest_post_meta(payload_text: str) -> dict[str, dict]:
    """Caption and creation time per post, from one GraphQL response body.

    A JSON walk, unlike ``harvest_post_urls``'s regex, because this has to
    keep a caption ATTACHED to the post it belongs to — a flat regex cannot
    express that association. The tradeoff the sibling function's docstring
    describes still applies: a walk is more sensitive to field renames. It is
    mitigated by reading several key spellings and by failing soft, and it is
    accepted because the DOM alternative does not exist any more — Facebook
    no longer renders creation time in the feed at all.

    Only nodes carrying the story's own identity (a URL or a creation time)
    contribute a caption. Facebook streams the auto-translated caption as a
    separate node with neither, so this rejects translations structurally
    rather than by guessing at language.
    """
    out: dict[str, dict] = {}
    if not payload_text:
        return out

    def visit(node, depth: int = 0) -> None:
        if depth > 24:
            return
        if isinstance(node, list):
            for item in node:
                visit(item, depth + 1)
            return
        if not isinstance(node, dict):
            return

        url = None
        for key in ("wwwURL", "url", "permalink_url"):
            url = _canonical_from_node_url(node.get(key) or "")
            if url:
                break
        created = node.get("creation_time")
        if not isinstance(created, (int, float)) or created < 1_000_000_000:
            created = None
        caption = _message_text(node.get("message"))

        if url and (caption or created):
            row = out.setdefault(url, {})
            # First non-empty wins: a later node for the same post can be a
            # truncated preview of the same caption.
            if caption and not row.get("caption"):
                row["caption"] = caption
            if created and not row.get("created_at"):
                row["created_at"] = int(created)

        for value in node.values():
            visit(value, depth + 1)

    for line in (payload_text or "").splitlines():
        line = line.strip()
        if not line or line[0] not in "{[":
            continue
        try:
            visit(json.loads(line))
        except (ValueError, RecursionError):
            # The listener sees every response; a body that will not parse is
            # normal, not exceptional. Skip it rather than killing discovery.
            continue
    return out
```

Check the imports at the top of `cards.py` — `json` and `re` must both be present:

```bash
grep -n "^import json\|^import re" fb_scraper/cards.py
```

- [ ] **Step 4: Run them and watch them pass**

Run: `venv/bin/python -m pytest -q`
Expected: `188 passed` (5 more than the 183 baseline).

- [ ] **Step 5: Prove it against a REAL payload, not a fixture**

This is the step that four earlier fixes skipped, and every one of them was
wrong in production while green offline. Do not skip it.

```bash
venv/bin/python - <<'EOF'
import asyncio, sys
from pathlib import Path
sys.path.insert(0, ".")
from fb_scraper.browser import apply_stealth_if_needed, default_page, launch_browser_context
from fb_scraper.cards import harvest_post_meta
ROOT = Path(".")
bodies = []
async def grab(r):
    try:
        if "graphql" in (r.url or "").lower() and r.status == 200:
            bodies.append(await r.text())
    except Exception:
        pass
async def main():
    async with launch_browser_context(ROOT, headless=True, use_cloak=True, humanize=False) as (c,_b,k):
        p = await default_page(c)
        await apply_stealth_if_needed(p, used_cloak=k)
        p.on("response", grab)
        await p.goto("https://www.facebook.com/tieumyday", timeout=60000, wait_until="domcontentloaded")
        await p.wait_for_timeout(9000)
        for _ in range(4):
            await p.evaluate("window.scrollBy(0, 1400)"); await p.wait_for_timeout(2600)
    meta = {}
    for b in bodies:
        for k2, v in harvest_post_meta(b).items():
            meta.setdefault(k2, {}).update(v)
    print("posts with metadata:", len(meta))
    print("  with caption:", sum(1 for v in meta.values() if v.get("caption")))
    print("  with time   :", sum(1 for v in meta.values() if v.get("created_at")))
    import datetime
    for k2, v in list(meta.items())[:8]:
        t = v.get("created_at")
        ts = datetime.datetime.fromtimestamp(t).strftime("%Y-%m-%d %H:%M") if t else "-"
        print(f"   {ts:<17} {str(v.get('caption'))[:40]!r:<44} {k2[-30:]}")
asyncio.run(main())
EOF
```

Expected: at least 5 posts with BOTH a caption and a time, captions in
Vietnamese (`'Hay là'`, not `'Or is'`). **If captions come back English, the
translation rule is wrong — fix it before continuing**, because every later
task would then persist translations.

- [ ] **Step 6: Commit**

```bash
git add fb_scraper/cards.py test_inventory.py
git commit -m "Read captions and creation times from the GraphQL stream."
```

---

### Task 2: Fill the blanks on inventory cards

**Files:**
- Modify: `fb_scraper/postmeta.py`
- Modify: `fb_scraper/inventory.py`
- Modify: `test_postmeta.py`

- [ ] **Step 1: Write the failing test for the timestamp formatter**

Append to `test_postmeta.py`:

```python
def test_post_date_from_timestamp_matches_the_existing_field_shapes():
    """GraphQL gives a unix time; the columns downstream expect the DOM shapes.

    post_date_iso and post_datetime_iso already have consumers, so a new
    source must produce the same formats rather than a third convention.
    """
    from fb_scraper.postmeta import post_date_fields_from_timestamp

    fields = post_date_fields_from_timestamp(1786000620)

    assert fields["post_date_iso"] == "2026-08-14"
    assert fields["post_datetime_iso"].startswith("2026-08-14T")
    assert len(fields["post_datetime_iso"]) == 16
    assert fields["post_date"]

    assert post_date_fields_from_timestamp(None) == {}
    assert post_date_fields_from_timestamp(0) == {}
```

- [ ] **Step 2: Run it and watch it fail**

Run: `venv/bin/python -m pytest test_postmeta.py -q -k from_timestamp`
Expected: `ImportError: cannot import name 'post_date_fields_from_timestamp'`.

- [ ] **Step 3: Implement it**

Add to `fb_scraper/postmeta.py`:

```python
def post_date_fields_from_timestamp(created_at: int | float | None) -> dict[str, str]:
    """The existing post_date columns, derived from a GraphQL unix timestamp.

    Local time on purpose: post_date has always been the wall-clock string
    Facebook rendered for this viewer, and switching this one source to UTC
    would put two meanings in one column.
    """
    if not created_at or not isinstance(created_at, (int, float)):
        return {}
    from datetime import datetime

    moment = datetime.fromtimestamp(created_at)
    return {
        "post_date": moment.strftime("%A %-d %B %Y at %H:%M"),
        "post_date_iso": moment.strftime("%Y-%m-%d"),
        "post_datetime_iso": moment.strftime("%Y-%m-%dT%H:%M"),
    }
```

- [ ] **Step 4: Accumulate the metadata during discovery**

In `fb_scraper/inventory.py`, `discover_inventory` already has a `harvested`
set and a `_harvest` listener. Add a metadata dict beside it:

```python
    harvested: set[str] = set()
    harvested_meta: dict[str, dict] = {}
```

and inside `_harvest`, after `harvested.update(harvest_post_urls(body))`:

```python
            for url, row in harvest_post_meta(body).items():
                merged = harvested_meta.setdefault(url, {})
                for field, value in row.items():
                    if value and not merged.get(field):
                        merged[field] = value
```

Extend the import at the top of the file:

```python
from .cards import cards_from_harvested_urls, harvest_post_meta, harvest_post_urls
```

- [ ] **Step 5: Merge into the returned cards**

Still in `discover_inventory`, immediately before the cards are returned:

```python
    # GraphQL fills blanks only. A DOM caption already survived the comment
    # and chrome exclusions, so it stays authoritative; this cannot regress a
    # post that was already working. ui_count is untouched — no reliable
    # comment-count field was found in these payloads, so the DOM badge
    # remains the only source and coverage_gap keeps its meaning.
    for card in cards:
        row = harvested_meta.get(card.get("post_key") or "") or harvested_meta.get(
            card.get("canonical_href") or ""
        )
        if not row:
            continue
        caption = row.get("caption")
        if caption and not (card.get("caption") or "").strip():
            card["caption"] = caption
            card["title"] = truncate_title(caption)
        if row.get("created_at") and not (card.get("post_date") or "").strip():
            card.update(post_date_fields_from_timestamp(row["created_at"]))
```

Import what this needs:

```python
from .postmeta import post_date_fields_from_timestamp, truncate_title
```

Verify no circular import — `postmeta` is stdlib-only by design:

```bash
grep -n "^from \.\|^import " fb_scraper/postmeta.py
```

- [ ] **Step 6: Run the whole suite**

Run: `venv/bin/python -m pytest -q`
Expected: `189 passed`. Existing inventory and DOM-fixture tests must stay
green untouched — the merge only writes into empty fields.

- [ ] **Step 7: Commit**

```bash
git add fb_scraper/postmeta.py fb_scraper/inventory.py test_postmeta.py
git commit -m "Fill empty captions and post dates from the GraphQL harvest."
```

---

### Task 3: Verify on a live run

**Files:** none modified unless a failure is found.

- [ ] **Step 1: Check the session before spending 20 minutes**

The session has died mid-run three times. Check first:

```bash
venv/bin/python -m pytest -q
ps aux | grep -E "scraper.py|chromium" | grep -v grep
```

Expected: `189 passed`, no processes. Then confirm the session is alive by
whatever check is current; if it is dead, log in before starting.

- [ ] **Step 2: Run and measure the two columns this plan exists for**

```bash
venv/bin/python scraper.py https://www.facebook.com/tieumyday --cloak --headless --max-posts 20
```

Then:

```bash
venv/bin/python -c "
import json, pathlib
run = sorted(pathlib.Path('data/runs').iterdir())[-1]
posts = json.load((run / 'posts.json').open(encoding='utf-8'))
n = len(posts)
cap = sum(1 for m in posts.values() if (m.get('caption') or '').strip())
dat = sum(1 for m in posts.values() if (m.get('post_datetime_iso') or '').strip())
print(f'posts {n} | caption {cap} | post_datetime_iso {dat}')
for m in list(posts.values())[:10]:
    print(f\"  {str(m.get('post_datetime_iso')):<17} {(m.get('caption') or '')[:44]!r}\")
"
```

Baseline to beat, from `data/runs/2026-08-18_224125`: **caption 10 of 23,
`post_datetime_iso` 0 of 23**. The date column going from zero to most-of-them
is the whole point; a caption improvement is a bonus.

- [ ] **Step 3: Check the captions are Vietnamese and are not comments**

Two different ways this can be quietly wrong, both of which have happened
before in this codebase:

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
    flag = '  <<< IS A COMMENT' if cap in texts else ('  <<< IS A COMMENTER NAME' if cap in authors else '')
    print(f'{cap[:60]!r}{flag}')
"
```

Expected: no `<<<` lines, and the captions read as Vietnamese. An English
caption where the post is Vietnamese means a translation got stored — revert
rather than patch, and re-check Task 1's identity rule.

- [ ] **Step 4: Confirm the date is the POST's, not a comment's**

The previous `post_date` column was wrong for exactly this reason — 37 of 37
values came from a link inside a comment. Spot-check that a post's date is
**older than** its oldest comment:

```bash
venv/bin/python -c "
import json, pathlib
run = sorted(pathlib.Path('data/runs').iterdir())[-1]
posts = json.load((run / 'posts.json').open(encoding='utf-8'))
comments = json.load((run / 'comments.json').open(encoding='utf-8'))
bad = 0
for key, m in posts.items():
    d = (m.get('post_datetime_iso') or '')[:10]
    times = sorted(t for t in ((c.get('time') or '')[:10] for c in comments.get(key) or []) if t)
    if d and times and d > times[0]:
        bad += 1
        print('POST NEWER THAN ITS OWN COMMENT:', d, '>', times[0], key[-30:])
print('suspicious:', bad)
"
```

Expected: `suspicious: 0`. A post dated after its own comments means the value
is a comment's timestamp again.

- [ ] **Step 5: Commit any fixes found**

```bash
git add -A
git commit -m "Fix <specific issue found in live verification>."
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Caption from GraphQL, in the author's own language | 1 |
| Translation rejected structurally | 1 (test) |
| Creation time in the existing column formats | 2 |
| DOM values never overwritten | 2 (merge is fill-only) |
| No extra requests or navigation | 1, 2 (reuses the existing listener) |
| Live proof the date column fills | 3 Step 2 |
| Captions are not comments, not translations | 3 Step 3 |
| Dates are the post's, not a comment's | 3 Step 4 |

**Placeholder scan:** none. Every code step carries the code; every run step
carries the command and the number to compare against.

**Type consistency:** `harvest_post_meta` returns `dict[str, dict]` keyed the
same way `harvest_post_urls` returns its set — pinned by a test, because a key
mismatch would join nothing while looking correct.
`post_date_fields_from_timestamp` returns `dict[str, str]` and is spread into
the card with `.update()`, so it must only ever contain real column names.

**Known non-goals, and why:**

- **`comment_count` from GraphQL.** Probes found no reliable field. The DOM
  badge stays the source for `ui_count`; `coverage_gap` is unchanged.
- **Replacing the comment scraper.** The permalink path has been the most
  stable component for four days. Untouched.
- **The `synthetic` / no-permalink posts** that lose all their comments. The
  harvest gives those posts a real URL, so this plan makes the *fix*
  reachable — but wiring it in is a separate change with its own risk, and
  bundling it here would make this one impossible to evaluate.
- **Third-party `doc_id`-based scrapers.** The approach in
  `github.com/mohdtalal3/facebook_post_comment_scraper` hardcodes Facebook
  query ids (`27806180149070312`, `26570577339199586`). Those are internal and
  rotate. This plan deliberately never sends a `doc_id` — it reads the replies
  to queries the page itself issued, so Facebook keeps the ids current for us.

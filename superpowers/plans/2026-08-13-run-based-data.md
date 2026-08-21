# Run-based data management (A + C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Archive legacy scrape files and persist each new scrape into run folders + by-date splits + SQLite for user-id queries.

**Architecture:** Add `fb_scraper/storage.py` (run dirs, by-date files, SQLite) and wire `ProgressMixin` / `scraper.py` / CLI to write there. Timeline discovery already lives in `timeline.py`; keep caption/date DOM rules from the design.

**Tech Stack:** Python 3, Playwright, stdlib `sqlite3`, JSON/CSV

## Global Constraints

- No merge of legacy `comments.json` into new runs
- Keep `cookies.json` and `chrome_profile/`
- Archive root-level scrape artifacts once into `data/archive/legacy-YYYY-MM-DD/`
- New scrape without `--resume` always creates a new `data/runs/YYYY-MM-DD_HHMMSS/`

---

## File map

| File | Responsibility |
|------|----------------|
| `fb_scraper/storage.py` | Run paths, archive helper, save posts/comments/by_date, SQLite |
| `fb_scraper/progress.py` | Delegate load/save to active run storage |
| `fb_scraper/scraper.py` | Create/resume run; pass storage into pipeline |
| `fb_scraper/timeline.py` | On save, include post title/date; write via storage |
| `scraper.py` | CLI `--resume`, default profile URL |
| `fb_scraper/query.py` | Optional CLI: comments by `author_id` |
| `test_scraper.py` | Tests for storage paths, by_date bucket, SQLite user upsert |
| `docs/superpowers/specs/2026-08-13-run-based-data-design.md` | Spec (done) |

---

### Task 1: Storage module + unit tests

**Files:**
- Create: `fb_scraper/storage.py`
- Modify: `test_scraper.py`

- [ ] Write failing tests for: `new_run_id()`, `archive_legacy()`, `by_date` bucket (`unknown` if no iso), SQLite upsert user/comment
- [ ] Implement `RunStorage` class: create run dir, save/load posts & comments, write by_date, sorted CSV, progress, run_meta, SQLite
- [ ] Run `pytest test_scraper.py -q` — pass

### Task 2: Wire scraper + CLI

**Files:**
- Modify: `fb_scraper/progress.py`, `fb_scraper/scraper.py`, `fb_scraper/timeline.py`, `scraper.py`

- [ ] On scrape start: archive legacy if needed; create or resume run; set output paths under run
- [ ] Timeline save: store post metadata (title, post_date, post_date_iso) + comments; update SQLite
- [ ] CLI: `--resume RUN_ID`; print run path on start
- [ ] Run pytest

### Task 3: Archive once + query helper

**Files:**
- Create: `fb_scraper/query.py`
- Modify: `.gitignore` (ignore `data/runs/`, `data/db/`, keep archive optional)

- [ ] Implement archive move of known root artifacts
- [ ] `python -m fb_scraper.query --author-id ...` lists comments from SQLite
- [ ] Run archive dry once (or on first scrape)
- [ ] Smoke: create empty run folder + write sample → verify files/SQL

### Task 4: Verify

- [ ] `pytest` all green
- [ ] Confirm no regression: timeline discover still returns keys; caption not from comment preview

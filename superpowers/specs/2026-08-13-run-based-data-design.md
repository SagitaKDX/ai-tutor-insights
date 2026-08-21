# Run-based data management (A + C) — Design

**Date:** 2026-08-13  
**Status:** Approved by user (folder A + SQLite C for user-id tracking)

## Goal

Restart scraping from a clean slate (no merge with legacy `comments.json`), organize every scrape attempt by run timestamp, split artifacts by post date, and store a queryable SQLite DB for tracking comments by `author_id`.

## Decisions

| Decision | Choice |
|----------|--------|
| Layout | A: `data/runs/YYYY-MM-DD_HHMMSS/` + `by_date/YYYY-MM-DD/` |
| Query store | C: `data/db/scraper.sqlite` |
| Legacy data | Archive to `data/archive/legacy-YYYY-MM-DD/` |
| Keep session | `cookies.json`, `chrome_profile/` unchanged |
| Per-run outputs | Full: posts metadata, comments, sorted CSV, progress, log |
| Merge legacy into new runs | **No** |

## Folder layout

```
data/
  archive/legacy-YYYY-MM-DD/
    comments.json
    comments_sorted.csv
    scrape_progress.json
    crawl_*.csv
    comments.backup-*.json
    post_title_date_*.csv
  runs/
    YYYY-MM-DD_HHMMSS/
      run_meta.json
      posts.json
      comments.json
      comments_sorted.csv
      progress.json
      scrape.log
      by_date/
        YYYY-MM-DD/
          posts.json
          comments.json
          comments.csv
  db/
    scraper.sqlite
```

## Schemas

### `run_meta.json`

```json
{
  "run_id": "2026-08-13_111600",
  "profile_url": "https://www.facebook.com/tieumyday",
  "started_at": "2026-08-13T11:16:00+07:00",
  "ended_at": null,
  "status": "running",
  "posts_found": 0,
  "posts_scraped": 0,
  "comments_saved": 0
}
```

### Post record (`posts.json` / SQLite `posts`)

- `post_key` (stable URL key)
- `content_type` (`post` | `reel` | `photo` | `video`)
- `title` (caption from DOM; empty if unavailable — never comment preview text)
- `post_date` (permalink aria-label / parsed ISO date when possible)
- `post_date_iso` (`YYYY-MM-DD` or null if unknown → bucket `unknown`)
- `href`
- `scraped_at`

### Comment record

- `post_key`, `author`, `author_id`, `text`, `time`, `content_type`, `post_url`

### SQLite tables

- `runs(run_id PK, profile_url, started_at, ended_at, status, posts_found, posts_scraped, comments_saved)`
- `posts(run_id, post_key, content_type, title, post_date, post_date_iso, href, scraped_at, PRIMARY KEY(run_id, post_key))`
- `comments(id INTEGER PK, run_id, post_key, author, author_id, text, time, content_type)`
- `users(author_id PK, author_name, last_seen_at, comment_count)`

Indexes: `comments(author_id)`, `comments(post_key)`, `posts(post_date_iso)`.

## Scrape pipeline (fresh run)

1. On first use of new layout: move root-level scrape artifacts into `data/archive/legacy-...` (once).
2. Create `data/runs/<run_id>/` + open/create SQLite.
3. Timeline discovery: feed-unit DOM; caption via `[data-ad-comet-preview="message"]`; date via post timestamp permalink; ignore nested comment `role=article`.
4. For each pending post: open Leave a comment → All comments → expand → extract → save.
5. After each post save: update `comments.json`, `posts.json`, `by_date/<iso>/`, `progress.json`, SQLite upserts.
6. End run: write `comments_sorted.csv`, finalize `run_meta.json`.

## Resume

- Resume only within the **same** `run_id` via that run’s `progress.json`.
- New CLI invocation without `--resume` creates a **new** run folder (fresh attempt).
- `--resume <run_id>` continues that folder.

## CLI (target)

```bash
# new run
python scraper.py https://www.facebook.com/tieumyday

# resume
python scraper.py --resume 2026-08-13_111600 https://www.facebook.com/tieumyday

# optional helper
python -m fb_scraper.query --author-id 61557678575390
```

## Out of scope

- Merging legacy comments into SQLite/runs
- Scraping via `/reel/` player URLs as primary path
- Deleting `cookies.json` / `chrome_profile`

## Self-review

- No TBD placeholders.
- Consistent: no merge + archive + new runs + SQLite user tracking.
- Scope is one subsystem: data layout + scrape persistence wiring.

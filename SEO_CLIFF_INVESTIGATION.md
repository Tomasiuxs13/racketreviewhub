# SEO Ranking Cliff Investigation

Two distinct collapses appear in the GSC export through 2026-05-15:

## Cliff 1 — 2025-12-16

| Date | Clicks | Impr | Position |
|---|---|---|---|
| 2025-12-15 | 11 | 489 | 11.9 |
| 2025-12-16 | 0 | 19 | 27.4 |
| 2025-12-17 | 0 | 2 | 85.5 |
| 2025-12-18 | 0 | 6 | 85.3 |

Position cratered from ~12 to ~85 overnight. Impressions collapsed by ~95%.

### Likely cause: post-migration crawl penalty

The site migrated infrastructure on **2025-12-02** (commit `a88b0f6` — "Migrate from Supabase to Render Postgres with JWT auth"). The two-week lag to the GSC cliff matches Google's typical recrawl + reindex cycle.

A platform migration can drop rankings if any of the following slipped briefly:
- Response times degraded → fewer pages crawled per session.
- Different IP / hosting region → trust signals reset.
- Robots.txt or sitemap temporarily inaccessible.
- 5xx error rate spiked during cutover.
- Canonical URLs flipped (e.g. database lookups returned different slugs).

### What to verify in GSC

1. **Crawl stats report** (Settings → Crawl stats) — look at Dec 1–20:
   - Did total crawl requests drop?
   - Did `Server response (5xx)` spike?
   - Did average response time jump?
2. **Page indexing report** — check for surge in:
   - "Crawled — currently not indexed"
   - "Server error (5xx)"
   - "Discovered — currently not indexed"
3. **URL Inspection** on a high-traffic URL that fell (e.g. `https://racketreviewhub.com/brands/siux`) — note the **last crawled** date. If Google's last successful crawl was pre-Dec 2, that's the signal.

## Cliff 2 — 2026-02-07 to 2026-02-09

| Date | Clicks | Impr | Position |
|---|---|---|---|
| 2026-02-06 | 7 | 250 | 12.5 |
| 2026-02-07 | 2 | 284 | 20.4 |
| 2026-02-08 | 0 | 3 | 7.0 |
| 2026-02-09 | 3 | 12 | 8.8 |

Position stayed reasonable (8–20) but impressions dropped from 250+/day to single digits — i.e. **deindexation**, not a rankings demotion.

### Likely cause: external (Google algorithm) or sitewide signal change

No deployments occurred between **2026-01-25 and 2026-02-12**. The cliff is not correlated with any code change. Two possibilities:

1. **Google algorithm update** (most likely). Google ran a core update / helpful content / spam update in this window. The mass-deindex shape is consistent with a sitewide quality signal flip, not a technical break.
2. **Sitewide signal change** picked up by Google (e.g. site quality drop because too many thin/templated pages, or a crawler honoring a different version of robots.txt/canonical/hreflang).

### What to verify

1. **GSC → Manual actions / Security issues** — confirm neither is present.
2. **Cross-reference against [Google's status update history](https://status.search.google.com/products/rGHU1u87FJnkP6W2GwMi/history)** for ranking updates that finished around Feb 7–9, 2026.
3. **Index Coverage** report — total indexed pages on Feb 5 vs Feb 10. If the count dropped by >30%, you were deindexed (algorithmic) not demoted.
4. **Compare query-level data**: did you lose specific *types* of queries (e.g. brand head terms but not product long-tail)? That would point to which signal was downgraded.

## Recovery signal

From late March onward, impressions are slowly climbing again (10–100/day). This is consistent with Google re-evaluating after the cliffs, but the site is still operating at ~10% of its November peak. The fixes shipped in this PR (slug canonicalization, HTTPS forcing, schema upgrades, brand-page FAQ markup) should accelerate recovery if the underlying signal issue was technical hygiene — but if Cliff 2 is algorithmic, the recovery path is content-quality work, not technical fixes.

## Action items

- [ ] Pull Crawl Stats and Index Coverage for Dec 10–20 and Feb 5–12 from GSC and attach to this doc.
- [ ] URL-inspect 5 representative pages (brand hub, product detail, guide, /en, /es) and confirm canonical + last-crawled dates.
- [ ] Submit refreshed sitemap after this PR deploys so the redirect map gets picked up quickly.
- [ ] If Cliff 2 is confirmed algorithmic: prioritize editorial depth on brand pages (the templated fallback is the largest quality liability).

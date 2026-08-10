# Feasibility

An adversarial design review turned up 14 failure modes (synthetic-event
trust, Shadow DOM, cross-origin iframes, selector drift, missing elements,
ambiguous matches, site shortcut conflicts, SPA routing, recording
granularity, sync races, quota, key collisions, privacy leakage, recording
edge cases). Realism check below, reframed against the actual target set
(dashboards/SaaS/dev tools a user would bind keys on) rather than the whole
web — those are very different denominators.

| Issue | Real frequency for this use case | Verdict |
|---|---|---|
| SPA client-side routing | Near-universal in this target set | Must-fix — handled via `pathPrefix` + fresh `location.pathname` checks per fire, no reliance on `popstate`. |
| Global-element vs. per-item targeting | The motivating example ("analytics/abcdef") is inherently a specific item, not fixed chrome | Biggest real limiter. **Scoped out of v1** — see `docs/design.md`. |
| Shadow DOM | ~2.5% of pages web-wide ([2024 HTTP Archive Web Almanac](https://almanac.httparchive.org/en/2024/javascript)); likely higher for specific widgets in this target set, but most React/Vue dashboards render to light DOM | Occasional individual control unbindable, not whole-site failure. |
| Cross-origin iframes | Rare for primary dashboard/mail/dev-tool actions (usually single-document) | Low impact for this use case. |
| `isTrusted`/bot detection | Concentrated on login/checkout/ticketing per available research, not routine in-app navigation | Low impact for this use case. |
| Site shortcut conflicts | Would be common with bare-key bindings | Resolved structurally by the leader-key chord. |
| Selector drift, recording granularity, multi-match, sync races, quota, privacy | Real but bounded/occasional | Mitigated: fingerprint check, walk-to-interactive-ancestor, local-only storage remains an option if quota becomes real. |

**Verdict:** feasible and low-risk for fixed site-wide chrome actions,
which is what v1 targets. Contextual per-item actions are deferred, not
solved — revisit before claiming broader coverage.

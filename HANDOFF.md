# Handoff

The current state of Quantum Horizon and what is left. Read `CLAUDE.md` first for the project's rules.

## Where it stands, 15 November

Built, tested, deployed and measuring real data. 27 backend tests pass; the frontend builds and lints clean.

| | |
|---|---|
| Live tool | <https://quantum-horizon-web.vercel.app> |
| Live API | <https://quantum-horizon-api.vercel.app/api/health> |
| Hosting | Vercel Hobby for both halves, free, no card |

Results on real SPHEREx data, unchanged since they were first measured:

| Target | Detector | Frames | Passes | Measured | Catalog | Label |
|---|---|---|---|---|---|---|
| Barnard's Star | D2 | 61 | 3 | 9.71 ± 1.57″ | 10.28″ | measured, 6.2σ |
| Barnard's Star | D1 | 60 | 3 | 10.31 ± 1.08″ | 10.08″ | measured, 9.5σ |
| Epsilon Indi B | D5 | 84 | 5 | 6.57 ± 0.62″ | 6.69″ | measured, 10.7σ |
| WISE 0855 | D6 | 45 | 3 | 11.27 ± 2.97″ | 7.97″ | marginal |
| RW Aurigae | D1 | 56 | 3 | 0.36 ± 0.62″ | 0.02″ | below the noise |
| R Draconis | D1 | 53 | 7 | 6.50 ± 8.95″ | 0.03″ | marginal |

The featured targets keep 120 frames per view on every host, so these numbers do not move. Only new positions are
capped lower on Vercel.

## Three repositories

- `quantum-horizon` — the project. All work happens here, and it is the link judges get.
- `quantum-horizon-web` — the frontend, which Vercel builds. Its README is its own; keep it when merging.
- `quantum-horizon-api` — `backend/` as a root, which Vercel runs. Same history.

To bring a change across, from the monorepo:

```
git branch -D backend-only
git subtree split --prefix=backend -b backend-only
```

then in `quantum-horizon-api`: `git pull --no-rebase --no-edit ../quantum-horizon backend-only`, and in
`quantum-horizon-web`: `git pull --no-rebase --no-edit ../quantum-horizon main`, deleting any `backend/` files the
merge brings in and keeping the web README. Push all three.

Simpler after the deadline: point both Vercel projects at this repository with a Root Directory (`./` for the web,
`backend` for the API), then archive the two mirrors.

## Before submitting

1. Upload the 30-second demo video and put its link in the README and the submission form.
2. Share the slide deck from its Share menu, put the team name on its cover, and link it.
3. Make `quantum-horizon` public. If the README links the two mirrors, keep them public too.
4. Paste the fields from `docs/submission.md`, including the "Use of Artificial Intelligence" statement, which covers
   the AI voice-over and the AI-built deck.
5. Submit for Judging before 23:59 local on 15 November. Submission is final.

## Known limits

- IRSA's TAP and SIA services were both down for much of 15 November. New positions cannot be looked up while that
  lasts; the five featured targets, and anything already cached, keep working. The page says so in plain words.
- On Vercel a first look at a new position takes one to three minutes, because a Hobby function has one shared CPU.
  It is retried once automatically if it outlasts the 300 s limit, and is instant afterwards on the same instance.
- The mover search has only been run on the small fields around the five targets.

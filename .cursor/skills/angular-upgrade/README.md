# Angular upgrade skill

Generic, resumable Angular major-upgrade workflow for **any** repository.

| Audience | Start here |
|----------|------------|
| Agent | [`SKILL.md`](./SKILL.md) |
| Human | This file + [`upgrade-history.md`](./upgrade-history.md) |

## Port to another repo

Copy `.cursor/skills/angular-upgrade/`, then edit only:

- [`repo.config.sh`](./repo.config.sh) — install, build, test commands; optional `POST_BUILD_VERIFY_SCRIPT`
- [`wavemaker-patterns.md`](./wavemaker-patterns.md) — greps, dependency notes, preview checklist (`PATTERNS_FILE`)

Use [`repo.config.example.sh`](./repo.config.example.sh) as a starting point.

Each script under `scripts/` resolves the repo root and sources `repo.config.sh` inline (no shared `common.sh`).

## Commands (this repo)

Configured in `repo.config.sh`:

| Step | Script |
|------|--------|
| Install | `sh .cursor/skills/angular-upgrade/scripts/install.sh` |
| Security | `sh .cursor/skills/angular-upgrade/scripts/audit.sh` (audit → fix → audit) |
| Build | `sh .cursor/skills/angular-upgrade/scripts/build.sh -f` |
| Tests (**required**) | `sh .cursor/skills/angular-upgrade/scripts/test.sh` |

## Steps

| # | Gate |
|---|------|
| 0 | Target major, preview URL or build-only |
| 1–4 | Inventory → plan → edit packages → install |
| 5 | Security audit |
| 6 | Patterns file review (`wavemaker-patterns.md`) |
| 7 | Build (+ optional post-build verify) |
| 8 | Preview URL |
| 9 | **Unit tests (mandatory)** |
| 10 | Finalize + `upgrade-history.md` + **`docs/{major}-upgrade.md`** |

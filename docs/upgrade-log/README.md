# Upgrade pattern diff logs

One file per Angular upgrade run: `{base}-to-{target}.md` (e.g. `20-to-21.md`).

Written by the `angular-upgrade` skill (`.claude/skills/angular-upgrade/`) whenever a run
edits an *existing* `§N` row or section in `patterns/runtime.md`, `patterns/codegen.md`, or
`checklist.md`'s Section Version History table. Those files only ever hold the current
understanding — each run's edits overwrite the last. This directory is where the prior
values survive.

Not to be confused with `docs/{major}-upgrade.md`, the narrative summary of what an upgrade
run did (package versions, checks passed, known gaps) — that file describes the upgrade;
these files describe how the shared pattern knowledge itself changed.

Skeleton: `.claude/skills/angular-upgrade/templates.md` → "Pattern diff log skeleton".

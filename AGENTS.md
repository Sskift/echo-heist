# ECHO HEIST contributor notes

- Work directly on `main` as authorized by the project owner. Normal commits and pushes are authorized; do not force-push or delete unrelated work.
- Use `docs/next-steps.md` as the current development plan and `docs/production-status.md` for completed work. The latest user feedback prioritizes art. Keep v0.22's tailored characters, lighting and chapter-specific architecture, plus v0.23's museum return and room journeys. v0.24 implements six postgame contracts across three families, with separate saves/plans, real echo budgets and independently tracked best time/fewest echoes. v0.24 is published and the current production plan has passed its completion audit. Maintain these delivered features; further scope comes from the owner’s next request. Preserve the C3-6 retained teammate, C4-6 credential handoff and both endings. Do not revive retired scope or playtime budgets.
- Keep gameplay deterministic at a fixed 60 Hz. The engine must remain usable without a browser.
- Preserve exact-position replay, end-pose holding, maximum three echoes, and explicit handling of full slots.
- Keep one playable route per training level and validate main-story routes with `npm run check:content`. Do not duplicate chapter walkthroughs across unit and browser tests.
- Visual and audio assets may combine code-generated work with free third-party assets, as authorized by the owner. Record source, author, license and modifications for every imported asset. Preserve offline operation without external runtime requests.
- Use Chinese for player-facing copy, with brief English technical/atmospheric labels where appropriate.
- Run `npm test` and `npm run build` for gameplay changes; inspect the browser for UI changes.
- Do not add unrelated features or use subagents without explicit authorization.
- v0.25 visual polish is delivered: material separation/reflections, fine floor patterns, lamps/counters, garment finishing and edge camera composition. Representative scenes, mobile readability, repeated loading and final offline output are verified; preserve these details in future changes. The v0.24 feature plan stays complete.

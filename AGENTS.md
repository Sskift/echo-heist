# ECHO HEIST contributor notes

- Work directly on `main` as authorized by the project owner. Normal commits and pushes are authorized; do not force-push or delete unrelated work.
- Use `docs/next-steps.md` as the current development plan and `docs/production-status.md` for completed work. The eight chapters now have a real 3D / 2.5D art baseline; retain it while developing evidence-based mission preparation and the remaining continuity work. Preserve the completed C3-6 retained teammate and C4-6 credential handoff. Do not revive retired scope or playtime budgets.
- Keep gameplay deterministic at a fixed 60 Hz. The engine must remain usable without a browser.
- Preserve exact-position replay, end-pose holding, maximum three echoes, and explicit handling of full slots.
- Keep one playable route per training level and validate main-story routes with `npm run check:content`. Do not duplicate chapter walkthroughs across unit and browser tests.
- Visual and audio assets may combine code-generated work with free third-party assets, as authorized by the owner. Record source, author, license and modifications for every imported asset. Preserve offline operation without external runtime requests.
- Use Chinese for player-facing copy, with brief English technical/atmospheric labels where appropriate.
- Run `npm test` and `npm run build` for gameplay changes; inspect the browser for UI changes.
- Do not add unrelated features or use subagents without explicit authorization.

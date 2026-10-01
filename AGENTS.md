# ECHO HEIST contributor notes

- Work directly on `main` as authorized by the project owner. Normal commits and pushes are authorized; do not force-push or delete unrelated work.
- Use `docs/next-steps.md` as the current development plan and `docs/production-status.md` for completed work. The latest user feedback prioritizes art. v0.22 replaces blocky characters with tailored meshes driven by the existing rig, adds window tracery and fanlight door crowns, and extends eight evidence preparation groups across all chapters. Keep this art standard as work continues. Next implement C7's return to the old museum with the identity-restoration receipt, then room transitions and postgame replay contracts. Preserve the C3-6 retained teammate, C4-6 credential handoff and both endings. Do not revive retired scope or playtime budgets.
- Keep gameplay deterministic at a fixed 60 Hz. The engine must remain usable without a browser.
- Preserve exact-position replay, end-pose holding, maximum three echoes, and explicit handling of full slots.
- Keep one playable route per training level and validate main-story routes with `npm run check:content`. Do not duplicate chapter walkthroughs across unit and browser tests.
- Visual and audio assets may combine code-generated work with free third-party assets, as authorized by the owner. Record source, author, license and modifications for every imported asset. Preserve offline operation without external runtime requests.
- Use Chinese for player-facing copy, with brief English technical/atmospheric labels where appropriate.
- Run `npm test` and `npm run build` for gameplay changes; inspect the browser for UI changes.
- Do not add unrelated features or use subagents without explicit authorization.

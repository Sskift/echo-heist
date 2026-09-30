# ECHO HEIST contributor notes

- Work directly on `main` as authorized by the project owner. Normal commits and pushes are authorized; do not force-push or delete unrelated work.
- Keep gameplay deterministic at a fixed 60 Hz. The engine must remain usable without a browser.
- Preserve exact-position replay, end-pose holding, maximum three echoes, and explicit handling of full slots.
- All three levels must have a tested playable solution within the 12-second loop.
- Visual and audio assets are code-generated. Preserve offline operation without external runtime requests.
- Use Chinese for player-facing copy, with brief English technical/atmospheric labels where appropriate.
- Run `npm test` and `npm run build` for gameplay changes; inspect the browser for UI changes.
- Do not add unrelated features or use subagents without explicit authorization.

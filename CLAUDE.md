# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Budget Processor for HomeOwners Advantage. It takes 5 Vantaca Excel exports (Balance Sheet, Operating Budget, Reserve Budget, CY and PY Income Statements), transforms them, and writes the results into 9 sheet/cell targets inside a password-protected, macro-enabled "Budget Macro Workbook" (`.xlsm`).

There are two implementations of the same pipeline:

- **`web/`**: the current one. A static React + TypeScript + Vite site deployed to GitHub Pages (`nguillet23.github.io/HOA/`). Everything runs in the browser and there is no server. Files never leave the user's machine.
- **`src/` + `run.py`**: the original local Flask app, using pandas and xlwings. It needs Windows with Excel installed. It's kept as reference and fallback. It's also the planned home for a future Vantaca auto-download feature (Playwright), because that needs a real server.

Design history, decisions and phase status live in `Next_Steps/LIVE_WEBSITE_PLAN.md` and `Next_Steps/EXCEL_DOWNLOAD_AGENT_PLAN.md`. The `Next_Steps/` folder is gitignored and exists only locally. Read these before making architectural changes, and update their status sections when you finish a phase.

## Commands

Web app (run from `web/`):

```
npm run dev        # Vite dev server
npm run build      # tsc -b type-check + vite build -> web/dist/
npm run preview    # serve the production build locally
npm run lint       # oxlint
npm test           # vitest run (whole suite)
npx vitest run src/lib/readSheets.test.ts        # single file
npx vitest run -t "full 5-file pipeline"         # single test by name
```

Flask app (from the repo root): `python -m pip install -r requirements.txt`, then `python run.py`. It binds to `127.0.0.1:5000` and opens a browser.

## Architecture (web/)

Each `web/src/lib/*.ts` module ports a specific piece of the Python app, with the same responsibilities and boundaries:

| web/src/lib | Python origin |
|---|---|
| `constants.ts` (file keys/labels/extensions, `COLS_TO_DROP`, the 9 `SHEET_WRITE_TARGETS`) | `src/utils.py` constants |
| `validate.ts` | `utils.validate_request` |
| `readSheets.ts`: reads the 5 exports, drops columns, splits CY/PY into OP/RSV at the `"Operating Net Total "` row (the trailing space is intentional) | `pd.read_excel` + transforms in `handlers_process.py` |
| `writeWorkbook.ts`: writes the 9 targets into the `.xlsm` via SheetJS and re-applies sheet protection | the xlwings unprotect → write → protect block |
| `zipOutput.ts`: zips renamed originals + written `.xlsm` and triggers a download | the `shutil` copy/move-to-backup-folder step |
| `associations.ts`: parses the uploaded `Association Export.xlsx` and caches it in IndexedDB | `handlers_associations.py` (which reads `config/Association Export.xlsx`) |

`hooks/useMemory.ts` stores last-used form values in `localStorage` (it replaces `handlers_memory.py`). `hooks/useAssociations.ts` wraps the IndexedDB cache. Components wire all of this into a form with 6 file slots.

Key constraints:

- **Macro preservation depends on SheetJS round-tripping `vbaProject.bin`.** The workbook must be read with `bookVBA: true` and written back with the VBA blob attached. SheetJS comes from the `cdn.sheetjs.com` tarball, not the npm registry (see `package.json`).
- **Sheet protection is written into the sheet XML with the user's workbook password.** That password must never be persisted: no `localStorage`, no memory hook.
- **`AccessGate.tsx` is a UX deterrent, not security.** It compares a SHA-256 hash that is baked into the bundle. Don't treat it as protecting data.
- `vite.config.ts` sets `base: '/HOA/'` for the Pages project path. Removing it breaks asset URLs in production.

## Tests and sensitive data

The Vitest suite reads real financial sample files from `web/test/fixtures/` (`balance.xls`, `operating.xlsx`, `reserve.xlsx`, `cy.xls`, `py.xls`, `macro.xlsm`, `associations.xlsx`). That folder is **gitignored**, and so are `config/Association Export.xlsx` and `Next_Steps/`. Never commit any of them: the repo is public. Because the fixtures don't exist in CI, the deploy workflow runs `npm run build` (which includes the type-check) but not `npm test`. Run tests locally.

`vitest` uses the `node` environment with a 20s timeout, because zipping the ~1MB real workbook is slow.

## Deployment

`.github/workflows/deploy-pages.yml` builds `web/` and publishes to GitHub Pages when a push to `main` touches `web/**` or the workflow file. It can also be run manually. Work on other branches doesn't go live until it's merged to `main`. `.github/workflows/build-check.yml` runs lint and build (no deploy) on pushes to any other branch and on PRs into `main`. Never commit `web/dist/`.

# Vendored: stackedlol/ascii-sharks

ASCII shark/ocean hero simulation used by the banner wallpaper
(`backgroundWallpaper.banner.source = "ascii-ocean"`).

| | |
| --- | --- |
| Upstream | https://github.com/stackedlol/ascii-sharks |
| Commit | `a0074c16a106f0abc665fe9712ca445f8f98ad8e` |
| License | MIT, Copyright (c) 2026 drewdi — full text at `public/third-party-licenses/ascii-sharks-MIT.txt` |
| Retrieved | 2026-11-02, via the GitHub contents API (`?ref=a0074c16…`), base64-decoded |

## Files

| Local | Upstream | Upstream blob sha |
| --- | --- | --- |
| `engine.ts` | `src/engine.ts` | `76a3fb29c435d8ccc7c35f2b0a566a72622f0e59` |
| `renderer.ts` | `src/renderer.ts` | `79a8b13e1aca62d8e2e7434514bbc9a3f725edd4` |
| `world.ts` | `src/world.ts` | `7e177492ca45e963fdb2bd3da9709c5611e3408b` |
| `species.ts` | `src/species.ts` | `cb161ccc07bb570a4ad5b630f8612e279ae04ace` |
| `math.ts` | `src/math.ts` | `f03a7cfb880b3e181a04523838aa1c7a00af8d43` |
| `public/third-party-licenses/ascii-sharks-MIT.txt` | `LICENSE` | `893a86723a7e09f5f03ae2959e245d0a4885de01` |

All six blob hashes were verified equal to GitHub's reported `sha` at retrieval
time (`git hash-object` on the decoded bytes). The license file is still
byte-identical.

## Local differences from upstream

The simulation constants, species and drawing code remain unchanged. The
engine lifecycle differs as described below.

1. **Explicit type annotations** in `math.ts`, `species.ts`, `world.ts`,
   `renderer.ts`, `engine.ts`. This repo runs `tsc --noEmit
   --isolatedDeclarations`, which rejects inferred return types on exported
   declarations; upstream is written without them. The four algorithm files
   differ from the upstream blobs only in annotations and formatting. The engine
   also contains the lifecycle changes below.
2. **`engine.ts`: `OceanEngineOptions` and a two-phase lifecycle** — an
   optional third constructor argument adding
   - `acceptPointer(event)`, so the banner can drop pointer events that start on
     a link/button/other actionable element (upstream listens on `window` for a
     full-page hero where that never happens),
   - `onFirstFrame()`, so the host knows when the first frame was actually
     painted before it swaps text colours over the canvas,
   - `onError()`, so a throwing frame stops the loop and the host can fall back
     to the image banner instead of leaving a frozen canvas,
   - a `visibilitychange` pause, so the loop stops while the browser tab is
     hidden.

   Upstream does all of its observing, listening, first resize/draw and
   scheduling in the constructor. That cannot work here: the host can only
   assign its `this.engine` reference after the constructor returns, so a
   synchronous failure during construction (the reduced-motion still draw
   throwing) left the host holding `null` and unable to tear the engine down —
   the engine kept its listeners and later reported a first frame, flipping the
   banner to `ready` over a canvas that had failed. The constructor is now
   side-effect-light (world, renderer, media query) and everything else moved to
   an idempotent `start()`, which the host calls after assigning the instance.
   `start()`, the frame loop, `ResizeObserver` sizing and the reduced-motion
   still draw all report a throw through one `fail()` path that disconnects,
   removes every listener and calls `onError` once; `destroy()` is idempotent,
   and callbacks belonging to a failed or disposed engine are no-ops. Also,
   `pointermove` now clears `world.pointer.active` when the event is rejected,
   so moving onto a link stops the fish following the previous position.

   Simulation parameters, loop timing, stepping and the drawing code are
   untouched.

Everything else — the fixed-timestep loop, 240-step reduced-motion still, the
`IntersectionObserver` viewport pause, `ResizeObserver` sizing, boids, sharks,
glyph rasterising — is upstream code.

## Lint/format exceptions

The five upstream-derived TypeScript files are excluded from Biome in
`biome.json`: `engine.ts`, `renderer.ts`, `world.ts`, `math.ts`, `species.ts`.
The four algorithm files retain the upstream formatting and add type annotations.
`engine.ts` also includes the lifecycle changes described above. Upstream uses
2-space indentation and long lines, which conflicts with this
repo's `biome ci ./src` in dozens of places; reformatting them would destroy the
auditability of the vendored copies (and bury every real local change in
formatting churn). `banner.ts` — first-party integration code — stays checked,
and no other file is exempted. Biome does not see these five, but
`pnpm type-check` (`--isolatedDeclarations`) does, so they are still compiled and
checked there.

## Local integration (this repo only)

`banner.ts` owns the banner lifecycle (inactive/loading/ready/failed) and the
`#ascii-ocean-canvas` in `#wallpaper-wrapper`; the light-theme palette is a CSS
`invert(1) hue-rotate(180deg)` on the canvas in `src/styles/layout-styles.css`,
because the renderer's palette is dark-only and `banner-home.css` only loads on
the home page while the banner exists everywhere. The canvas is switched on
without an opacity transition, so the grid and the matching overlay palette
appear in the same frame instead of cross-fading over the image.

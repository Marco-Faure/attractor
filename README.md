# Attractor

Economic dynamics you can play with: phase portraits, saddle paths, bifurcations and shocks for one- and two-variable economic models, computed entirely in the browser.

Attractor is the successor of *FamiliaR with Dynamics* (R/Shiny, 2022).

## Deploy on GitHub Pages

All files sit at the root of the repository, with no subfolders.

1. In the repository, open the **Code** tab, then **Add file → Upload files**.
2. Drop every file of this folder, plus the eight font files listed below, and click **Commit changes**.
3. Open **Settings → Pages**, set **Source** to *Deploy from a branch*, branch `main`, folder `/ (root)`, and save.
4. The site appears at `https://<user>.github.io/<repository>/` after a minute or two.

No build step and no server: the site is static HTML, CSS and JavaScript, and it makes no request to any external service. To update the site later, upload only the files that changed.

To run it locally, serve the folder:

```
python3 -m http.server 8000
```

## Fonts

The fonts are self-hosted. `attractor.css` expects these files next to `index.html`:

```
InstrumentSans-Regular.ttf     STIXTwoText-Regular.ttf
InstrumentSans-Italic.ttf      STIXTwoText-Italic.ttf
InstrumentSans-Bold.ttf        STIXTwoText-SemiBold.ttf
InstrumentSans-BoldItalic.ttf  STIXTwoText-SemiBoldItalic.ttf
```

Both families are under the SIL Open Font License; keep their license files alongside them. If a file is missing, the page still works with a fallback font.

## Files

```
index.html      page layout
attractor.css   styles (LSO2 graphic charter, light and dark themes) and font declarations
engine.js       expression parser, model compiler, integrator, equilibria, manifolds, nullclines
models.js       model library
app.js          interface, drawing, editor
```

## Adding a model to the library

Append an entry to `LIBRARY` in `models.js`. The `src` field uses the same syntax as the in-app editor:

```
title: Van der Pol oscillator
x' = y
y' = mu*(1 - x^2)*y - x
param mu = 1 [0, 4] Damping
window x [-3, 3] y [-4, 4]
init x = 0.5, y = 0
```

| Directive | Purpose |
| --- | --- |
| `x' = …` / `x(t+1) = …` | Continuous-time or discrete-time equation (at most two variables) |
| `param a = 1 [min, max] Label` | Parameter with its slider range |
| `let y = …` | Auxiliary definition |
| `window x [a, b] y [c, d]` | Initial view |
| `init x = …, y = …` | Starting point of the first trajectory |
| `jump c` | Forward-looking variable that jumps onto the saddle path |
| `horizon N` | Length of time paths |
| `curve Label: expr` | Curve drawn in one-variable models |
| `report Label: expr` | Quantity evaluated at the steady state |
| `label x: text` | Axis label |

The other fields of a library entry are `id` (URL hash), `glyph` (menu icon), `bif` (default bifurcation parameter), `family` (menu section), `blurb`, `tries` (suggestions), and `ref`.

Models written in the in-app editor are stored in the visitor's browser (`localStorage`) and are not shared.

---

© 2026 Nicolò Badino & Marc-Antoine Faure Colonna d'Istria

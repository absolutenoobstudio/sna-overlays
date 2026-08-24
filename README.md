# SNA Football — stream overlays

Live browser overlays for the SNA Football Arsenal watchalongs (YouTube + TikTok).

They are plain HTML/CSS/JS with no build step and no dependencies. Each one
fetches its own data from ESPN's public API and sizes itself to whatever box
it is dropped into, so the same file works on a 1920x1080 canvas and a
1080x1920 one.

## Using them

Add a **Browser source** (Streamlabs / OBS) or **Browser capture** (TikTok LIVE
Studio) and point it at the file, then set the source size listed below.

## What's here

| File | Size | What it is |
|---|---|---|
| `arsenal-scorebug.html` | 820x200 | Live score and match clock |
| `arsenal-stats.html` | 1200x170 | Live match stats strip |
| `arsenal-goal.html` | 1920x1080 | Goal celebration with scorer name |
| `ticker.html` | 1920x60 | Scrolling stats bar |
| `live-table.html` | any | Live league table — see below |
| `live-scores.html` | any | Other fixtures, flashes green on a goal |
| `halftime-board.html` | 1920x1080 | Half-time board (add `?analysis` for the analysis scene) |
| `vertical-ht-board.html` | 1080x1920 | Vertical half-time board (`?noad` keeps stats up) |
| `prematch-board.html` / `prematch-vertical.html` | full frame | Line-ups and countdown |
| `fulltime-board.html` / `fulltime-vertical.html` | full frame | Full-time result |
| `analysis-stats.html` | 1920x1080 | Detailed stat pages (`?page=overview\|attack\|passing\|defending\|timeline`) |
| `rival-scorebug.html` | 900x170 | Rival watchalong scorebug (`?compact` for badges + score + clock) |
| `rival-mood.html` | 1920x150 | Rival mood meter |
| `rival-goal.html` | 1920x1080 | Inverted goal alert — celebrates the rival conceding |
| `rival-bg-*.html` | full frame | Rival watchalong backgrounds |
| `nametag.html` | 420x74 | Name plate (`?name=NOOB&sub=`) |
| `lastcards-promo.html` | 660x260 | Game promo (`?always`, or `?interval=150&show=35`) |
| `live-core.js` | — | **Shared** live-table engine, see below |

## The live league table

ESPN's standings endpoint only moves once a result is **final**, so on its own
it is not a live table — teams never budge during a match.

`live-core.js` takes the official table, folds in the scores of matches
actually being played, and re-sorts on points / goal difference / goals scored.
Teams climb and fall as goals go in, with an arrow against their official
position and a dot on any side currently playing.

It only ever applies a match it has **seen in progress**, recording each side's
official `gamesPlayed` at that moment. After full time it keeps applying the
result until that number goes up — exactly when ESPN has absorbed it — so a
result can never be counted twice.

`live-table.html`, `halftime-board.html` and `vertical-ht-board.html` all load
`live-core.js`. **Keep it alongside them.** If it is missing they fall back to
the plain official table rather than breaking.

## Common URL parameters

- `?league=eng.1` — any ESPN league id (`esp.1`, `ger.1`, `uefa.champions`, …)
- `?us=359` — team to highlight (359 = Arsenal)
- `?hilite=360,364,363,382,367` — extra teams to highlight
- `?limit=6` — how many table rows to show
- `?test` — loop an alert for testing. **Never leave this on when live.**

## Notes

- No API keys. Nothing here stores or transmits anything about the viewer.
- Backgrounds are transparent so the overlays sit over camera and video.
- Browser source hardware acceleration must be **off** for WebRTC guest cameras
  to render, though that does not affect these overlays.

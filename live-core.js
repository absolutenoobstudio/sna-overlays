/* ===========================================================================
   live-core.js - the shared live-league-table engine.

   Used by live-table.html, halftime-board.html and vertical-ht-board.html.
   Previously each of those carried its own copy; the logic below is subtle
   enough that three copies were going to drift apart.

   WHY THIS EXISTS
   ESPN's standings endpoint only moves once a result is FINAL, so on its own
   it is not a live table at all - teams never budge during a match. This takes
   the official table as the base, folds in the scores of matches actually
   being played, and re-sorts on points / goal difference / goals scored.

   THE DOUBLE-COUNTING TRAP
   The moment a match ends it flips to "post", but ESPN can take minutes to
   absorb it into the standings. Stop applying it immediately and the table
   snaps backwards; keep applying it forever and it gets counted twice once
   ESPN catches up.

   So: only a match we have SEEN in progress is ever applied, and when we first
   see it we record each side's official gamesPlayed. After full time we keep
   applying the result until that number goes up - which is exactly the moment
   ESPN has taken it on board. A match already finished when the page loaded is
   never applied, because there is no baseline and no way to tell whether ESPN
   has counted it.

   MOVEMENT ARROWS
   The baseline position is computed by ranking the UNADJUSTED numbers with the
   SAME comparator used for the live table. Measuring against ESPN's own `rank`
   instead made teams on identical records appear to move, purely because their
   tie-break differs from ours - which covered the table in meaningless arrows
   early in the season when most sides share a record. An arrow must only ever
   mean a live change.

   Loading this file is optional: every page that uses it falls back to the
   plain official table if it is missing, rather than breaking on stream.
   =========================================================================== */
(function (global) {
  "use strict";

  const tracked = new Map();   // eventId -> [[teamId, officialGamesPlayed], ...]

  async function jget(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }

  function statNum(entry, name) {
    const s = (entry && entry.stats ? entry.stats : []).find(x => x.name === name);
    const v = parseInt((s && (s.displayValue != null ? s.displayValue : s.value)) || "0", 10);
    return isFinite(v) ? v : 0;
  }

  // points, then goal difference, then goals scored, then name for stability
  function compare(a, b) {
    return (b.pts - a.pts) ||
           ((b.gf - b.ga) - (a.gf - a.ga)) ||
           (b.gf - a.gf) ||
           a.name.localeCompare(b.name);
  }

  function toRow(e) {
    const t = e.team || {};
    return {
      id: String(t.id),
      name: t.shortDisplayName || t.displayName || "",
      logo: (t.logos && t.logos[0] && t.logos[0].href) || "",
      pl: statNum(e, "gamesPlayed"),
      gf: statNum(e, "pointsFor"),
      ga: statNum(e, "pointsAgainst"),
      pts: statNum(e, "points"),
      rank: statNum(e, "rank"),
      playing: false,
      entry: e,
    };
  }

  /**
   * Live league table for one ESPN soccer league id (e.g. "eng.1").
   * Resolves to { rows, inPlay, degraded:false } where each row carries
   * id, name, logo, pl, gf, ga, gd, pts, rank, playing, pos and shift
   * (shift > 0 means the team has climbed since the official standings).
   * Throws if the standings cannot be fetched - callers already catch.
   */
  async function liveStandings(league) {
    const j = await jget("https://site.api.espn.com/apis/v2/sports/soccer/" + league + "/standings");
    const entries = (j.children && j.children[0] && j.children[0].standings && j.children[0].standings.entries)
                 || (j.standings && j.standings.entries)
                 || [];

    const table = new Map();
    for (const e of entries) {
      const row = toRow(e);
      if (row.id) table.set(row.id, row);
    }

    // baseline BEFORE anything is folded in, ranked with the same comparator
    const officialPos = new Map();
    [...table.values()].map(t => ({ ...t })).sort(compare)
      .forEach((t, i) => officialPos.set(t.id, i + 1));

    let inPlay = 0;
    try {
      const sb = await jget("https://site.api.espn.com/apis/site/v2/sports/soccer/" + league + "/scoreboard");
      for (const ev of sb.events || []) {
        const cs = (ev.competitions && ev.competitions[0] && ev.competitions[0].competitors) || [];
        if (cs.length !== 2) continue;
        const ids = cs.map(c => String(c.team && c.team.id));
        if (!ids.every(id => table.has(id))) continue;      // not a league fixture

        const state = ev.status && ev.status.type && ev.status.type.state;
        if (state === "in") {
          if (!tracked.has(ev.id)) tracked.set(ev.id, ids.map(id => [id, table.get(id).pl]));
        } else if (state === "post" && tracked.has(ev.id)) {
          const absorbed = tracked.get(ev.id).some(([id, was]) => table.get(id).pl > was);
          if (absorbed) { tracked.delete(ev.id); continue; }
        } else {
          continue;                                        // pre, or over before we loaded
        }

        const [a, b] = cs;
        const sa = parseInt(a.score || "0", 10), sb2 = parseInt(b.score || "0", 10);
        const bump = (c, mine, theirs) => {
          const t = table.get(String(c.team && c.team.id));
          t.pl += 1; t.gf += mine; t.ga += theirs;
          t.pts += mine > theirs ? 3 : mine === theirs ? 1 : 0;
          t.playing = true;
        };
        bump(a, sa, sb2);
        bump(b, sb2, sa);
        if (state === "in") inPlay++;
      }
    } catch (e) { /* no scoreboard - fall through with the official table */ }

    const rows = [...table.values()].sort(compare);
    const adjusted = rows.some(r => r.playing);
    rows.forEach((r, i) => {
      r.pos = i + 1;
      r.gd = r.gf - r.ga;
      r.shift = adjusted ? ((officialPos.get(r.id) || r.pos) - r.pos) : 0;
    });
    return { rows, inPlay, degraded: false };
  }

  global.LiveCore = { version: 1, liveStandings, compare, statNum };
})(window);

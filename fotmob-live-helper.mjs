// FotMob live-radar helper. Run this on the streaming PC on match day:
//
//     node fotmob-live-helper.mjs
//
// It watches FotMob for the followed team's live match and, the moment FotMob
// issues the Sportradar match id for it (that only happens once the match is
// live), writes it where the radar page can read it:
//
//   fotmob-live.js    next to this file - the Streamlabs browser source picks
//                     it up within seconds (local file, no network)
//   fotmob-live.json  same data, committed and pushed so the HOSTED copy of
//                     fotmob-radar.html (TikTok Studio) gets it a minute or
//                     two later via GitHub Pages
//
// Why a helper at all: FotMob's API answers Node on this PC but blocks
// browser pages on other domains (Cloudflare's bot screen), so the radar page
// cannot look the id up by itself. Only the id is published, never match data.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const TEAM = process.argv[2] || "9825";                  // FotMob team id: 9825 = Arsenal
const DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const JS = path.join(DIR, "fotmob-live.js"), JSON_ = path.join(DIR, "fotmob-live.json");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB"), ...a);

async function jget(u) {
  const r = await fetch(u, { headers: { "user-agent": UA, "accept": "application/json" } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

let last = "";
async function once() {
  const team = await jget(`https://www.fotmob.com/api/data/teams?id=${TEAM}`);
  const fx = team?.fixtures?.allFixtures?.fixtures ?? [];
  const t = f => new Date(f.status?.utcTime).getTime();
  const now = Date.now();
  // the live match, else the next one (checked so the id is caught the second it appears)
  const m = fx.find(f => f.status?.started && !f.status?.finished)
         || fx.filter(f => !f.status?.started && t(f) - now < 3 * 3600 * 1000).sort((a, b) => t(a) - t(b))[0];
  if (!m) { log("no match within 3 hours - waiting"); return; }
  const d = await jget(`https://www.fotmob.com/api/data/matchDetails?matchId=${m.id}`);
  const g = d.general ?? {}, url = d?.content?.superlive?.superLiveUrl || "";
  const sr = (/sr:match:(\d+)/.exec(url) || [])[1] || "";
  const state = { team: String(TEAM), matchId: String(m.id), home: g.homeTeam?.name ?? m.home?.name, away: g.awayTeam?.name ?? m.away?.name,
                  kickoff: g.matchTimeUTCDate ?? m.status?.utcTime, started: !!g.started, finished: !!g.finished, sr, updated: new Date().toISOString() };
  const key = JSON.stringify([state.matchId, state.sr, state.started, state.finished]);
  if (key === last) { log(`${state.home} v ${state.away}: ${state.sr ? "sr:match:" + state.sr : "no radar id yet"} (${state.finished ? "FT" : state.started ? "live" : "pre"})`); return; }
  last = key;
  fs.writeFileSync(JS, "window.FOTMOB_LIVE = " + JSON.stringify(state) + ";\n");
  fs.writeFileSync(JSON_, JSON.stringify(state, null, 2) + "\n");
  log(`wrote ${state.home} v ${state.away} -> ${state.sr ? "sr:match:" + state.sr : "no radar id yet"}`);
  try {
    execSync(`git -C "${DIR}" add fotmob-live.json && git -C "${DIR}" commit -q -m "fotmob-live: ${state.home} v ${state.away} ${state.sr ? "sr:match:" + state.sr : "pre"}" && git -C "${DIR}" push -q origin HEAD`, { stdio: "ignore" });
    log("pushed for the hosted page (live in a minute or two)");
  } catch (e) { log("push failed - hosted page will not see it; Streamlabs still will"); }
}

log(`watching FotMob team ${TEAM} - leave this window open during the match (Ctrl+C to stop)`);
for (;;) {
  try { await once(); } catch (e) { log("FotMob error:", e.message); }
  await new Promise(r => setTimeout(r, 30000));
}

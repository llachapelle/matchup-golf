import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── SUPABASE CLIENT ──────────────────────────────────────────────────────────
const SUPA_URL = "https://woxocunvkxyuygytaskm.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndveG9jdW52a3h5dXlneXRhc2ttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDc2NDIsImV4cCI6MjA5NjAyMzY0Mn0.uS7lSXBA4L_Nm0BYYskkeqXmfxDA49ZceqXPd-eGbJ8";

// Used ONLY for Realtime websocket subscriptions (live score sync across phones).
// All normal reads/writes still go through the lightweight `db` REST helper below —
// this keeps the rest of the app unchanged and only adds realtime on top.
const supabase = createClient(SUPA_URL, SUPA_KEY);

const db = {
  headers: { "Content-Type":"application/json", "apikey":SUPA_KEY, "Authorization":`Bearer ${SUPA_KEY}` },

  async get(table, query=""){
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${query}`, { headers:{...this.headers,"Accept":"application/json"} });
    if(!r.ok) throw new Error(await r.text());
    return r.json();
  },

  async post(table, body){
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
      method:"POST", headers:{...this.headers,"Prefer":"return=representation"}, body:JSON.stringify(body)
    });
    if(!r.ok) throw new Error(await r.text());
    return r.json();
  },

  async patch(table, query, body){
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${query}`, {
      method:"PATCH", headers:{...this.headers,"Prefer":"return=representation"}, body:JSON.stringify(body)
    });
    if(!r.ok) throw new Error(await r.text());
    return r.json();
  },

  async delete(table, query){
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${query}`, {
      method:"DELETE", headers:this.headers
    });
    if(!r.ok) throw new Error(await r.text());
    return true;
  },

  async rpc(fn, params={}){
    const r = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, {
      method:"POST", headers:this.headers, body:JSON.stringify(params)
    });
    if(!r.ok) throw new Error(await r.text());
    return r.json();
  },
};

// ─── AUTH HELPERS ─────────────────────────────────────────────────────────────
const auth = {
  async signUp(email, password, displayName){
    const r = await fetch(`${SUPA_URL}/auth/v1/signup`, {
      method:"POST",
      headers:{"Content-Type":"application/json","apikey":SUPA_KEY},
      body:JSON.stringify({email, password, data:{display_name:displayName}})
    });
    const json = await r.json();
    // Supabase v2 wraps response: { user, session: { access_token, ... } }
    // Normalize to flat shape our code expects
    if(json.session) return { ...json.session, user: json.user };
    if(json.user)    return { user: json.user, access_token: null };
    return json;
  },

  async signIn(email, password){
    const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
      method:"POST",
      headers:{"Content-Type":"application/json","apikey":SUPA_KEY},
      body:JSON.stringify({email, password})
    });
    const json = await r.json();
    // v2 token endpoint returns flat { access_token, user, ... } directly
    if(json.session) return { ...json.session, user: json.user };
    return json;
  },

  async signOut(token){
    await fetch(`${SUPA_URL}/auth/v1/logout`, {
      method:"POST",
      headers:{"Content-Type":"application/json","apikey":SUPA_KEY,"Authorization":`Bearer ${token}`}
    });
  },

  // Exchanges a refresh_token for a brand new access_token without requiring
  // the person to log in again. Supabase access tokens expire after ~1 hour;
  // without this, everyone would get logged out constantly even mid-session.
  async refreshSession(refreshToken){
    const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=refresh_token`, {
      method:"POST",
      headers:{"Content-Type":"application/json","apikey":SUPA_KEY},
      body:JSON.stringify({refresh_token: refreshToken})
    });
    const json = await r.json();
    if(json.session) return { ...json.session, user: json.user };
    return json;
  },
};

// ─── COLORS ───────────────────────────────────────────────────────────────────
const C = {
  forest:"#1B4332", fairway:"#2D6A4F", turf:"#40916C", mint:"#74C69D",
  cream:"#FEFAE0", mist:"#E8F0EC", sand:"#E9C46A",
  white:"#FFFFFF", smoke:"#F8F9FA",
  charcoal:"#1C1C1E", slate:"#3A3A3C", gray:"#8E8E93", light:"#D1D5DB",
  red:"#C0392B", redBg:"#FADBD8", blue:"#1A5276", blueBg:"#D6EAF8",
  redBright:"#F1948A", blueBright:"#7FB3D5", // brighter than *Bg, more visible in direct sunlight, used for quick-glance indicators like hole-result dots
  green:"#27AE60", greenBg:"#D5F5E3", amber:"#E67E22", amberBg:"#FDEBD0",
};

// ─── COURSES ──────────────────────────────────────────────────────────────────
const COURSES = {
  mammoth:   {id:"mammoth",   name:"Mammoth Dunes",tee:"Blue", rating:74.3,slope:138,par:72,strokeIndex:[7,13,1,11,5,15,3,17,9,8,14,2,12,6,16,4,18,10],pars:[4,5,4,3,5,4,3,4,4,4,5,4,3,4,5,4,3,5]},
  sandbox:   {id:"sandbox",   name:"Sandbox",      tee:"White",rating:72.1,slope:128,par:72,strokeIndex:[3,15,7,11,1,17,9,13,5,4,16,8,12,2,18,10,14,6], pars:[4,4,5,3,4,3,4,5,4,4,4,5,3,4,3,5,4,4]},
  sandvalley:{id:"sandvalley",name:"Sand Valley",  tee:"Blue", rating:73.8,slope:135,par:72,strokeIndex:[5,11,3,15,1,17,7,13,9,6,12,4,16,2,18,8,14,10], pars:[4,5,4,3,4,3,5,4,4,4,5,4,3,4,4,5,3,4]},
};

const ROUNDS = [
  {id:1,day:"Thursday",name:"Round 1",courseId:"mammoth",   format:"Best Ball",      time:"1:00 PM",game:"Nassau"},
  {id:2,day:"Friday",  name:"Round 2",courseId:"sandbox",   format:"Alternate Shot", time:"8:30 AM",game:"Skins"},
  {id:3,day:"Friday",  name:"Round 3",courseId:"sandvalley",format:"Best Ball",      time:"2:00 PM",game:"Nassau"},
  {id:4,day:"Saturday",name:"Round 4",courseId:"mammoth",   format:"Alternate Shot", time:"8:30 AM"},
  {id:5,day:"Saturday",name:"Round 5",courseId:"sandvalley",format:"Singles",        time:"1:00 PM"},
];

// ─── PLAYERS ──────────────────────────────────────────────────────────────────
const RAW = [
  {key:"louie",name:"Louie",team:"red", index:8.4, ghin:true},
  {key:"ryan", name:"Ryan", team:"red", index:12.2,ghin:false},
  {key:"mike", name:"Mike", team:"blue",index:4.1, ghin:true},
  {key:"john", name:"John", team:"blue",index:15.0,ghin:false},
  {key:"sam",  name:"Sam",  team:"red", index:10.5,ghin:false},
  {key:"alex", name:"Alex", team:"blue",index:18.2,ghin:false},
];

// ─── GUEST PLAYERS ────────────────────────────────────────────────────────────
// Guest/external players who appear in matches but aren't trip members.
// Their handicap indexes are used for WHS net calculation exactly like RAW players.
// Keys must match the lowercase first-name keys used in match holeScores.
const GUEST_PLAYERS = {
  tony:   {key:"tony",  name:"Tony",  index:22.0, ghin:false},
  jeremy: {key:"jeremy",name:"Jeremy",index:14.5, ghin:false},
  ben:    {key:"ben",   name:"Ben",   index:19.8, ghin:false},
  chris:  {key:"chris", name:"Chris", index:16.2, ghin:false},
  jake:   {key:"jake",  name:"Jake",  index:20.5, ghin:false},
};

// ─── MATCH DATA (initial seed — root state takes over at runtime) ─────────────
// holeScores: { holeNum: { playerKey: grossScore } }
// External/guest player keys use lowercase first name (e.g. "tony", "jeremy")
// Their handicap data lives in GUEST_PLAYERS above
const INITIAL_MATCHES = [
  // Match 1: John/Tony (p1, blue) vs Louie/Jeremy (p2, red)
  // Mammoth Dunes, Best Ball. John hcp15 MS=+7, Louie hcp8.4 MS=0
  // Tony ~22hcp guest, Jeremy ~14hcp guest (gross only, not used for net)
  // Verified: Louie wins 6, John wins 3, ties 7 over 16 holes → 3&2 ✓
  {id:1, round:1, day:"Thursday",
   p1:"John / Tony",   p1Keys:["john"],
   p2:"Louie / Jeremy",p2Keys:["louie"],
   status:"completed", winnerSide:"p2", score:"3 & 2",
   holeScores:{
     1:{john:"5",tony:"7",louie:"5",jeremy:"6"},
     2:{john:"6",tony:"8",louie:"4",jeremy:"5"},
     3:{john:"5",tony:"7",louie:"5",jeremy:"5"},
     4:{john:"3",tony:"5",louie:"3",jeremy:"4"},
     5:{john:"6",tony:"8",louie:"5",jeremy:"6"},
     6:{john:"4",tony:"6",louie:"4",jeremy:"5"},
     7:{john:"4",tony:"6",louie:"3",jeremy:"4"},
     8:{john:"5",tony:"7",louie:"4",jeremy:"5"},
     9:{john:"5",tony:"7",louie:"4",jeremy:"5"},
    10:{john:"5",tony:"7",louie:"5",jeremy:"6"},
    11:{john:"7",tony:"9",louie:"5",jeremy:"6"},
    12:{john:"5",tony:"7",louie:"4",jeremy:"5"},
    13:{john:"3",tony:"5",louie:"3",jeremy:"4"},
    14:{john:"5",tony:"7",louie:"4",jeremy:"5"},
    15:{john:"6",tony:"8",louie:"4",jeremy:"5"},
    16:{john:"5",tony:"7",louie:"4",jeremy:"5"},
    17:{john:"4",tony:"6",louie:"3",jeremy:"4"},
    18:{john:"6",tony:"8",louie:"5",jeremy:"6"},
   }},

  // Match 2: Ryan/Sam (p1, red) vs Alex/Ben (p2, blue)
  // Mammoth Dunes, Best Ball. Ryan hcp12.2 MS=+1, Sam hcp10.5 MS=0, Alex hcp18.2 MS=+9
  // Ben hcp19.8 guest (in GUEST_PLAYERS) — net computed from his handicap
  // Alex and Ben have near-identical PHs so Ben gets 0 match strokes (same as Alex)
  // Verified: RS wins 6, Alex wins 4, ties 7 over 17 holes → 2&1 ✓
  {id:2, round:1, day:"Thursday",
   p1:"Ryan / Sam",    p1Keys:["ryan","sam"],
   p2:"Alex / Ben",    p2Keys:["alex"],
   status:"completed", winnerSide:"p1", score:"2 & 1",
   holeScores:{
     1:{ryan:"4",sam:"4",alex:"4",ben:"6"},
     2:{ryan:"5",sam:"5",alex:"6",ben:"7"},
     3:{ryan:"4",sam:"4",alex:"5",ben:"6"},
     4:{ryan:"3",sam:"3",alex:"4",ben:"5"},
     5:{ryan:"5",sam:"5",alex:"5",ben:"7"},
     6:{ryan:"5",sam:"5",alex:"5",ben:"6"},
     7:{ryan:"3",sam:"3",alex:"4",ben:"5"},
     8:{ryan:"4",sam:"4",alex:"5",ben:"6"},
     9:{ryan:"4",sam:"4",alex:"4",ben:"5"},
    10:{ryan:"4",sam:"4",alex:"5",ben:"6"},
    11:{ryan:"5",sam:"5",alex:"6",ben:"7"},
    12:{ryan:"4",sam:"4",alex:"5",ben:"6"},
    13:{ryan:"4",sam:"4",alex:"4",ben:"5"},
    14:{ryan:"4",sam:"4",alex:"4",ben:"5"},
    15:{ryan:"6",sam:"6",alex:"6",ben:"7"},
    16:{ryan:"4",sam:"4",alex:"5",ben:"6"},
    17:{ryan:"3",sam:"3",alex:"4",ben:"5"},
    18:{ryan:"5",sam:"5",alex:"5",ben:"6"},
   }},

  // Match 3: Louie/Ryan (p1, red) vs Mike/John (p2, blue) — live, thru 6, Red 2 UP
  // Mammoth Dunes, Alt Shot. Red combined PH=14 MS=1, Blue combined PH=13 MS=0
  // Red wins H1,H3,H5 (net wins); Blue wins H2; Ties H4,H6 → Red 2UP ✓
  {id:3, round:2, day:"Friday",
   p1:"Louie / Ryan",  p1Keys:["louie","ryan"],
   p2:"Mike / John",   p2Keys:["mike","john"],
   status:"live", winnerSide:null, thru:6, liveScore:"Red 2 UP",
   holeScores:{
     1:{louie:"4",ryan:"4",mike:"5",john:"5"},
     2:{louie:"5",ryan:"5",mike:"4",john:"4"},
     3:{louie:"4",ryan:"4",mike:"5",john:"5"},
     4:{louie:"4",ryan:"4",mike:"4",john:"4"},
     5:{louie:"5",ryan:"5",mike:"6",john:"6"},
     6:{louie:"4",ryan:"4",mike:"4",john:"4"},
   }},

  // Match 4: Sam/Chris (p1, red) vs Jake/Alex (p2, blue) — live, thru 5, All Square
  // Sam hcp10.5 MS=0, Alex hcp18.2 MS=9 — Alex gets strokes on SI≤9 holes
  // Sam 2W Alex 2W 1 Tie → All Square ✓
  {id:4, round:2, day:"Friday",
   p1:"Sam / Chris",   p1Keys:["sam"],
   p2:"Jake / Alex",   p2Keys:["alex"],
   status:"live", winnerSide:null, thru:5, liveScore:"All Square",
   holeScores:{
     1:{sam:"4",alex:"4"},
     2:{sam:"4",alex:"6"},
     3:{sam:"4",alex:"4"},
     4:{sam:"3",alex:"4"},
     5:{sam:"4",alex:"5"},
   }},

  {id:5, round:3, day:"Friday",
   p1:"Louie / Mike",  p1Keys:["louie","mike"],
   p2:"John / Sam",    p2Keys:["john","sam"],
   status:"upcoming", winnerSide:null, time:"2:00 PM", holeScores:{}},

  {id:6, round:3, day:"Friday",
   p1:"Ryan / Alex",   p1Keys:["ryan","alex"],
   p2:"Tony / Ben",    p2Keys:[],
   status:"upcoming", winnerSide:null, time:"2:00 PM", holeScores:{}},

  {id:7, round:5, day:"Saturday",
   p1:"Louie",         p1Keys:["louie"],
   p2:"Mike",          p2Keys:["mike"],
   status:"upcoming", winnerSide:null, time:"1:00 PM", holeScores:{}},

  {id:8, round:5, day:"Saturday",
   p1:"Ryan",          p1Keys:["ryan"],
   p2:"John",          p2Keys:["john"],
   status:"upcoming", winnerSide:null, time:"1:10 PM", holeScores:{}},

  {id:9, round:5, day:"Saturday",
   p1:"Sam",           p1Keys:["sam"],
   p2:"Alex",          p2Keys:["alex"],
   status:"upcoming", winnerSide:null, time:"1:20 PM", holeScores:{}},
];

// ── Pure derive functions — accept a matches array, return computed values ─────
// Resolves a player key's team (red/blue) by checking the REAL trip roster
// first — this is the single source of truth set during trip setup. Falls
// back to the RAW demo roster only when no real tripPlayers data exists.
// Every team lookup throughout the app should go through this function;
// looking up team via RAW alone silently breaks for any real trip player
// who isn't part of the hardcoded demo cast, causing wrong team displays
// and incorrect match results (since the winner's team gets derived wrong).
const resolvePlayerTeam = (key, tripPlayers) => {
  const tp = tripPlayers?.find(p => p.name.toLowerCase() === key);
  if(tp?.team) return tp.team;
  const raw = RAW.find(p => p.key === key);
  if(raw?.team) return raw.team;
  return null; // unresolved — caller decides the fallback default
};

function matchWinningTeam(m, tripPlayers) {
  if(!m.winnerSide || m.winnerSide==="halve") return m.winnerSide==="halve"?"halve":null;
  const winnerKeys = m.winnerSide==="p1" ? m.p1Keys : m.p2Keys;
  const redCount  = (winnerKeys||[]).filter(k=>resolvePlayerTeam(k,tripPlayers)==="red").length;
  const blueCount = (winnerKeys||[]).filter(k=>resolvePlayerTeam(k,tripPlayers)==="blue").length;
  return redCount >= blueCount ? "red" : "blue";
}

function deriveTeamScores(matches, tripPlayers) {
  let red=0, blue=0, redW=0, blueW=0, halves=0;
  matches.filter(m=>m.status==="completed").forEach(m=>{
    const wt = matchWinningTeam(m, tripPlayers);
    if(wt==="red")  { red+=1;   redW++; }
    if(wt==="blue") { blue+=1;  blueW++; }
    if(wt==="halve"){ red+=0.5; blue+=0.5; halves++; }
  });
  const played    = matches.filter(m=>m.status==="completed").length;
  const total     = matches.length;
  const remaining = total - played;
  return {red, blue, redW, blueW, halves, played, total, remaining};
}

function derivePlayerRecords(matches) {
  const records = {};
  // Initialize all RAW players
  RAW.forEach(p=>{ records[p.key]={w:0,l:0,h:0,pts:0}; });
  // Also initialize any guest players who appear in matches
  Object.values(GUEST_PLAYERS).forEach(p=>{ records[p.key]={w:0,l:0,h:0,pts:0}; });
  // Also pick up any other external keys from match pairing strings
  matches.filter(m=>m.status==="completed").forEach(m=>{
    // Parse all player keys from pairing strings (RAW + guests + unknowns)
    const parseAllKeys = (str, rawKeys) => {
      const extNames = str.split("/").map(n=>n.trim().toLowerCase())
        .filter(n=>n && !rawKeys.includes(n));
      return [...rawKeys, ...extNames];
    };
    const allP1 = parseAllKeys(m.p1||"", m.p1Keys||[]);
    const allP2 = parseAllKeys(m.p2||"", m.p2Keys||[]);
    [...allP1, ...allP2].forEach(key=>{
      if(!records[key]) records[key]={w:0,l:0,h:0,pts:0};
    });
    [...allP1, ...allP2].forEach(key=>{
      const side   = allP1.includes(key) ? "p1" : "p2";
      const halved = m.winnerSide==="halve";
      const won    = !halved && m.winnerSide===side;
      if(halved){  records[key].h+=1; records[key].pts+=0.5; }
      else if(won){ records[key].w+=1; records[key].pts+=1;  }
      else {        records[key].l+=1; }
    });
  });
  const formatted = {};
  Object.entries(records).forEach(([key,r])=>{
    formatted[key]={record:`${r.w}–${r.l}–${r.h}`,pts:r.pts,w:r.w,l:r.l,h:r.h};
  });
  return formatted;
}

// ─── SIDE GAMES ENGINE ──────────────────────────────────────────────────────
// Computes real Nassau and Skins results from actual hole-by-hole scores.
// Fully decoupled from match pairings — works off ANY custom grouping of
// players into two sides (Nassau) or a pool (Skins), e.g. a private 1v1
// side bet between two guys inside a larger 4-person scramble.

// Helper: find a player's gross score for a given hole, scoped to ONE match
// (so a side game attached to a specific round only reads that round's scores,
// not every match the player has ever appeared in across the whole trip).
const getPlayerHoleScore = (matches, playerKey, hole, scopedMatchId=null) => {
  const pool = scopedMatchId ? matches.filter(m=>m.id===scopedMatchId) : matches;
  for(const m of pool){
    const hs = m.holeScores?.[hole];
    if(hs && hs[playerKey]!==undefined){
      const v = parseInt(hs[playerKey]);
      if(!isNaN(v) && v>0) return v;
    }
  }
  return null;
};

// Nassau for a custom group: side1Keys vs side2Keys (1v1, 2v2, etc.), scoped to one match/round
function deriveNassauForGroup(matches, side1Keys, side2Keys, betAmount=10, scopedMatchId=null) {
  const segment = (startH, endH) => {
    let s1Wins=0, s2Wins=0, holesPlayed=0;
    for(let h=startH; h<=endH; h++){
      const s1Scores = side1Keys.map(k=>getPlayerHoleScore(matches,k,h,scopedMatchId)).filter(v=>v!==null);
      const s2Scores = side2Keys.map(k=>getPlayerHoleScore(matches,k,h,scopedMatchId)).filter(v=>v!==null);
      if(s1Scores.length===0 || s2Scores.length===0) continue;
      holesPlayed++;
      const s1Best = Math.min(...s1Scores), s2Best = Math.min(...s2Scores);
      if(s1Best<s2Best) s1Wins++;
      else if(s2Best<s1Best) s2Wins++;
    }
    if(holesPlayed===0) return {winner:"none", amt:0, holesPlayed};
    if(s1Wins===s2Wins) return {winner:"tie", amt:0, holesPlayed};
    return {winner: s1Wins>s2Wins?"side1":"side2", amt:betAmount, holesPlayed};
  };
  return { front: segment(1,9), back: segment(10,18), overall: segment(1,18) };
}

// Skins for a custom pool of players, scoped to one match/round
function deriveSkinsForGroup(matches, playerKeys, skinAmount=5, scopedMatchId=null) {
  const skinsByPlayer = {};
  const holes = [];
  let carryover = 0;

  for(let h=1; h<=18; h++){
    const scoresThisHole = playerKeys
      .map(k=>({key:k, score:getPlayerHoleScore(matches,k,h,scopedMatchId)}))
      .filter(s=>s.score!==null);
    if(scoresThisHole.length===0) continue;

    const minScore = Math.min(...scoresThisHole.map(s=>s.score));
    const winners  = scoresThisHole.filter(s=>s.score===minScore);

    carryover += skinAmount;
    if(winners.length===1){
      const w = winners[0].key;
      skinsByPlayer[w] = (skinsByPlayer[w]||0) + 1;
      holes.push({hole:h, winner:w, amount:carryover});
      carryover = 0;
    } else {
      holes.push({hole:h, winner:null, amount:carryover});
    }
  }
  const totalPot = Object.values(skinsByPlayer).reduce((a,b)=>a+b,0) * skinAmount;
  return { skinsByPlayer, holes, totalPot, unclaimedCarryover: carryover };
}

// ── Wolf ──────────────────────────────────────────────────────────────────
// Players rotate as Wolf each hole (in the order given). Wolf picks the BEST
// gross score among the others as a "partner" (2v rest) OR goes Lone Wolf
// (1 vs all 3) if no partner combination beats going alone. Lone Wolf pays/wins
// double. Settled per hole based on team gross total comparison.
function deriveWolfForGroup(matches, playerKeys, betAmount=5, scopedMatchId=null) {
  if(playerKeys.length !== 4) return { holes: [], pointsByPlayer:{}, error:"Wolf requires exactly 4 players" };
  const pointsByPlayer = {};
  playerKeys.forEach(k=>pointsByPlayer[k]=0);
  const holes = [];

  for(let h=1; h<=18; h++){
    const wolfIdx = (h-1) % 4;
    const wolfKey = playerKeys[wolfIdx];
    const others  = playerKeys.filter(k=>k!==wolfKey);
    const scores  = {};
    let allHave = true;
    [wolfKey,...others].forEach(k=>{
      const s = getPlayerHoleScore(matches,k,h,scopedMatchId);
      if(s===null) allHave=false;
      scores[k]=s;
    });
    if(!allHave) continue;

    // Try every partner pairing; Wolf picks whichever makes the best team score.
    // We assume Wolf always picks the partner combo that wins (best-case for Wolf),
    // since the actual hole-by-hole "who did Wolf pick" isn't separately captured.
    let bestPartner=null, bestTeamScore=Infinity;
    others.forEach(partnerKey=>{
      const teamScore = Math.min(scores[wolfKey], scores[partnerKey]);
      if(teamScore<bestTeamScore){ bestTeamScore=teamScore; bestPartner=partnerKey; }
    });
    const oppKeys = others.filter(k=>k!==bestPartner);
    const oppBest = Math.min(...oppKeys.map(k=>scores[k]));
    const loneWolfScore = scores[wolfKey];
    const loneWolfBeatsAll = Math.min(...others.map(k=>scores[k])) > loneWolfScore;

    let result;
    if(loneWolfBeatsAll){
      // Lone Wolf wins solo — double points
      playerKeys.forEach(k=>{
        if(k===wolfKey) pointsByPlayer[k]+=betAmount*2*3; // beats all 3 others, double
        else pointsByPlayer[k]-=betAmount*2;
      });
      result={hole:h, wolf:wolfKey, mode:"lone", winner:wolfKey, amount:betAmount*2};
    } else if(bestTeamScore<oppBest){
      // Wolf + partner win normal points
      pointsByPlayer[wolfKey]+=betAmount; pointsByPlayer[bestPartner]+=betAmount;
      oppKeys.forEach(k=>pointsByPlayer[k]-=betAmount);
      result={hole:h, wolf:wolfKey, mode:"partner", partner:bestPartner, winner:"wolf_team", amount:betAmount};
    } else if(oppBest<bestTeamScore){
      oppKeys.forEach(k=>pointsByPlayer[k]+=betAmount);
      pointsByPlayer[wolfKey]-=betAmount; pointsByPlayer[bestPartner]-=betAmount;
      result={hole:h, wolf:wolfKey, mode:"partner", partner:bestPartner, winner:"opponents", amount:betAmount};
    } else {
      result={hole:h, wolf:wolfKey, mode:"partner", partner:bestPartner, winner:"tie", amount:0};
    }
    holes.push(result);
  }
  return { holes, pointsByPlayer };
}

// ── Stableford ───────────────────────────────────────────────────────────
// Points per hole based on gross score vs par: double eagle=5, eagle=4,
// birdie=3, par=2, bogey=1, double bogey or worse=0. Most points wins.
function deriveStablefordForGroup(matches, playerKeys, pars, betAmount=1, scopedMatchId=null) {
  const pointsByPlayer = {};
  playerKeys.forEach(k=>pointsByPlayer[k]=0);

  for(let h=1; h<=18; h++){
    const par = pars?.[h-1] || 4;
    playerKeys.forEach(k=>{
      const score = getPlayerHoleScore(matches,k,h,scopedMatchId);
      if(score===null) return;
      const diff = score - par;
      let pts = 0;
      if(diff<=-3) pts=5;
      else if(diff===-2) pts=4;
      else if(diff===-1) pts=3;
      else if(diff===0)  pts=2;
      else if(diff===1)  pts=1;
      else pts=0;
      pointsByPlayer[k]+=pts;
    });
  }
  // Rank players by points; winner takes the pot from the rest based on point difference × betAmount
  const ranked = Object.entries(pointsByPlayer).sort((a,b)=>b[1]-a[1]);
  const moneyByPlayer = {};
  playerKeys.forEach(k=>moneyByPlayer[k]=0);
  if(ranked.length>1){
    const topScore = ranked[0][1];
    ranked.forEach(([key,pts])=>{
      const diff = pts - topScore; // 0 for the leader, negative for everyone else
      if(diff===0) return;
      moneyByPlayer[key] += diff*betAmount; // negative
      moneyByPlayer[ranked[0][0]] -= diff*betAmount; // leader gains the sum
    });
  }
  return { pointsByPlayer, moneyByPlayer, ranked };
}

// ── Vegas ────────────────────────────────────────────────────────────────
// 2v2 only. Each team's two gross scores combine into a 2-digit number
// (lower score = first digit). Lower combined number wins the hole.
// If a player scores 10+, the digits are added instead of concatenated.
function deriveVegasForGroup(matches, side1Keys, side2Keys, betAmount=1, scopedMatchId=null) {
  if(side1Keys.length!==2 || side2Keys.length!==2) return { holes:[], error:"Vegas requires exactly 2 players per side" };
  const holes = [];
  let netPoints = 0; // positive = side1 owes nothing, tracks side1's net vs side2

  const combine = (a,b) => {
    if(a>=10||b>=10) return a+b;
    const lo=Math.min(a,b), hi=Math.max(a,b);
    return lo*10+hi;
  };

  for(let h=1; h<=18; h++){
    const s1 = side1Keys.map(k=>getPlayerHoleScore(matches,k,h,scopedMatchId));
    const s2 = side2Keys.map(k=>getPlayerHoleScore(matches,k,h,scopedMatchId));
    if(s1.some(v=>v===null) || s2.some(v=>v===null)) continue;
    const num1 = combine(s1[0],s1[1]);
    const num2 = combine(s2[0],s2[1]);
    const diff = (num2 - num1) * betAmount; // positive = side1 wins this much
    netPoints += diff;
    holes.push({hole:h, side1Num:num1, side2Num:num2, diff});
  }
  const winner = netPoints>0 ? "side1" : netPoints<0 ? "side2" : "tie";
  return { holes, netPoints: Math.abs(netPoints), winner };
}

// Legacy whole-trip versions (used as the "quick setup" default — Nassau/Skins
// across everyone in their existing match pairings, with no custom groups created yet)
function deriveNassauResults(matches, betAmount=10) {
  return matches
    .filter(m => m.holeScores && Object.keys(m.holeScores).length > 0)
    .map(m => {
      const segment = (startH, endH) => {
        let p1Wins=0, p2Wins=0;
        for(let h=startH; h<=endH; h++){
          const hs = m.holeScores[h];
          if(!hs) continue;
          const p1Keys = m.p1Keys||[], p2Keys = m.p2Keys||[];
          const p1Scores = p1Keys.map(k=>parseInt(hs[k])).filter(v=>!isNaN(v)&&v>0);
          const p2Scores = p2Keys.map(k=>parseInt(hs[k])).filter(v=>!isNaN(v)&&v>0);
          if(p1Scores.length===0 || p2Scores.length===0) continue;
          const p1Best = Math.min(...p1Scores), p2Best = Math.min(...p2Scores);
          if(p1Best<p2Best) p1Wins++;
          else if(p2Best<p1Best) p2Wins++;
        }
        if(p1Wins===p2Wins) return {winner:"tie", amt:0};
        return {winner: p1Wins>p2Wins?"p1":"p2", amt: betAmount};
      };
      return {
        matchId: m.id, p1: m.p1, p2: m.p2,
        front: segment(1,9), back: segment(10,18), overall: segment(1,18),
      };
    });
}

function deriveSkinsResults(matches, skinAmount=5) {
  const skinsByPlayer = {};
  const holes = [];
  let carryover = 0;

  for(let h=1; h<=18; h++){
    const scoresThisHole = [];
    matches.forEach(m=>{
      const hs = m.holeScores?.[h];
      if(!hs) return;
      const allKeys = [...(m.p1Keys||[]), ...(m.p2Keys||[])];
      allKeys.forEach(k=>{
        const v = parseInt(hs[k]);
        if(!isNaN(v) && v>0) scoresThisHole.push({key:k, score:v});
      });
    });
    if(scoresThisHole.length===0) continue;

    const minScore = Math.min(...scoresThisHole.map(s=>s.score));
    const winners  = scoresThisHole.filter(s=>s.score===minScore);

    carryover += skinAmount;
    if(winners.length===1){
      const w = winners[0].key;
      skinsByPlayer[w] = (skinsByPlayer[w]||0) + 1;
      holes.push({hole:h, winner:w, amount:carryover});
      carryover = 0;
    } else {
      holes.push({hole:h, winner:null, amount:carryover});
    }
  }

  const totalPot = Object.values(skinsByPlayer).reduce((a,b)=>a+b,0) * skinAmount;
  return { skinsByPlayer, holes, totalPot, unclaimedCarryover: carryover };
}

// Kept as module-level for components that haven't been updated yet —
// will be overridden by live prop values from root state everywhere that matters.
const MATCH_DATA      = INITIAL_MATCHES;
const TEAM_SCORES     = deriveTeamScores(INITIAL_MATCHES);
const PLAYER_RECORDS  = derivePlayerRecords(INITIAL_MATCHES);

// Per-player round scores — Round 1 totals derived from actual match hole scores above:
//   Louie: 74 (Match 1 verified), John: 89, Ryan: 76, Sam: 76, Alex: 86
//   Mike: not in Round 1 match → round score separate demo
const PLAYER_ROUNDS = {
  louie:{rounds:[74,71,72],money:25,  skinsWon:2},
  ryan: {rounds:[76,74,75],money:10,  skinsWon:1},
  mike: {rounds:[70,71,69],money:20,  skinsWon:3},
  john: {rounds:[89,83,85],money:-20, skinsWon:0},
  sam:  {rounds:[76,75,77],money:-10, skinsWon:1},
  alex: {rounds:[86,88,90],money:-25, skinsWon:0},
};

// ─── MATCH FORMATS (eligible to earn Ryder Cup points) ───────────────────────
const MATCH_FORMATS = [
  {id:"bestball",    name:"Best Ball",          desc:"Each player plays their own ball; best net score on the hole counts for the team.",                                                           rules:"Each partner plays their own ball throughout. The lower net score of the two on each hole is the team score. If one partner has a bad hole, the other can bail them out. WHS allowance: 90% of each player's Course Handicap for match play.",                                                              whs:"90%"},
  {id:"altshot",     name:"Alternate Shot",     desc:"Partners take turns hitting the same ball from tee to hole.",                                                                                  rules:"Partners alternate shots — one tees off on odd holes, the other on even holes. They continue alternating until the ball is holed. Requires communication and strategy. WHS allowance: 50% of combined Course Handicap.",                                                                                    whs:"50% combined"},
  {id:"scramble",    name:"Scramble",           desc:"All players hit; team selects the best shot and everyone plays from there.",                                                                    rules:"Every player hits a tee shot. The team picks the best one, and all players hit from that spot. Repeat until holed. The lowest-scoring team wins. WHS allowance: 25% of lowest + 20% second + 15% third + 10% highest handicap.",                                                                         whs:"25/20/15/10%"},
  {id:"fourball",    name:"4-Ball",             desc:"Each player plays their own ball; the best individual net score on each hole wins.",                                                           rules:"Two 2-person teams. All four players play their own ball throughout. The best individual net score on each hole wins the hole for that side. Also called 'Better Ball.' WHS allowance: 90% of each player's Course Handicap.",                                                                              whs:"90%"},
  {id:"fortyballs",  name:"40 Ball",            desc:"4-person teams use exactly 40 of their 72 possible scores across 18 holes. Lowest total wins.",                                                rules:"Each player plays their own ball throughout — 4 scores per hole, 72 total. The team decides how many scores (0–4) to count on each hole, but must use exactly 40 over 18 holes (~2.2 per hole). Strategy is key: take birdies, skip bogeys, but don't run out of needed scores late. Can also require each player to contribute exactly 10 scores. Scored net vs par. Lowest cumulative net score wins.",whs:"100% net"},
  {id:"twentyballs", name:"20 Ball",            desc:"2v2 format: teams use exactly 20 of their 36 possible scores across 18 holes. Lowest total wins.",                                             rules:"The 2-person version of 40 Ball. Each player plays their own ball — 2 scores per hole, 36 total. The team must count exactly 20 scores over 18 holes (~1.1 per hole). Strategy: take birdies and pars, skip bogeys, but manage your budget so you don't run low late. Optional rule: each player contributes exactly 10 scores, preventing one player from carrying the whole round — agree on this before teeing off. Scored net vs par. Lowest cumulative net score wins.", whs:"100% net"},
  {id:"singles",     name:"Singles",            desc:"1v1 match play, each player plays their own ball.",                                                                                            rules:"Head-to-head match play. Both players play their own ball. The player with the lower net score wins the hole. Match ends when one player leads by more holes than remain. WHS allowance: 100% of Course Handicap.",                                                                                         whs:"100%"},
  {id:"greensomes",  name:"Greensomes",         desc:"Both partners drive, team picks the best drive, then alternate shot.",                                                                         rules:"Both partners hit tee shots. The best drive is selected, and then partners alternate shots into the hole — but the player whose drive was NOT chosen hits the second shot. WHS allowance: 60% of lower handicap + 40% of higher handicap.",                                                                  whs:"60%/40%"},
  {id:"chapman",     name:"Chapman / Pinehurst",desc:"Both drive, swap balls for second shot, then pick the best ball and alternate in.",                                                            rules:"Both partners drive. Each then plays the OTHER partner's ball for the second shot. After the second shot, the team selects the best ball and alternate shot until holed. WHS allowance: 60% of lower + 40% of higher Course Handicap.",                                                                     whs:"60%/40%"},
  {id:"shamble",     name:"Shamble",            desc:"Best drive selected, then each player plays their own ball from that spot.",                                                                   rules:"All players hit tee shots. The best drive is selected and everyone plays from that spot. From that point, each player plays their own individual ball to the hole. The best net score counts. A hybrid of scramble and stroke play.",                                                                          whs:"Varies"},
  {id:"stableford",  name:"Stableford Match",   desc:"Points awarded per hole vs par; most points at end of 18 wins.",                                                                              rules:"Players earn points based on net score vs par: double eagle=5, eagle=4, birdie=3, par=2, bogey=1, double bogey=0. Player or team with the most points after 18 wins. Encourages aggressive play. WHS allowance: 95% of Course Handicap.",                                                                  whs:"95%"},
  {id:"stroke",      name:"Stroke Play",        desc:"Total net strokes over 18 holes; lowest score wins.",                                                                                         rules:"All strokes counted throughout all 18 holes. Net score = gross strokes minus handicap strokes received. Lowest net score wins. No hole-by-hole match play — every stroke counts. WHS allowance: 95% of Course Handicap.",                                                                                   whs:"95%"},
  {id:"modified_stableford",name:"Modified Stableford",desc:"Custom point values per score, rewarding eagles and birdies aggressively.",                                                           rules:"Similar to Stableford but with customizable points: common setup is eagle=+5, birdie=+2, par=0, bogey=−1, double bogey=−3. More extreme swings encourage risk-taking on reachable par 5s. Played net. WHS allowance: 95%.",                                                                                whs:"95%"},
  {id:"threeball",   name:"Three Ball",         desc:"Three players compete simultaneously in match play; each plays against the other two.",                                                        rules:"Three golfers in the same group each play match play against both of the other two simultaneously, resulting in two concurrent matches per player. Each hole produces two separate results. Best for when you have 3 players of different skill levels. WHS allowance: 100%.",                                  whs:"100%"},
];

// ─── SIDE GAME CATALOGUE ─────────────────────────────────────────────────────
const SIDE_GAMES = [
  // ── Most common ──
  {id:"nassau",    name:"Nassau",           cat:"Team",       desc:"Three bets: Front 9, Back 9, Overall. Carryovers optional.",        rules:"Nassau is actually three separate bets in one: (1) who wins the front 9, (2) who wins the back 9, (3) who wins overall 18 holes. Each bet is worth the same amount. A team wins each segment by winning more holes. Ties halve the bet or carry over — your choice. Common bets: $5, $10, or $20 per segment.", icon:"💵"},
  {id:"skins",     name:"Skins",            cat:"Individual", desc:"Lowest net score on each hole wins the skin. Ties carry over.",     rules:"Each hole is worth a 'skin' (a fixed dollar amount). The player with the lowest net score on a hole wins the skin. If two or more players tie for the lowest, the skin carries over to the next hole — growing the pot. The player who eventually wins an uncontested hole collects all carried skins.", icon:"🏆"},
  {id:"wolf",      name:"Wolf",             cat:"Individual", desc:"Rotating wolf picks a partner (or goes alone) on each hole.",       rules:"Players rotate as 'Wolf' each hole. After each player hits their tee shot, the Wolf can choose that player as a partner (2v2) or pass. If the Wolf passes all three players, they go 'Lone Wolf' (1v3) for double points. The Wolf and partner (or lone Wolf) must have the better net score to win. Points are settled per hole.", icon:"🐺"},
  {id:"fortyballs", name:"40 Ball",         cat:"Team",       desc:"4-person teams choose exactly 40 of their 72 net scores over 18 holes. Lowest total wins.", rules:"All four players play their own ball throughout. After each hole, the team decides how many of the four scores to count — anywhere from 0 to 4 — but the running total must reach exactly 40 by hole 18. Strategy: bank birdies, skip bogeys, but manage your remaining budget. A common variation requires each player to contribute exactly 10 scores. Scored net vs par; lowest total wins.", icon:"🔢"},
  // ── Points games ──
  {id:"stableford",name:"Stableford",       cat:"Individual", desc:"Points for net scores vs par: eagle=4, birdie=3, par=2, bogey=1.", rules:"Each player earns Stableford points per hole based on net score vs par: double eagle=5, eagle=4, birdie=3, par=2, bogey=1, double bogey or worse=0. Most points at the end of 18 holes wins. Bad holes are capped at 0, so one disaster doesn't sink your round.", icon:"📊"},
  {id:"quota",     name:"Quota",            cat:"Individual", desc:"Players set a quota target and earn points toward it.",             rules:"Each player's quota is set before the round (usually 36 minus handicap, or a custom number). Points earned per hole exactly like Stableford. At the end, compare actual points to quota. Players who exceed their quota win; the one furthest over quota wins the pot.", icon:"🎯"},
  {id:"bingo",     name:"Bingo Bango Bongo",cat:"Individual", desc:"3 points per hole: first on green, closest at putting, first in.", rules:"Three separate points are available on every hole: BINGO = first player to get their ball on the green, BANGO = player closest to the pin once all balls are on the green, BONGO = first player to hole out. Each point is worth a set amount. Handicaps apply via stroke index — players receiving a stroke get favorable treatment on designated holes.", icon:"🎱"},
  {id:"dots",      name:"Dots / Points",    cat:"Individual", desc:"Earn dots for birdies, sandies, greenies, proxies, and more.",     rules:"Players earn or lose dots throughout the round for achievements: birdie=+1, eagle=+2, sandie=+1, greenie=+1, etc. Custom dot values can be set before the round. At the end, dots are converted to cash. One of the most customizable formats — agree on which bonuses to include before teeing off.", icon:"🔵"},
  {id:"chicago",   name:"Chicago",          cat:"Individual", desc:"Points earned vs a quota based on handicap; quota set by handicap.", rules:"Each player is assigned a quota based on their handicap (e.g. handicap 18 = quota 39). Players earn Stableford points on each hole. At the end of the round, any player who exceeds their quota by the most wins. Simple and fair for mixed handicap groups.", icon:"🏙️"},
  // ── Team games ──
  {id:"sixsixsix", name:"6-6-6",            cat:"Team",       desc:"Partners rotate every 6 holes — three mini-competitions in one.",   rules:"The round is split into three 6-hole segments. Partners are scrambled before each segment, so everyone has three different partners. Each 6-hole segment has its own winner. You can set stakes per segment. Great for mixing up groups and keeping energy high throughout.", icon:"🔄"},
  {id:"vegas",     name:"Vegas",            cat:"Team",       desc:"Combine team scores as a two-digit number; lower number wins.",     rules:"Both players on a team get a net score on each hole. The lower score becomes the first digit and the higher score the second digit, forming a two-digit number. For example, net 3 and net 5 = 35. The team with the lower combined number wins the hole (or the set bet). If one player scores net 10+, the numbers are simply added instead.", icon:"🎰"},
  {id:"skins_team",name:"Team Skins",       cat:"Team",       desc:"Best combined net team score wins the hole skin.",                  rules:"Exactly like individual skins, but the unit competing is the team. The combined or best net team score on each hole earns the skin. Ties between teams carry the skin forward. Works well as a 2v2 companion to match play.", icon:"🏅"},
  // ── Bonus / side bets ──
  {id:"hammer",    name:"Hammer",           cat:"Any",        desc:"Either side can double the hole's bet mid-play by calling 'Hammer'.",rules:"Before any player hits, either side can 'Hammer' to double the current hole's value. The other side must accept (paying double if they lose) or concede the hole immediately. The hammered side can re-hammer, doubling it again. Adds high-stakes pressure to individual holes. Best combined with Nassau or skins.", icon:"🔨"},
  {id:"press",     name:"Press",            cat:"Any",        desc:"Losing side starts a new side-bet at any point during the round.",  rules:"When a side falls 2 down (or any agreed threshold), they can 'Press' — starting a new bet for the remainder of the current segment. The original bet continues alongside. Pressing is optional but adds a comeback mechanic that keeps trailing teams engaged. Common in Nassau.", icon:"⚡"},
  {id:"snake",     name:"Snake",            cat:"Individual", desc:"Last player to 3-putt holds the snake and pays the pot at round end.",rules:"The 'snake' is passed to whoever 3-putts last. If you 3-putt, you hold the snake. Whoever holds the snake at the end of the round owes everyone else a set amount. Adds drama and pressure on the greens. Some versions charge per 3-putt instead of just the last.", icon:"🐍"},
  {id:"arnies",    name:"Arnies",           cat:"Individual", desc:"Bonus for winning a hole without ever hitting the fairway.",         rules:"Named after Arnold Palmer. A player earns an Arnie by winning (or halving in match play) a hole without their ball ever landing in the fairway. Must make par or better. Worth a set point or dollar amount agreed before the round.", icon:"🏌️"},
  {id:"sandies",   name:"Sandies",          cat:"Individual", desc:"Bonus for making par or better after hitting a greenside bunker.",   rules:"A Sandie is awarded when a player's ball goes into a greenside (not fairway) bunker and they still make par or better on the hole. Worth a set amount per Sandie, agreed before the round. Rewards good bunker play.", icon:"🏖️"},
  {id:"greenies",  name:"Greenies",         cat:"Individual", desc:"Closest to pin on par 3s — must make par or better to collect.",    rules:"On every par 3, the player closest to the pin with their tee shot earns a Greenie — but only if they make par or better. If the closest player makes bogey or worse, no one earns the Greenie. Worth a set amount per hole. Encourages aggressive tee shots on short holes.", icon:"📍"},
];

const GAME_CATS = ["All","Team","Individual","Any"];

// ─── SCORE LABEL ─────────────────────────────────────────────────────────────
const scoreLabel = (gross, par) => {
  if(gross===1)       return "🏆 Hole in One";
  const diff=gross-par;
  if(diff<=-4)        return "🦅 Condor";
  if(diff===-3)       return "🦅 Albatross";
  if(diff===-2)       return "🦅 Eagle";
  if(diff===-1)       return "🐦 Birdie";
  if(diff===0)        return "Par";
  if(diff===1)        return "Bogey";
  if(diff===2)        return "Double Bogey";
  if(diff===3)        return "Triple Bogey";
  return `+${diff}`;
};

const calcCH  = (idx,c) => Math.round(idx*(c.slope/113)+(c.rating-c.par));
const calcPH  = (ch,fmt) => Math.round(ch*((fmt||"").toLowerCase().includes("singles")?1.0:0.90));
const calcMS  = phs => { const m=Math.min(...phs); return phs.map(ph=>Math.max(0,ph-m)); };
const sOnHole = (ms,si) => { if(ms<=0)return 0; return Math.floor(ms/18)+(si<=ms%18?1:0); };
function buildPlayers(raw,course,format){
  const a=raw.map(p=>({...p,ch:calcCH(p.index,course)}));
  const b=a.map(p=>({...p,ph:calcPH(p.ch,format)}));
  const ms=calcMS(b.map(p=>p.ph));
  return b.map((p,i)=>({...p,ms:ms[i]}));
}
const PLAYERS = buildPlayers(RAW,COURSES.mammoth,"Best Ball");

// ─── UI HELPERS ───────────────────────────────────────────────────────────────
const card   = (x={}) => ({background:C.white,borderRadius:16,padding:"14px 16px",boxShadow:"0 2px 10px rgba(0,0,0,.06)",...x});
const pill   = (bg,color,x={}) => ({background:bg,color,borderRadius:20,padding:"4px 10px",fontSize:11,fontFamily:"Arial,sans-serif",fontWeight:700,display:"inline-block",...x});
const bigBtn = (bg,color,x={}) => ({background:bg,color,border:"none",borderRadius:14,padding:14,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"Arial,sans-serif",width:"100%",...x});
const teamColor = t => t==="red"?C.red:C.blue;
const teamBg    = t => t==="red"?C.redBg:C.blueBg;
const scoreColor = s => (s||"").includes("Red")?C.red:(s||"").includes("Blue")?C.blue:C.slate;
const fmtMoney  = v => v>0?`+$${v}`:`-$${Math.abs(v)}`;
const fmtPts    = v => v===0.5?"½ pt":v===1?"1 pt":`${v} pts`;

function Header({sub,title,detail,right,small=false,onProfile,initials="?"}){
  return(
    <div style={{background:`linear-gradient(135deg,${C.forest},${C.fairway})`,padding:small?"14px 20px 16px":"18px 24px 20px"}}>
      {sub&&<div style={{color:"rgba(255,255,255,.55)",fontSize:11,fontFamily:"Arial,sans-serif",letterSpacing:"1.2px",textTransform:"uppercase",marginBottom:3}}>{sub}</div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{flex:1}}>
          <div style={{color:C.white,fontSize:small?17:20,fontWeight:700}}>{title}</div>
          {detail&&<div style={{color:"rgba(255,255,255,.6)",fontSize:12,fontFamily:"Arial,sans-serif",marginTop:2}}>{detail}</div>}
        </div>
        <div onClick={onProfile} style={{width:34,height:34,borderRadius:"50%",background:"rgba(255,255,255,.18)",border:"1.5px solid rgba(255,255,255,.3)",display:"flex",alignItems:"center",justifyContent:"center",cursor:onProfile?"pointer":"default",flexShrink:0,marginLeft:12}}>
          <span style={{fontSize:13,fontWeight:700,color:C.white,fontFamily:"Arial,sans-serif"}}>{initials}</span>
        </div>
        {right&&<div style={{marginLeft:8}}>{right}</div>}
      </div>
    </div>
  );
}
function BackBtn({goBack,go,to}){
  // Prefer goBack (real navigation history) when available; fall back to the
  // hardcoded `to` destination only for screens that haven't been wired up yet.
  const handleClick = () => goBack ? goBack() : go(to);
  return <button onClick={handleClick} style={{background:"rgba(255,255,255,.15)",border:"none",color:C.white,borderRadius:8,padding:"5px 11px",fontSize:12,cursor:"pointer",fontFamily:"Arial,sans-serif"}}>← Back</button>;
}
function StatRow({items}){return(<div style={{display:"flex",gap:8}}>{items.map(({label,value,color=C.charcoal,bg=C.smoke})=>(<div key={label} style={{flex:1,background:bg,borderRadius:14,padding:"10px 8px",textAlign:"center"}}><div style={{fontSize:20,fontWeight:700,color,fontFamily:"Arial,sans-serif"}}>{value}</div><div style={{fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:2}}>{label}</div></div>))}</div>);}

function BottomNav({screen,set,liveCount=0}){
  const items=[
    {id:"dashboard",icon:"🏠",label:"Home"},
    {id:"matches",  icon:"🏌️",label:"Matches",badge:liveCount},
    {id:"board",    icon:"📊",label:"Board"},
    {id:"trip",     icon:"🗓️",label:"Trip"},
    {id:"profile",  icon:"👤",label:"Profile"},
  ];
  return(
    <div style={{background:C.white,borderTop:`1px solid ${C.light}`,display:"flex",padding:"8px 0 16px"}}>
      {items.map(({id,icon,label,badge})=>{
        const active=screen===id;
        return(
          <div key={id} onClick={()=>set(id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer",position:"relative"}}>
            <span style={{fontSize:20,filter:active?"none":"grayscale(1) opacity(.4)"}}>{icon}</span>
            {badge>0&&<div style={{position:"absolute",top:0,right:"18%",background:C.red,color:C.white,borderRadius:"50%",width:14,height:14,fontSize:9,fontFamily:"Arial,sans-serif",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{badge}</div>}
            <span style={{fontSize:10,fontFamily:"Arial,sans-serif",color:active?C.forest:C.gray,fontWeight:active?700:400}}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── TEAM SCORE CARD (shared component) ───────────────────────────────────────
function TeamScoreCards({ts, showRemaining=true}){
  return(
    <>
      <div style={{display:"flex",gap:10}}>
        {[
          {name:"Team Red", pts:ts.red,  color:C.red,  bg:C.redBg,  emoji:"🔴", wins:ts.redW,  lead:ts.red>ts.blue},
          {name:"Team Blue",pts:ts.blue, color:C.blue, bg:C.blueBg, emoji:"🔵", wins:ts.blueW, lead:ts.blue>ts.red},
        ].map(t=>(
          <div key={t.name} style={{flex:1,background:C.white,borderRadius:20,padding:"16px 14px",boxShadow:"0 2px 12px rgba(0,0,0,.07)",display:"flex",flexDirection:"column",alignItems:"center",gap:4,border:t.lead?`2px solid ${t.color}`:`1px solid ${t.color}22`,position:"relative"}}>
            {t.lead&&ts.red!==ts.blue&&<div style={{position:"absolute",top:8,right:10,background:t.color,color:C.white,fontSize:9,padding:"2px 6px",borderRadius:6,fontFamily:"Arial,sans-serif",fontWeight:700}}>LEADING</div>}
            <div style={{fontSize:20}}>{t.emoji}</div>
            <div style={{fontSize:t.pts%1===0?40:32,fontWeight:700,color:t.color,lineHeight:1}}>{t.pts%1===0?t.pts:`${t.pts}`}</div>
            <div style={{fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif",letterSpacing:.5,textTransform:"uppercase"}}>pts</div>
            <div style={{fontSize:11,color:C.slate,fontFamily:"Arial,sans-serif",fontWeight:600}}>{t.name}</div>
            <div style={{fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif"}}>{t.wins}W · {ts.halves}H</div>
          </div>
        ))}
      </div>
      {showRemaining&&(
        <div style={card()}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
            <span style={{fontSize:12,fontWeight:600,color:C.red,fontFamily:"Arial,sans-serif"}}>🔴 {ts.red}</span>
            <span style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif"}}>{ts.remaining} matches remaining</span>
            <span style={{fontSize:12,fontWeight:600,color:C.blue,fontFamily:"Arial,sans-serif"}}>{ts.blue} 🔵</span>
          </div>
          <div style={{background:C.mist,borderRadius:8,height:8,overflow:"hidden",display:"flex"}}>
            {(ts.red+ts.blue)>0&&<>
              <div style={{width:`${ts.red/(ts.red+ts.blue)*100}%`,height:"100%",background:C.red,borderRadius:"8px 0 0 8px"}}/>
              <div style={{width:`${ts.blue/(ts.red+ts.blue)*100}%`,height:"100%",background:C.blue,borderRadius:"0 8px 8px 0"}}/>
            </>}
          </div>
          <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:5,textAlign:"center"}}>
            {ts.red===ts.blue?"Tied after "+ts.played+" match"+(ts.played!==1?"es":"")
              :ts.red>ts.blue?"Red leads · "+ts.remaining+" match"+(ts.remaining!==1?"es":"")+" to play"
              :"Blue leads · "+ts.remaining+" match"+(ts.remaining!==1?"es":"")+" to play"}
          </div>
        </div>
      )}
    </>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen({onAuth, defaultMode="join"}){
  const [mode,    setMode]    = useState(defaultMode);   // join | signin | signup
  const [code,    setCode]    = useState(["","","","","",""]);
  const [email,   setEmail]   = useState(()=>{
    try { return localStorage.getItem("matchup_remembered_email") || ""; } catch(e){ return ""; }
  });
  const [pw,      setPw]      = useState("");
  const [name,    setName]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [joinStep, setJoinStep] = useState("code"); // "code" -> "account" once trip is found
  const [foundTrip, setFoundTrip] = useState(null);
  const [rememberEmail, setRememberEmail] = useState(()=>{
    try { return !!localStorage.getItem("matchup_remembered_email"); } catch(e){ return false; }
  });

  const upd=(v,i)=>{const c=[...code];c[i]=v.slice(-1).toUpperCase();setCode(c);if(v&&i<5)document.getElementById(`ci${i+1}`)?.focus();};
  const kd=(e,i)=>{if(e.key==="Backspace"&&!code[i]&&i>0)document.getElementById(`ci${i-1}`)?.focus();};
  const joinCode = code.join("").toLowerCase();

  // Step 1: validate the trip code exists, then ask for name + account so this
  // person's scores/handicap link to a real, returning identity instead of a
  // one-time guest session that forgets them the moment they close the app.
  const handleJoinCodeSubmit = async () => {
    if(joinCode.length < 6){ setError("Enter all 6 digits"); return; }
    setLoading(true); setError("");
    try {
      const trips = await db.get("trips", `join_code=eq.${joinCode}&select=*`);
      if(!trips.length){ setError("Trip code not found. Check with your organizer."); setLoading(false); return; }
      setFoundTrip(trips[0]);
      setJoinStep("account");
    } catch(e){ setError("Connection error. Try again."); }
    setLoading(false);
  };

  // Step 2: create/sign in the account, link it to a trip_players row via user_id
  // so future sign-ins automatically restore this person's real trip data.
  const linkPlayerToUser = async (tripId, userId, playerName) => {
    try {
      const existing = await db.get("trip_players",
        `trip_id=eq.${tripId}&name=eq.${encodeURIComponent(playerName)}&select=*`);
      if(existing.length > 0){
        // Player already exists on roster (added by organizer beforehand) — just link the account
        await db.patch("trip_players", `id=eq.${existing[0].id}`, { user_id: userId });
      } else {
        // New player joining fresh — create their roster row linked to this account
        await db.post("trip_players", [{
          trip_id: tripId, user_id: userId, name: playerName, team: "red", is_guest: false,
        }]);
      }
    } catch(e){ console.warn("Failed to link player to user:", e.message); }
  };

  const handleJoinFinish = async () => {
    if(!name.trim()){ setError("Enter your name"); return; }
    if(!email||!pw){ setError("Enter email and password"); return; }
    setLoading(true); setError("");
    try {
      // Try signing in first — if they already have an account this works immediately.
      // Only attempt sign up if sign in fails (wrong credentials = new user).
      let session = null;
      const signInRes = await auth.signIn(email, pw);
      if(signInRes.access_token){
        session = signInRes;
      } else {
        // Sign in failed — try creating a new account
        const signUpRes = await auth.signUp(email, pw, name.trim());
        if(signUpRes.error) throw new Error(signUpRes.error.message||signUpRes.error.msg||"Account error");
        // If sign up succeeded but no token yet (email confirmation), try signing in again
        if(!signUpRes.access_token){
          const retry = await auth.signIn(email, pw);
          if(retry.access_token) session = retry;
          else throw new Error("Account created — check your email to confirm, then try signing in.");
        } else {
          session = signUpRes;
        }
      }
      if(!session?.access_token) throw new Error("Could not sign in — check your email and password");
      await linkPlayerToUser(foundTrip.id, session.user.id, name.trim());
      onAuth({ mode:"auth", session, trip: foundTrip });
    } catch(e){ setError(e.message||"Failed to join"); }
    setLoading(false);
  };

  // Skip account creation — join as a one-time guest (their data won't persist
  // to a real account, matching the original behavior for casual one-off use)
  const handleJoinAsGuest = () => {
    onAuth({ mode:"guest", trip: foundTrip });
  };


  const handleSignIn = async () => {
    if(!email||!pw){ setError("Enter email and password"); return; }
    setLoading(true); setError("");
    try {
      const res = await auth.signIn(email, pw);
      if(res.error) throw new Error(res.error.message||res.error.msg||JSON.stringify(res.error));
      if(!res.access_token) throw new Error("Sign in failed — check your email and password");
      try {
        if(rememberEmail) localStorage.setItem("matchup_remembered_email", email);
        else localStorage.removeItem("matchup_remembered_email");
      } catch(e){}
      onAuth({ mode:"auth", session: res });
    } catch(e){
      const msg = e.message||"";
      if(msg.includes("allowlist")||msg.includes("403")) setError("Connection blocked — add your URL to Supabase allowed origins in Settings → API");
      else setError(msg||"Sign in failed");
    }
    setLoading(false);
  };

  const handleSignUp = async () => {
    if(!email||!pw||!name){ setError("Fill in all fields"); return; }
    if(pw.length < 6){ setError("Password must be at least 6 characters"); return; }
    setLoading(true); setError("");
    try {
      const res = await auth.signUp(email, pw, name);
      // Show raw response for debugging
      const resStr = JSON.stringify(res).slice(0,200);
      if(res.error) throw new Error(res.error.message||res.error.msg||resStr);
      // Success if we got any of these
      if(res.access_token){
        onAuth({ mode:"auth", session: res });
      } else if(res.user || res.id) {
        // Have user but no token — try immediate sign in
        const signInRes = await auth.signIn(email, pw);
        if(signInRes.access_token){
          onAuth({ mode:"auth", session: signInRes });
        } else {
          setError("Account created! Please use Sign In tab to log in.");
        }
      } else {
        throw new Error("Unexpected response: " + resStr);
      }
    } catch(e){
      const msg = e.message||"";
      if(msg.includes("already registered")||msg.includes("already exists")) setError("Email already registered — use Sign In tab");
      else setError(msg||"Sign up failed");
    }
    setLoading(false);
  };

  const inp = (val,fn,ph,type="text") => (
    <input type={type} value={val} onChange={e=>fn(e.target.value)} placeholder={ph}
      style={{width:"100%",padding:"13px 14px",border:`2px solid ${val?C.forest:C.light}`,borderRadius:13,
        fontSize:14,fontFamily:"Arial,sans-serif",outline:"none",boxSizing:"border-box",
        background:val?C.mist:C.white,marginBottom:10}}/>
  );

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column"}}>
      <div style={{background:`linear-gradient(165deg,${C.forest},${C.turf})`,padding:"48px 32px 44px",display:"flex",flexDirection:"column",alignItems:"center",gap:12,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-40,right:-40,width:180,height:180,borderRadius:"50%",background:"rgba(255,255,255,.04)"}}/>
        <div style={{fontSize:54,marginBottom:4}}>⛳</div>
        <div style={{color:C.white,fontSize:28,fontWeight:700,letterSpacing:"-.5px"}}>MatchUp Golf</div>
        <div style={{color:"rgba(255,255,255,.6)",fontSize:12,fontFamily:"Arial,sans-serif",letterSpacing:"2px",textTransform:"uppercase"}}>Golf Trips Made Simple</div>
      </div>

      {/* Mode tabs */}
      <div style={{display:"flex",borderBottom:`1px solid ${C.light}`,background:C.white}}>
        {[["join","Join Trip"],["signin","Sign In"],["signup","Sign Up"]].map(([m,l])=>(
          <button key={m} onClick={()=>{setMode(m);setError("");}}
            style={{flex:1,padding:"12px 4px",border:"none",background:"transparent",fontSize:12,
              fontFamily:"Arial,sans-serif",fontWeight:600,cursor:"pointer",
              color:mode===m?C.forest:C.gray,
              borderBottom:mode===m?`2px solid ${C.forest}`:"2px solid transparent"}}>
            {l}
          </button>
        ))}
      </div>

      <div style={{flex:1,padding:"28px 24px",display:"flex",flexDirection:"column",gap:8}}>
        {error&&<div style={{background:C.redBg,color:C.red,padding:"10px 14px",borderRadius:10,fontSize:13,fontFamily:"Arial,sans-serif",marginBottom:4}}>{error}</div>}

        {mode==="join"&&joinStep==="code"&&(<>
          <div style={{fontSize:18,fontWeight:700,color:C.charcoal,marginBottom:4}}>Enter Trip Code</div>
          <div style={{fontSize:12,fontFamily:"Arial,sans-serif",color:C.gray,marginBottom:14}}>Get the 6-digit code from your trip organizer</div>
          <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:16}}>
            {code.map((c,i)=>(<input key={i} id={`ci${i}`} value={c} onChange={e=>upd(e.target.value,i)} onKeyDown={e=>kd(e,i)} maxLength={1}
              style={{width:44,height:52,border:`2px solid ${c?C.forest:C.light}`,borderRadius:12,textAlign:"center",fontSize:22,fontWeight:700,color:C.charcoal,background:c?C.mist:C.smoke,outline:"none",fontFamily:"Arial,sans-serif"}}/>))}
          </div>
          <button onClick={handleJoinCodeSubmit} disabled={loading} style={bigBtn(`linear-gradient(135deg,${C.forest},${C.fairway})`,C.white,{boxShadow:"0 6px 20px rgba(27,67,50,.28)"})}>
            {loading?"Checking…":"Continue →"}
          </button>
          <div style={{textAlign:"center",marginTop:8,fontSize:12,color:C.gray,fontFamily:"Arial,sans-serif"}}>
            Organizing a trip? <span onClick={()=>setMode("signup")} style={{color:C.forest,fontWeight:700,cursor:"pointer"}}>Create an account →</span>
          </div>
        </>)}

        {mode==="join"&&joinStep==="account"&&(<>
          <div style={{background:C.greenBg,borderRadius:10,padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:16}}>✓</span>
            <span style={{fontSize:13,color:C.green,fontFamily:"Arial,sans-serif",fontWeight:600}}>Found "{foundTrip?.name}"</span>
          </div>
          <div style={{fontSize:18,fontWeight:700,color:C.charcoal,marginBottom:4}}>Sign in or create an account</div>
          <div style={{fontSize:12,fontFamily:"Arial,sans-serif",color:C.gray,marginBottom:14}}>Already have an account? Just enter your existing email and password. New here? Fill in your name and we'll create one for you.</div>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name (as on the trip roster)"
            style={{padding:"14px 16px",border:`1.5px solid ${C.light}`,borderRadius:12,fontSize:15,fontFamily:"Arial,sans-serif",outline:"none",marginBottom:10}}/>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" type="email"
            style={{padding:"14px 16px",border:`1.5px solid ${C.light}`,borderRadius:12,fontSize:15,fontFamily:"Arial,sans-serif",outline:"none",marginBottom:10}}/>
          <input value={pw} onChange={e=>setPw(e.target.value)} placeholder="Password" type="password"
            style={{padding:"14px 16px",border:`1.5px solid ${C.light}`,borderRadius:12,fontSize:15,fontFamily:"Arial,sans-serif",outline:"none",marginBottom:14}}/>
          <button onClick={handleJoinFinish} disabled={loading} style={bigBtn(`linear-gradient(135deg,${C.forest},${C.fairway})`,C.white,{boxShadow:"0 6px 20px rgba(27,67,50,.28)"})}>
            {loading?"Joining…":"Join Trip →"}
          </button>
          <div style={{textAlign:"center",marginTop:10,display:"flex",flexDirection:"column",gap:6}}>
            <span onClick={handleJoinAsGuest} style={{fontSize:12,color:C.gray,fontFamily:"Arial,sans-serif",cursor:"pointer",textDecoration:"underline"}}>
              Just this once — continue as guest
            </span>
            <span onClick={()=>{setJoinStep("code");setError("");}} style={{fontSize:12,color:C.gray,fontFamily:"Arial,sans-serif",cursor:"pointer"}}>
              ← Back
            </span>
          </div>
        </>)}

        {mode==="signin"&&(<>
          <div style={{fontSize:18,fontWeight:700,color:C.charcoal,marginBottom:12}}>Welcome Back</div>
          {inp(email,setEmail,"Email","email")}
          {inp(pw,setPw,"Password","password")}
          <label style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,cursor:"pointer"}}>
            <input type="checkbox" checked={rememberEmail} onChange={e=>setRememberEmail(e.target.checked)}
              style={{width:18,height:18,accentColor:C.forest,cursor:"pointer"}}/>
            <span style={{fontSize:13,color:C.slate,fontFamily:"Arial,sans-serif"}}>Remember my email on this device</span>
          </label>
          <button onClick={handleSignIn} disabled={loading} style={bigBtn(`linear-gradient(135deg,${C.forest},${C.fairway})`,C.white)}>
            {loading?"Signing in…":"Sign In →"}
          </button>
        </>)}

        {mode==="signup"&&(<>
          <div style={{fontSize:18,fontWeight:700,color:C.charcoal,marginBottom:12}}>Create Account</div>
          {inp(name,setName,"Your name")}
          {inp(email,setEmail,"Email","email")}
          {inp(pw,setPw,"Password (6+ chars)","password")}
          <button onClick={handleSignUp} disabled={loading} style={bigBtn(`linear-gradient(135deg,${C.forest},${C.fairway})`,C.white)}>
            {loading?"Creating account…":"Create Account →"}
          </button>
        </>)}
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
// ─── SCRAMBLE DISPLAY HELPER ───────────────────────────────────────────────────
// For 4v4 scramble-style matches, returns clean "Team Red"/"Team Blue" labels
// and score-to-par strings instead of long player lists / raw match-play text
// Resolves a player key (lowercase name) back to their name exactly as
// entered on the trip roster — correct capitalization, spacing, etc. —
// rather than guessing or relying on the lowercase key itself. Falls back
// to the RAW demo roster when no real tripPlayers data exists yet.
// Computes display initials from a player's full name consistently across
// the whole app — always first-letter of first name + first-letter of last
// name (if present), otherwise first two letters of single name.
// "Louie Lachapelle" → "LL", "Louie" → "LO", "John Smith" → "JS"
const calcInitials = (name) => {
  if(!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if(parts.length >= 2) return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
  return parts[0].slice(0,2).toUpperCase();
};

const resolvePlayerName = (key, tripPlayers) => {
  const tp = tripPlayers?.find(p => p.name.toLowerCase() === key);
  if(tp) return tp.name;
  const raw = RAW.find(p => p.key === key);
  if(raw) return raw.name;
  // Last resort: title-case the key so it at least isn't all-lowercase
  return key.replace(/\b\w/g, c => c.toUpperCase());
};

const isScrambleFormat = m => (m.format||"").toLowerCase().includes("scramble");
const isXBallFormat = m => {
  const f = (m.format||"").toLowerCase();
  return f.includes("ball") && (f.includes("20")||f.includes("40"));
};

// For 20 Ball / 40 Ball matches: shows banked count AND net score-to-par per
// side on the Matches/Dashboard tabs, matching what's shown inside the live
// scoring screen itself.
const getXBallDisplay = (m, tripPlayers) => {
  const p1Team = (m.p1Keys||[]).map(k=>resolvePlayerTeam(k,tripPlayers)).find(Boolean) || "red";
  const p2Team = (m.p2Keys||[]).map(k=>resolvePlayerTeam(k,tripPlayers)).find(Boolean) || "blue";
  const p1Label = `Team ${p1Team==="red"?"Red":"Blue"}`;
  const p2Label = `Team ${p2Team==="red"?"Red":"Blue"}`;
  const target = (m.format||"").toLowerCase().includes("40") ? 40 : 20;

  const hs = m.holeScores || {};
  const banked = m.bankedScores || {};
  let pars = COURSES.mammoth.pars;
  if(m.hole_data){
    try {
      const parsed = typeof m.hole_data === "string" ? JSON.parse(m.hole_data) : m.hole_data;
      if(Array.isArray(parsed) && parsed.length === 18) pars = parsed.map(h=>h.par);
    } catch(e){}
  }

  const bankedNetForSide = (sideKeys) => {
    let count=0, netTotal=0;
    for(let h=1; h<=18; h++){
      const hBanked = banked[h] || {};
      const hScores = hs[h] || {};
      const par = pars[h-1] || 4;
      sideKeys.forEach(k=>{
        if(hBanked[k]){
          const gross = parseInt(hScores[k]);
          if(!isNaN(gross) && gross>0){
            count++;
            netTotal += (gross - par); // simple net-to-par; WHS strokes applied during live entry already reflected in gross if needed
          }
        }
      });
    }
    return {count, netTotal};
  };

  const p1Keys = m.p1Keys||[];
  const p2Keys = m.p2Keys||[];
  const r1 = bankedNetForSide(p1Keys);
  const r2 = bankedNetForSide(p2Keys);
  const fmtNet = n => n===0?"E":n>0?`+${n}`:`${n}`;

  return {
    p1Label, p2Label, p1Team, p2Team, target,
    p1Banked: r1.count, p2Banked: r2.count,
    p1Net: r1.count>0 ? fmtNet(r1.netTotal) : null,
    p2Net: r2.count>0 ? fmtNet(r2.netTotal) : null,
  };
};

const getScrambleDisplay = (m, tripPlayers) => {
  const p1Team = (m.p1Keys||[]).map(k=>resolvePlayerTeam(k,tripPlayers)).find(Boolean) || "red";
  const p2Team = (m.p2Keys||[]).map(k=>resolvePlayerTeam(k,tripPlayers)).find(Boolean) || "blue";
  const p1Label = `Team ${p1Team==="red"?"Red":"Blue"}`;
  const p2Label = `Team ${p2Team==="red"?"Red":"Blue"}`;

  // Compute totals + score-to-par from holeScores if present
  const hs = m.holeScores || {};
  let t1=0,t2=0,h1=0,h2=0;
  // Use real per-hole par data if the match has it, otherwise fall back to demo layout
  let pars = COURSES.mammoth.pars;
  if(m.hole_data){
    try {
      const parsed = typeof m.hole_data === "string" ? JSON.parse(m.hole_data) : m.hole_data;
      if(Array.isArray(parsed) && parsed.length === 18) pars = parsed.map(h=>h.par);
    } catch(e){ /* keep fallback */ }
  }
  for(let h=1;h<=18;h++){
    const s1=parseInt(hs[h]?.["team_p1"]), s2=parseInt(hs[h]?.["team_p2"]);
    if(!isNaN(s1)&&s1>0){t1+=s1;h1++;}
    if(!isNaN(s2)&&s2>0){t2+=s2;h2++;}
  }
  const toPar = (total,holes) => {
    if(holes===0) return null;
    const parSoFar = pars.slice(0,holes).reduce((a,b)=>a+b,0);
    const diff = total-parSoFar;
    return `${total} (${diff===0?"E":diff>0?`+${diff}`:diff})`;
  };
  // Score-to-par only (no stroke total) — used on Matches/Dashboard list views
  // where space is tight and the total isn't needed, just relative standing.
  const toParOnly = (total,holes) => {
    if(holes===0) return null;
    const parSoFar = pars.slice(0,holes).reduce((a,b)=>a+b,0);
    const diff = total-parSoFar;
    return diff===0?"E":diff>0?`+${diff}`:`${diff}`;
  };
  return {
    p1Label, p2Label, p1Team, p2Team,
    p1Score: toPar(t1,h1), p2Score: toPar(t2,h2),
    p1ScoreToPar: toParOnly(t1,h1), p2ScoreToPar: toParOnly(t2,h2),
    h1, h2,
  };
};

function DashboardScreen({go, goMatch, matches, ts, playerRecords, activeTrip, tripPlayers, sideGames, userInitials}){
  const live = matches.filter(m=>m.status==="live");
  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",background:C.smoke}}>
      <Header sub="⛳ MatchUp Golf" title={activeTrip?.name||"My Golf Trip"} detail={activeTrip?`Trip Code: ${activeTrip.join_code?.toUpperCase()}`:"Set up your trip to get started"} onProfile={()=>go("profile")} initials={userInitials}/>
      <div style={{flex:1,padding:"18px 16px",display:"flex",flexDirection:"column",gap:14,overflowY:"auto"}}>
        <TeamScoreCards ts={ts}/>
        {/* Live matches */}
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,padding:"0 2px"}}>
            <div style={{fontSize:15,fontWeight:700,color:C.charcoal}}>Live Now</div>
            <span onClick={()=>go("matches")} style={{fontSize:12,color:C.forest,fontFamily:"Arial,sans-serif",fontWeight:600,cursor:"pointer"}}>All Matches →</span>
          </div>
          {live.map(m=>{
            const isScr = isScrambleFormat(m);
            const isXB  = isXBallFormat(m);

            if(isXB){
              const xd = getXBallDisplay(m, tripPlayers);
              return(
                <div key={m.id} onClick={()=>goMatch(m.id,"live")} style={{...card({marginBottom:8,cursor:"pointer",border:`1.5px solid ${C.mint}`})}}>
                  <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6}}><div style={{width:6,height:6,borderRadius:"50%",background:C.green}}/><span style={{fontSize:10,color:C.green,fontFamily:"Arial,sans-serif",fontWeight:700}}>LIVE · {xd.target} BALL</span></div>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:xd.p1Team==="red"?C.red:C.blue,fontFamily:"Arial,sans-serif"}}>{xd.p1Label}</div>
                      <div style={{fontSize:9,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:-2,marginBottom:2}}>{(m.p1Keys||[]).map(k=>resolvePlayerName(k,tripPlayers)).join(", ")||m.p1}</div>
                      <div style={{fontSize:18,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>{xd.p1Net||"—"}<span style={{fontSize:12,color:C.gray,fontWeight:500}}> · {xd.p1Banked}/{xd.target}</span></div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:13,fontWeight:700,color:xd.p2Team==="red"?C.red:C.blue,fontFamily:"Arial,sans-serif"}}>{xd.p2Label}</div>
                      <div style={{fontSize:9,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:-2,marginBottom:2}}>{(m.p2Keys||[]).map(k=>resolvePlayerName(k,tripPlayers)).join(", ")||m.p2}</div>
                      <div style={{fontSize:18,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>{xd.p2Net||"—"}<span style={{fontSize:12,color:C.gray,fontWeight:500}}> · {xd.p2Banked}/{xd.target}</span></div>
                    </div>
                  </div>
                </div>
              );
            }

            if(isScr){
              const sd = getScrambleDisplay(m, tripPlayers);
              return(
                <div key={m.id} onClick={()=>goMatch(m.id,"live")} style={{...card({marginBottom:8,cursor:"pointer",border:`1.5px solid ${C.mint}`})}}>
                  <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6}}><div style={{width:6,height:6,borderRadius:"50%",background:C.green}}/><span style={{fontSize:10,color:C.green,fontFamily:"Arial,sans-serif",fontWeight:700}}>LIVE · SCRAMBLE</span></div>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:sd.p1Team==="red"?C.red:C.blue,fontFamily:"Arial,sans-serif"}}>{sd.p1Label}</div>
                      <div style={{fontSize:9,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:-2,marginBottom:2}}>{(m.p1Keys||[]).map(k=>resolvePlayerName(k,tripPlayers)).join(", ")||m.p1}</div>
                      <div style={{fontSize:18,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>{sd.p1ScoreToPar||"—"}</div>
                      {sd.h1>0&&<div style={{fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif"}}>thru {sd.h1}</div>}
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:13,fontWeight:700,color:sd.p2Team==="red"?C.red:C.blue,fontFamily:"Arial,sans-serif"}}>{sd.p2Label}</div>
                      <div style={{fontSize:9,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:-2,marginBottom:2}}>{(m.p2Keys||[]).map(k=>resolvePlayerName(k,tripPlayers)).join(", ")||m.p2}</div>
                      <div style={{fontSize:18,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>{sd.p2ScoreToPar||"—"}</div>
                      {sd.h2>0&&<div style={{fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif"}}>thru {sd.h2}</div>}
                    </div>
                  </div>
                </div>
              );
            }

            const p1Team=(m.p1Keys||[]).map(k=>resolvePlayerTeam(k,tripPlayers)).find(Boolean)||"red";
            const p2Team=(m.p2Keys||[]).map(k=>resolvePlayerTeam(k,tripPlayers)).find(Boolean)||"blue";
            const isSquare=!m.liveScore||m.liveScore.toLowerCase().includes("square");
            let topSide="p1";
            if(m.liveScore&&!isSquare){
              const ls=m.liveScore.toLowerCase();
              if(ls.includes("red")&&ls.includes("up"))  topSide=p1Team==="red"?"p1":"p2";
              if(ls.includes("blue")&&ls.includes("up")) topSide=p1Team==="blue"?"p1":"p2";
            }
            const topLabel =topSide==="p1"?m.p1:m.p2;
            const botLabel =topSide==="p1"?m.p2:m.p1;
            const topColor =topSide==="p1"?(p1Team==="red"?C.red:C.blue):(p2Team==="red"?C.red:C.blue);
            const hasLeader=!isSquare;
            return(
            <div key={m.id} onClick={()=>goMatch(m.id,"live")} style={{...card({marginBottom:8,cursor:"pointer",border:`1.5px solid ${C.mint}`,display:"flex",justifyContent:"space-between",alignItems:"center"})}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}><div style={{width:6,height:6,borderRadius:"50%",background:C.green}}/><span style={{fontSize:10,color:C.green,fontFamily:"Arial,sans-serif",fontWeight:700}}>LIVE</span></div>
                <div style={{fontSize:13,fontFamily:"Arial,sans-serif",fontWeight:hasLeader?700:500,color:hasLeader?topColor:C.charcoal}}>{topLabel}</div>
                <div style={{fontSize:11,fontFamily:"Arial,sans-serif",fontWeight:hasLeader?400:500,color:C.gray}}>vs {botLabel}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:15,fontWeight:700,color:scoreColor(m.liveScore),fontFamily:"Arial,sans-serif"}}>{m.liveScore}</div>
                <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif"}}>thru {m.thru}</div>
              </div>
            </div>
            );
          })}
        </div>
        {/* Schedule strip — grouped by round_name or date, only shown when
            matches actually have dates set so it doesn't show "Trip Day" garbage */}
        {(() => {
          const today = new Date().toISOString().split("T")[0];
          const fmtDate = (d) => {
            if(!d) return null;
            if(d===today) return "Today";
            const dt = new Date(d+"T12:00:00");
            const tom = new Date(); tom.setDate(tom.getDate()+1);
            if(d===tom.toISOString().split("T")[0]) return "Tomorrow";
            return dt.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
          };

          // Only include matches that have a real date set
          const dated = matches.filter(m=>m.match_date);
          if(dated.length===0) return null;

          // Group by round_name if set, otherwise by date
          const byKey = {};
          dated.forEach(m=>{
            const key = m.round_name || m.match_date;
            if(!byKey[key]) byKey[key] = {
              label: m.round_name || null,
              date:  m.match_date,
              matches: [],
            };
            byKey[key].matches.push(m);
          });

          const groups = Object.values(byKey)
            .sort((a,b)=>(a.date||"").localeCompare(b.date||""))
            .slice(0,4)
            .map(g=>({
              ...g,
              allDone: g.matches.every(m=>m.status==="completed"),
              anyLive: g.matches.some(m=>m.status==="live"),
              count:   g.matches.length,
              courses: [...new Set(g.matches.map(m=>m.course_name).filter(Boolean))],
            }));

          return(
            <div style={card()}>
              <div style={{fontSize:13,fontWeight:700,color:C.charcoal,marginBottom:10}}>Schedule</div>
              {groups.map((g,i)=>{
                const dateLabel = fmtDate(g.date);
                const isToday = g.date===today;
                const status = g.allDone?"done":g.anyLive?"live":"upcoming";
                return(
                  <div key={`${g.label||g.date}`}
                    style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                      padding:"8px 0",borderBottom:i<groups.length-1?`1px solid ${C.mist}`:"none",
                      opacity:status==="done"?.5:1}}>
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        {g.label&&<div style={{fontSize:12,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>{g.label}</div>}
                        {dateLabel&&<div style={{fontSize:g.label?11:12,fontWeight:g.label?400:700,
                          color:isToday?C.forest:g.label?C.gray:C.charcoal,fontFamily:"Arial,sans-serif"}}>{dateLabel}</div>}
                      </div>
                      <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:1}}>
                        {g.courses.length>0?`📍 ${g.courses.join(" · ")} · `:""}
                        {g.count} match{g.count!==1?"es":""}
                      </div>
                    </div>
                    <div>
                      {status==="live"    &&<div style={{...pill(C.greenBg,C.green),fontSize:10}}>LIVE</div>}
                      {status==="done"    &&<div style={{fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif"}}>Complete</div>}
                      {status==="upcoming"&&<div style={{fontSize:10,color:isToday?C.forest:C.slate,fontFamily:"Arial,sans-serif",fontWeight:isToday?700:400}}>{isToday?"Today":"Upcoming"}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
        {/* Money teaser — real standings derived from actual side games,
            not the fabricated demo numbers this used to show */}
        {(() => {
          const moneyByPlayer = {};
          const addMoney = (key, amt) => { moneyByPlayer[key] = (moneyByPlayer[key]||0) + amt; };
          (sideGames||[]).forEach(g=>{
            if(g.type==="nassau"){
              const result = deriveNassauForGroup(matches, g.side1Keys, g.side2Keys, g.betAmount, g.matchId);
              [result.front, result.back, result.overall].forEach(seg=>{
                if(seg.winner==="tie"||seg.winner==="none"||seg.amt===0) return;
                const winKeys = seg.winner==="side1" ? g.side1Keys : g.side2Keys;
                const loseKeys= seg.winner==="side1" ? g.side2Keys : g.side1Keys;
                winKeys.forEach(k=>addMoney(k, seg.amt));
                loseKeys.forEach(k=>addMoney(k, -seg.amt));
              });
            } else if(g.type==="skins"){
              const result = deriveSkinsForGroup(matches, g.poolKeys, g.betAmount, g.matchId);
              Object.entries(result.skinsByPlayer).forEach(([key,count])=>addMoney(key, count*g.betAmount));
            } else if(g.type==="wolf"){
              const result = deriveWolfForGroup(matches, g.poolKeys, g.betAmount, g.matchId);
              Object.entries(result.pointsByPlayer||{}).forEach(([key,pts])=>addMoney(key, pts));
            }
          });
          const standings = Object.entries(moneyByPlayer)
            .map(([key,money])=>({key, name:resolvePlayerName(key,tripPlayers), money}))
            .sort((a,b)=>b.money-a.money)
            .slice(0,3);

          if(standings.length===0) return null; // no side games yet — nothing fake to show instead

          return(
            <div style={{...card(),background:`linear-gradient(135deg,${C.forest}F5,${C.fairway}F5)`,cursor:"pointer"}} onClick={()=>go("payouts")}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:13,fontWeight:700,color:C.white}}>Money Standings</div>
                <span style={{fontSize:12,color:"rgba(255,255,255,.7)",fontFamily:"Arial,sans-serif"}}>Full Payouts →</span>
              </div>
              {standings.map(p=>(
                <div key={p.key} style={{display:"flex",justifyContent:"space-between",padding:"4px 0"}}>
                  <span style={{fontSize:13,color:"rgba(255,255,255,.85)",fontFamily:"Arial,sans-serif"}}>{p.name}</span>
                  <span style={{fontSize:13,fontWeight:700,color:p.money>0?"#74C69D":"#F1948A",fontFamily:"Arial,sans-serif"}}>{fmtMoney(p.money)}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── MATCHES ──────────────────────────────────────────────────────────────────
function MatchesScreen({go, goMatch, matches, ts, tripPlayers, activeTrip, userInitials}){
  const [expandedMatch,  setExpandedMatch]  = useState(null);
  const [showCompleted,  setShowCompleted]  = useState(false);

  const active   = matches.filter(m=>m.status==="live");
  const upcoming = matches.filter(m=>m.status==="upcoming");
  const done     = matches.filter(m=>m.status==="completed");

  const today = new Date().toISOString().split("T")[0];
  const fmtDate = (dateStr) => {
    if(!dateStr) return null;
    if(dateStr === today) return "Today";
    const d = new Date(dateStr+"T12:00:00");
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
    if(dateStr === tomorrow.toISOString().split("T")[0]) return "Tomorrow";
    return d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
  };

  // Group matches into rounds. If a match has a round_name set, group by that.
  // Otherwise fall back to date. This lets organizers say "Round 1" and have
  // all those matches appear together regardless of exact date, while still
  // working sensibly when no round name is set.
  const groupByRound = (arr) => {
    const byKey = {};
    arr.forEach(m=>{
      // Use round_name if set, otherwise fall back to date string
      const key = m.round_name ? m.round_name : (m.match_date || "unscheduled");
      if(!byKey[key]) byKey[key] = {
        key,
        label: m.round_name || null,
        date:  m.match_date || null,
        matches:[]
      };
      byKey[key].matches.push(m);
    });
    return Object.values(byKey).sort((a,b)=>{
      // Sort by the date of the first match in each group
      const ad = a.matches[0]?.match_date || "9999";
      const bd = b.matches[0]?.match_date || "9999";
      return ad.localeCompare(bd);
    });
  };

  const RoundHeader = ({label, date, matches: roundMatches}) => {
    const dateLabel = date ? fmtDate(date) : null;
    const isToday = date === today;
    // Collect unique course names across all matches in this round
    const courses = [...new Set((roundMatches||[]).map(m=>m.course_name).filter(Boolean))];
    const courseStr = courses.join(" · ");
    return(
      <div style={{marginBottom:6,marginTop:4}}>
        <div style={{display:"flex",alignItems:"baseline",gap:8}}>
          {label
            ? <div style={{fontSize:13,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>{label}</div>
            : <div style={{fontSize:13,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>{dateLabel||"Unscheduled"}</div>
          }
          {label&&dateLabel&&<div style={{fontSize:11,color:isToday?C.forest:C.gray,fontFamily:"Arial,sans-serif"}}>{dateLabel}</div>}
        </div>
        {courseStr&&<div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:1}}>📍 {courseStr}</div>}
      </div>
    );
  };

  const SectionHeader = ({label, count}) => (
    <div style={{fontSize:11,fontWeight:700,color:C.slate,fontFamily:"Arial,sans-serif",
      letterSpacing:.8,textTransform:"uppercase",padding:"4px 2px 8px"}}>
      {label}{count>0?` (${count})`:""}
    </div>
  );

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",background:C.smoke}}>
      <Header sub="⛳ MatchUp Golf" title="Matches" detail={activeTrip?.name||"Trip"} onProfile={()=>go("profile")} initials={userInitials}/>
      <div style={{flex:1,padding:"16px 16px 24px",display:"flex",flexDirection:"column",gap:4,overflowY:"auto"}}>

        {active.length===0 && upcoming.length===0 && done.length===0 && (
          <div style={{textAlign:"center",padding:"60px 20px",color:C.gray,fontFamily:"Arial,sans-serif",fontSize:14}}>
            No matches yet — tap + to create one.
          </div>
        )}

        {/* ── LIVE ── */}
        {active.length>0&&(
          <>
            <SectionHeader label="Live Now" count={active.length}/>
            {groupByRound(active).map(round=>(
              <div key={`${round.date}__${round.course}`} style={{marginBottom:8}}>
                {(active.length>1)&&<RoundHeader label={round.label} date={round.date} matches={round.matches}/>}
                {round.matches.map(m=>(
                  <MatchCard key={m.id} m={m} tripPlayers={tripPlayers} fmtDate={fmtDate}
                    showDate={active.length===1}
                    expanded={expandedMatch===m.id}
                    onTap={()=>goMatch(m.id,"live")}
                    goMatch={goMatch} go={go}/>
                ))}
              </div>
            ))}
            <div style={{height:8}}/>
          </>
        )}

        {/* ── UPCOMING ── */}
        {upcoming.length>0&&(
          <>
            <SectionHeader label="Upcoming" count={upcoming.length}/>
            {groupByRound(upcoming).map(round=>(
              <div key={`${round.date}__${round.course}`} style={{marginBottom:8}}>
                <RoundHeader label={round.label} date={round.date} matches={round.matches}/>
                {round.matches.map(m=>(
                  <MatchCard key={m.id} m={m} tripPlayers={tripPlayers} fmtDate={fmtDate}
                    showDate={false}
                    expanded={expandedMatch===m.id}
                    onTap={()=>goMatch(m.id,"live")}
                    goMatch={goMatch} go={go}/>
                ))}
              </div>
            ))}
            <div style={{height:8}}/>
          </>
        )}

        {/* ── COMPLETED — collapsed, grouped by round ── */}
        {done.length>0&&(
          <>
            <button onClick={()=>setShowCompleted(v=>!v)}
              style={{background:C.white,border:`1px solid ${C.light}`,borderRadius:12,
                padding:"11px 15px",cursor:"pointer",display:"flex",
                justifyContent:"space-between",alignItems:"center",width:"100%"}}>
              <span style={{fontSize:12,fontWeight:700,color:C.slate,fontFamily:"Arial,sans-serif",letterSpacing:.6,textTransform:"uppercase"}}>
                Completed ({done.length})
              </span>
              <span style={{fontSize:13,color:C.gray}}>{showCompleted?"▲ Hide":"▼ Show"}</span>
            </button>
            {showCompleted&&(
              <div style={{display:"flex",flexDirection:"column",gap:4,marginTop:4}}>
                {groupByRound(done).map(round=>(
                  <div key={`${round.date}__${round.course}`} style={{marginBottom:4}}>
                    <RoundHeader label={round.label} date={round.date} matches={round.matches}/>
                    {round.matches.map(m=>(
                      <MatchCard key={m.id} m={m} tripPlayers={tripPlayers} fmtDate={fmtDate}
                        showDate={false}
                        expanded={expandedMatch===m.id}
                        onTap={()=>setExpandedMatch(expandedMatch===m.id?null:m.id)}
                        goMatch={goMatch} go={go}/>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}


// ─── MATCH CARD COMPONENT ────────────────────────────────────────────────────
// Extracted from MatchesScreen — renders a single match card in the list.
// Props: m (match), tripPlayers, expanded (bool), onTap, goMatch, go
function MatchCard({m, tripPlayers, expanded, onTap, goMatch, go, fmtDate, showDate=false}){
  const p1Team = (m.p1Keys||[]).map(k=>resolvePlayerTeam(k,tripPlayers)).find(Boolean) || "red";
  const p2Team = (m.p2Keys||[]).map(k=>resolvePlayerTeam(k,tripPlayers)).find(Boolean) || "blue";

  let topSide="p1";
  if(m.status==="completed"){
    topSide = m.winnerSide==="halve"?"p1":m.winnerSide==="p1"?"p1":"p2";
  } else if(m.status==="live" && m.liveScore){
    const ls=m.liveScore.toLowerCase();
    if(ls.includes("red")&&ls.includes("up")) topSide=p1Team==="red"?"p1":"p2";
    else if(ls.includes("blue")&&ls.includes("up")) topSide=p1Team==="blue"?"p1":"p2";
  }

  const topLabel    = topSide==="p1"?m.p1:m.p2;
  const bottomLabel = topSide==="p1"?m.p2:m.p1;
  const topTeam     = topSide==="p1"?p1Team:p2Team;
  const botTeam     = topSide==="p1"?p2Team:p1Team;
  const topColor    = topTeam==="red"?C.red:C.blue;
  const botColor    = botTeam==="red"?C.red:C.blue;

  const isScr = isScrambleFormat(m);
  const isXB  = isXBallFormat(m);
  const scrDisplay = isScr ? getScrambleDisplay(m, tripPlayers) : null;
  const xbDisplay  = isXB  ? getXBallDisplay(m, tripPlayers)   : null;

  const scoreColor = s => {
    if(!s) return C.charcoal;
    const sl = s.toLowerCase();
    if(sl.includes("red")) return C.red;
    if(sl.includes("blue")) return C.blue;
    return C.charcoal;
  };

  return(
    <div style={{marginBottom:8}}>
      <div onClick={onTap}
        style={{background:C.white,borderRadius:14,padding:"13px 15px",
          border:expanded?`1.5px solid ${C.forest}33`:`1px solid ${C.mist}`,
          cursor:m.status==="upcoming"?"default":"pointer",
          display:"flex",justifyContent:"space-between",alignItems:"stretch",gap:10}}>

        {/* Left: players + status */}
        <div style={{flex:1,minWidth:0}}>
          {m.status==="completed"&&<div style={{fontSize:9,color:C.green,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",fontFamily:"Arial,sans-serif",marginBottom:3}}>✓ FINAL</div>}
          {m.status==="live"&&<div style={{fontSize:9,color:C.green,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",fontFamily:"Arial,sans-serif",marginBottom:3}}>● LIVE</div>}
          {m.status==="upcoming"&&<div style={{fontSize:9,color:C.gray,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",fontFamily:"Arial,sans-serif",marginBottom:3}}>UPCOMING</div>}

          {/* P1 label */}
          <div style={{fontSize:13,fontWeight:700,color:topColor,fontFamily:"Arial,sans-serif",
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {(isScr||isXB) ? (topSide==="p1"?(m.p1Keys||[]).map(k=>resolvePlayerName(k,tripPlayers)).join(", ")||m.p1 : (m.p2Keys||[]).map(k=>resolvePlayerName(k,tripPlayers)).join(", ")||m.p2) : topLabel}
            {m.status==="completed"&&m.winnerSide===topSide&&<span style={{marginLeft:5}}>★</span>}
          </div>
          <div style={{fontSize:12,color:C.slate,fontFamily:"Arial,sans-serif",marginTop:1,
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            vs {(isScr||isXB) ? (topSide==="p1"?(m.p2Keys||[]).map(k=>resolvePlayerName(k,tripPlayers)).join(", ")||m.p2 : (m.p1Keys||[]).map(k=>resolvePlayerName(k,tripPlayers)).join(", ")||m.p1) : bottomLabel}
          </div>

          {/* Date shown on card only when no separate round header is displayed */}
          {(showDate&&(m.match_date||m.course_name))&&(
            <div style={{fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:4}}>
              {m.round_name&&<span style={{fontWeight:600,color:C.forest}}>{m.round_name} · </span>}
              {fmtDate&&m.match_date?<span style={{fontWeight:600}}>{fmtDate(m.match_date)}{m.course_name?" · ":""}</span>:null}
              {m.course_name?`📍 ${m.course_name}${m.tee_name?` · ${m.tee_name}`:""}`:null}
            </div>
          )}
          <div style={{fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:1}}>{m.format||"Best Ball"}</div>
        </div>

        {/* Right: score / thru / action */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",justifyContent:"space-between",minWidth:70}}>
          {isScr&&m.status==="live"&&scrDisplay&&<>
            <div style={{display:"flex",alignItems:"center",gap:4,justifyContent:"flex-end"}}>
              <span style={{fontSize:13,fontWeight:700,color:scrDisplay.p1Team==="red"?C.red:C.blue}}>{scrDisplay.p1ScoreToPar||"—"}</span>
              {scrDisplay.h1>0&&<span style={{fontSize:10,color:C.gray}}>thru {scrDisplay.h1}</span>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:4,justifyContent:"flex-end"}}>
              <span style={{fontSize:12,fontWeight:700,color:scrDisplay.p2Team==="red"?C.red:C.blue}}>{scrDisplay.p2ScoreToPar||"—"}</span>
              {scrDisplay.h2>0&&<span style={{fontSize:10,color:C.gray}}>thru {scrDisplay.h2}</span>}
            </div>
            <button onClick={e=>{e.stopPropagation();goMatch(m.id,"live");}} style={{marginTop:6,background:C.forest,color:C.white,border:"none",borderRadius:8,padding:"5px 10px",fontSize:11,fontFamily:"Arial,sans-serif",fontWeight:700,cursor:"pointer"}}>Score →</button>
          </>}
          {isXB&&m.status==="live"&&xbDisplay&&<>
            <div style={{display:"flex",alignItems:"center",gap:4,justifyContent:"flex-end"}}>
              <span style={{fontSize:13,fontWeight:700,color:xbDisplay.p1Team==="red"?C.red:C.blue}}>{xbDisplay.p1Net||"—"}</span>
              <span style={{fontSize:10,color:C.gray}}>thru {xbDisplay.p1Banked}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:4,justifyContent:"flex-end"}}>
              <span style={{fontSize:12,fontWeight:700,color:xbDisplay.p2Team==="red"?C.red:C.blue}}>{xbDisplay.p2Net||"—"}</span>
              <span style={{fontSize:10,color:C.gray}}>thru {xbDisplay.p2Banked}</span>
            </div>
            <button onClick={e=>{e.stopPropagation();goMatch(m.id,"live");}} style={{marginTop:6,background:C.forest,color:C.white,border:"none",borderRadius:8,padding:"5px 10px",fontSize:11,fontFamily:"Arial,sans-serif",fontWeight:700,cursor:"pointer"}}>Score →</button>
          </>}
          {!isScr&&!isXB&&m.status==="live"&&<>
            <div style={{fontSize:14,fontWeight:700,color:scoreColor(m.liveScore)}}>{m.liveScore}</div>
            <div style={{fontSize:11,color:C.gray}}>thru {m.thru}</div>
            <button onClick={e=>{e.stopPropagation();goMatch(m.id,"live");}} style={{marginTop:6,background:C.forest,color:C.white,border:"none",borderRadius:8,padding:"5px 10px",fontSize:11,fontFamily:"Arial,sans-serif",fontWeight:700,cursor:"pointer"}}>Score →</button>
          </>}
          {m.status==="completed"&&<>
            <div style={{fontSize:13,fontWeight:700,color:C.charcoal,textAlign:"right"}}>{m.score||"—"}</div>
            <div style={{fontSize:10,color:C.gray,textAlign:"right",marginTop:2}}>
              {m.winnerSide==="halve"?"Halved":m.winnerSide==="p1"?`${m.p1} wins`:m.winnerSide==="p2"?`${m.p2} wins`:""}
            </div>
          </>}
          {m.status==="upcoming"&&(
            <button onClick={e=>{e.stopPropagation();goMatch(m.id,"live");}} style={{background:C.forest,color:C.white,border:"none",borderRadius:8,padding:"6px 10px",fontSize:11,fontFamily:"Arial,sans-serif",fontWeight:700,cursor:"pointer"}}>Start →</button>
          )}
        </div>
      </div>

      {/* Expanded completed detail */}
      {expanded&&m.status==="completed"&&(()=>{
        const realHoleData = (() => {
          if(!m.hole_data) return null;
          try { const p=typeof m.hole_data==="string"?JSON.parse(m.hole_data):m.hole_data; if(Array.isArray(p)&&p.length===18) return p; } catch(e){}
          return null;
        })();
        const course2 = {
          slope: m.slope||COURSES.mammoth.slope, rating: m.rating||COURSES.mammoth.rating,
          par: m.par||COURSES.mammoth.par,
          strokeIndex: realHoleData?realHoleData.map(h=>h.strokeIndex):COURSES.mammoth.strokeIndex,
          pars: realHoleData?realHoleData.map(h=>h.par):COURSES.mammoth.pars,
          name: m.course_name||COURSES.mammoth.name,
        };
        const allMatchKeys=[...(m.p1Keys||[]),...(m.p2Keys||[])];
        const realInM = tripPlayers?.length
          ? tripPlayers.filter(tp=>allMatchKeys.includes(tp.name.toLowerCase()))
              .map(tp=>({key:tp.name.toLowerCase(),name:tp.name,index:tp.hcp_index||0,team:tp.team||"red"}))
          : RAW.filter(p=>allMatchKeys.includes(p.key));
        const builtP=buildPlayers(realInM,course2,m.format||"Best Ball");
        const pByKey=Object.fromEntries(builtP.map(p=>[p.key,p]));
        const hs=m.holeScores||{};
        const allHoles=Array.from({length:18},(_,i)=>i+1).filter(h=>hs[h]&&Object.keys(hs[h]).length>0);
        return(
          <div style={{background:C.white,borderRadius:"0 0 14px 14px",border:`1px solid ${C.mist}`,
            borderTop:"none",padding:"10px 14px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontSize:11,color:C.slate,fontFamily:"Arial,sans-serif",fontWeight:600}}>
                {m.format||"Best Ball"}{m.course_name?` · ${m.course_name}`:""}
              </div>
              <button onClick={e=>{e.stopPropagation();go("matchedit");}}
                style={{background:"none",border:"none",color:C.forest,fontSize:12,fontFamily:"Arial,sans-serif",fontWeight:700,cursor:"pointer"}}>
                Edit ✏️
              </button>
            </div>

            {allHoles.length>0&&(
              <div style={{overflowX:"auto"}}>
                <div style={{display:"flex",gap:3,marginBottom:4}}>
                  <div style={{width:55,flexShrink:0,fontSize:9,color:C.gray,fontFamily:"Arial,sans-serif"}}>Hole</div>
                  {allHoles.map(h=><div key={h} style={{flex:1,minWidth:18,textAlign:"center",fontSize:9,color:C.gray,fontFamily:"Arial,sans-serif"}}>{h}</div>)}
                </div>
                {[...(m.p1Keys||[]),...(m.p2Keys||[])].map((key,ki)=>{
                  const side = ki<(m.p1Keys||[]).length?"p1":"p2";
                  const teamColor = side==="p1"?topColor:botColor;
                  const teamCol2  = resolvePlayerTeam(key,tripPlayers)||(side==="p1"?p1Team:p2Team);
                  const tc = teamCol2==="red"?C.red:C.blue;
                  const name = resolvePlayerName(key,tripPlayers);
                  return(
                    <div key={key} style={{display:"flex",gap:3,marginBottom:3,alignItems:"center"}}>
                      <div style={{width:55,flexShrink:0,fontSize:10,fontWeight:700,color:tc,fontFamily:"Arial,sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
                      {allHoles.map(h=>{
                        const gross=parseInt(hs[h]?.[key]);
                        const par=course2.pars[h-1]||4;
                        const rel=!isNaN(gross)?gross-par:null;
                        const bg=rel===null?C.smoke:rel<=-1?C.greenBg:rel===0?C.white:rel===1?C.redBg:"#FDBA74";
                        const wt2=resolvePlayerTeam(key,tripPlayers)||(side==="p1"?p1Team:p2Team);
                        return(
                          <div key={h} style={{flex:1,minWidth:18,height:20,borderRadius:4,background:bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
                            <span style={{fontSize:9,fontWeight:600,color:rel===null?C.light:C.charcoal,fontFamily:"Arial,sans-serif"}}>{!isNaN(gross)?gross:"·"}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}


// ─── MATCH EDIT SCREEN ────────────────────────────────────────────────────────
function MatchEditScreen({go, goBack, matchId, matches, updateMatch, tripPlayers}){
  const match  = matches.find(m=>m.id===matchId && m.status==="completed")
              || matches.find(m=>m.status==="completed")
              || matches[0];
  const round  = null; // ROUNDS lookup removed — use match's own saved fields below
  const realHoleData = (() => {
    if(!match.hole_data) return null;
    try {
      const parsed = typeof match.hole_data==="string" ? JSON.parse(match.hole_data) : match.hole_data;
      if(Array.isArray(parsed) && parsed.length===18) return parsed;
    } catch(e){}
    return null;
  })();
  const course = {
    slope:       match.slope  || COURSES.mammoth.slope,
    rating:      match.rating || COURSES.mammoth.rating,
    par:         match.par    || COURSES.mammoth.par,
    strokeIndex: realHoleData ? realHoleData.map(h=>h.strokeIndex) : COURSES.mammoth.strokeIndex,
    pars:        realHoleData ? realHoleData.map(h=>h.par)         : COURSES.mammoth.pars,
    name:        match.course_name || COURSES.mammoth.name,
  };
  const format = match.format || "Best Ball";

  // ── Build players from real tripPlayers first, falling back to RAW demo ──────
  const allMatchKeys = [...(match.p1Keys||[]), ...(match.p2Keys||[])];
  const rawInMatch = tripPlayers?.length
    ? tripPlayers.filter(tp=>allMatchKeys.includes(tp.name.toLowerCase()))
        .map(tp=>({key:tp.name.toLowerCase(), name:tp.name, index:tp.hcp_index||0, team:tp.team||"red"}))
    : RAW.filter(p=>allMatchKeys.includes(p.key));
  const builtPlayers = buildPlayers(rawInMatch, course, format);
  const playerByKey  = Object.fromEntries(builtPlayers.map(p=>[p.key, p]));

  // Parse non-RAW partner names — key must be lowercase first name to match holeScores keys
  // e.g. "John / Tony" with p1Keys:["john"] → Tony gets key "tony" (matches holeScores.tony)
  const parsePartnerNames = (pairingStr, rawKeys) => {
    const rawNames = rawKeys.map(k=>RAW.find(p=>p.key===k)?.name||"").filter(Boolean);
    return pairingStr.split("/").map(n=>n.trim())
      .filter(n=>n && !rawNames.some(rn=>rn.toLowerCase()===n.toLowerCase()))
      .map(n=>({key:n.toLowerCase(), name:n, isExternal:true}));
  };

  const p1RawPlayers = (match.p1Keys||[]).map(k=>RAW.find(p=>p.key===k)).filter(Boolean);
  const p2RawPlayers = (match.p2Keys||[]).map(k=>RAW.find(p=>p.key===k)).filter(Boolean);
  const p1ExtPlayers = parsePartnerNames(match.p1||"", match.p1Keys||[]);
  const p2ExtPlayers = parsePartnerNames(match.p2||"", match.p2Keys||[]);

  // Combined: RAW first (have WHS/net), then external (gross only)
  const p1Players = [...p1RawPlayers, ...p1ExtPlayers];
  const p2Players = [...p2RawPlayers, ...p2ExtPlayers];

  // ── State seeded from match.holeScores ──────────────────────────────────────
  const [scoreTab,      setScoreTab]      = useState("Scores");
  const [locked,        setLocked]        = useState(false);
  const [confirm,       setConfirm]       = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [holeOverrides, setHoleOverrides] = useState({});
  const [holeScores,    setHoleScores]    = useState(()=>{
    // Seed from match.holeScores; fill in empty holes for all 18
    const seed = match.holeScores || {};
    const out  = {};
    for(let h=1;h<=18;h++) out[h] = seed[h] ? {...seed[h]} : {};
    return out;
  });

  // Net score per player per hole:
  // - RAW players (in playerByKey): use pre-built WHS match strokes
  // - Guest players (in GUEST_PLAYERS): compute net using their handicap index
  // - Unknown player: use gross as-is
  // Returns null if no score entered
  const getNet = (key, h) => {
    const gross = parseInt(holeScores[h]?.[key]);
    if(isNaN(gross) || gross <= 0) return null;
    // RAW player — pre-built
    const rawP = playerByKey[key];
    if(rawP) return gross - sOnHole(rawP.ms, course.strokeIndex[h-1]);
    // Guest player with handicap — compute match strokes on the fly
    const guestP = GUEST_PLAYERS[key];
    if(guestP){
      const sideKeys = p1AllKeys.includes(key) ? p1AllKeys : p2AllKeys;
      // Collect all PHs on this side (RAW + this guest)
      const sidePHs = sideKeys.map(k=>{
        const rp=playerByKey[k];
        if(rp) return rp.ph;
        const gp=GUEST_PLAYERS[k];
        if(gp){
          const ch=Math.round(gp.index*(course.slope/113)+(course.rating-course.par));
          return Math.round(ch*(format.toLowerCase().includes("singles")?1.0:0.90));
        }
        return null;
      }).filter(v=>v!==null);
      const guestCH = Math.round(guestP.index*(course.slope/113)+(course.rating-course.par));
      const guestPH = Math.round(guestCH*(format.toLowerCase().includes("singles")?1.0:0.90));
      const minPH   = Math.min(...sidePHs, guestPH);
      const guestMS = Math.max(0, guestPH - minPH);
      return gross - sOnHole(guestMS, course.strokeIndex[h-1]);
    }
    // Unknown external: gross as-is
    return gross;
  };

  // Best score for a side on a hole — uses ALL players in the pairing
  // p1AllKeys = RAW keys + external keys derived from pairing string
  const p1AllKeys = [
    ...(match.p1Keys||[]),
    ...p1ExtPlayers.map(p=>p.key),
  ];
  const p2AllKeys = [
    ...(match.p2Keys||[]),
    ...p2ExtPlayers.map(p=>p.key),
  ];

  const bestNetSide = (side, h) => {
    const keys = side==="p1" ? p1AllKeys : p2AllKeys;
    const nets  = keys.map(k=>getNet(k,h)).filter(v=>v!==null);
    return nets.length ? Math.min(...nets) : null;
  };

  // Derive hole winner live from gross scores + WHS — null if no scores entered for that hole
  const derivedHoleResults = Object.fromEntries(
    Array.from({length:18},(_,i)=>i+1).map(h=>{
      const n1 = bestNetSide("p1", h);
      const n2 = bestNetSide("p2", h);
      if(n1===null && n2===null) return [h, null];   // no scores yet
      if(n1===null) return [h,"p2"];
      if(n2===null) return [h,"p1"];
      if(n1 < n2)  return [h,"p1"];
      if(n2 < n1)  return [h,"p2"];
      return [h,"tie"];
    })
  );

  const holeResult = h => holeOverrides[h] ?? derivedHoleResults[h] ?? null;

  // Count only holes that have an actual result (score entered or manually overridden)
  const holeResultList = Array.from({length:18},(_,i)=>i+1)
    .map(h=>holeResult(h))
    .filter(r=>r!==null);

  // Compute proper match play result — only from holes with scores
  // Returns the result as the match would stand at that point
  const computeMatchScore = () => {
    // For a COMPLETED match, the result was already locked in and saved the
    // moment the match finished (see finishMatch / the "decidedAt" freeze
    // logic in LiveMatchScreen). Re-deriving it here from current hole data
    // is exactly what caused completed matches to show a different, wrong
    // result on revisit (e.g. "1&0" instead of the real "2&1") — so for any
    // completed match we simply trust what was saved, never recompute.
    if(match.status==="completed" && match.score){
      return {winnerSide: match.winnerSide, text: match.score};
    }

    let p1=0, p2=0, tied=0;
    let closedAt = null;
    for(let h=1;h<=18;h++){
      const r = holeResult(h);
      if(r===null) continue;  // skip holes with no scores
      if(r==="p1") p1++;
      else if(r==="p2") p2++;
      else if(r==="tie") tied++;
      const played=p1+p2+tied, diff=p1-p2, rem=18-h;
      // Check if match was already decided (dormie/closed)
      if(diff > rem)  { closedAt=h; break; }
      if(-diff > rem) { closedAt=h; break; }
    }
    const totalPlayed = p1+p2+tied;
    const diff = p1-p2;
    const rem  = 18 - totalPlayed;

    if(totalPlayed===0) return {winnerSide:match.winnerSide, text:match.score||"—"};

    // Match closed early (e.g. 3&2)
    if(closedAt!==null){
      const absDiff = Math.abs(diff);
      const holesRemaining = 18 - closedAt;
      if(diff>0) return {winnerSide:"p1", text:`${absDiff}&${holesRemaining}`};
      return              {winnerSide:"p2", text:`${absDiff}&${holesRemaining}`};
    }

    // Full 18 played
    if(totalPlayed===18){
      if(diff>0) return {winnerSide:"p1",   text:"1UP"};
      if(diff<0) return {winnerSide:"p2",   text:"1UP"};
      return            {winnerSide:"halve", text:"All Square"};
    }

    // In progress (partial scores)
    if(diff===0) return {winnerSide:"halve", text:`All Square thru ${totalPlayed}`};
    const leader = diff>0?"p1":"p2";
    const leaderName = diff>0 ? match.p1 : match.p2;
    return {winnerSide:leader, text:`${leaderName} ${Math.abs(diff)}UP thru ${totalPlayed}`};
  };

  const matchScore  = computeMatchScore();
  const winTeam     = matchScore.winnerSide==="halve" ? null
    : matchScore.winnerSide==="p1" ? matchWinningTeam({...match,winnerSide:"p1"},tripPlayers)
    : matchWinningTeam({...match,winnerSide:"p2"},tripPlayers);
  const resultColor = winTeam==="red"?C.sand:winTeam==="blue"?"#85C1E9":"rgba(255,255,255,.85)";

  // Side team colors — derived from actual players, not hardcoded
  const p1TeamColor = p1RawPlayers.length ? teamColor(p1RawPlayers[0].team) : C.red;
  const p2TeamColor = p2RawPlayers.length ? teamColor(p2RawPlayers[0].team) : C.blue;

  // ── Save ─────────────────────────────────────────────────────────────────────
  const saveEdit = () => {
    const cleanScores = {};
    for(let h=1;h<=18;h++){
      const hData = holeScores[h]||{};
      if(Object.keys(hData).some(k=>hData[k]!=="")) cleanScores[h]={...hData};
    }
    // Only save a final winnerSide if match is definitively decided
    const finalWinner = (()=>{
      const ms = matchScore;
      // If text contains "thru" it's partial — keep existing winnerSide
      if(ms.text.includes("thru")) return match.winnerSide;
      return ms.winnerSide;
    })();
    updateMatch(match.id, {
      winnerSide: finalWinner,
      score:      matchScore.text.replace(/ thru \d+/,""), // strip "thru N" from score string
      status:     "completed",
      holeScores: cleanScores,
    });
    setSaved(true);
    setTimeout(()=>{ setSaved(false); go("matches"); }, 800);
  };

  const playerTotal = (key, holes) =>
    holes.reduce((s,h)=>{ const v=parseInt(holeScores[h]?.[key]); return s+(isNaN(v)?0:v); }, 0);

  // ── Render ──────────────────────────────────────────────────────────────────
  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",background:C.smoke}}>
      <div style={{background:`linear-gradient(135deg,${C.forest},${C.fairway})`,padding:"14px 20px 18px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <BackBtn goBack={goBack} go={go} to="matches"/>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {locked
              ? <span style={{...pill(C.amberBg,C.amber),fontSize:11}}>🔒 Locked</span>
              : <span style={{...pill(C.greenBg,C.green),fontSize:11}}>Edit Open</span>}
            <button onClick={()=>setLocked(!locked)}
              style={{background:"rgba(255,255,255,.15)",border:"none",color:C.white,borderRadius:8,padding:"5px 10px",fontSize:11,cursor:"pointer",fontFamily:"Arial,sans-serif"}}>
              {locked?"Unlock (Admin)":"Simulate Lock"}
            </button>
          </div>
        </div>
        <div style={{color:"rgba(255,255,255,.6)",fontSize:11,fontFamily:"Arial,sans-serif",letterSpacing:"1.2px",textTransform:"uppercase",marginBottom:3}}>Edit Match Result</div>
        <div style={{color:C.white,fontSize:17,fontWeight:700}}>{match.p1} vs {match.p2}</div>
        <div style={{color:"rgba(255,255,255,.6)",fontSize:12,fontFamily:"Arial,sans-serif",marginTop:2}}>
          {round?.name} · {course.name} · {format}
        </div>
        {/* Live derived result */}
        <div style={{marginTop:8,background:"rgba(0,0,0,.18)",borderRadius:10,padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:10,color:"rgba(255,255,255,.55)",fontFamily:"Arial,sans-serif",letterSpacing:.8,textTransform:"uppercase",marginBottom:2}}>Derived Result</div>
            <div style={{fontSize:18,fontWeight:700,color:resultColor}}>{matchScore.text}</div>
          </div>
          <div style={{textAlign:"right",fontSize:11,color:"rgba(255,255,255,.55)",fontFamily:"Arial,sans-serif"}}>
            Live · WHS applied<br/>Edit scores below
          </div>
        </div>
      </div>

      <div style={{flex:1,padding:16,display:"flex",flexDirection:"column",gap:12,overflowY:"auto"}}>

        {/* Lock notice */}
        <div style={{...card({background:locked?C.amberBg:C.greenBg,border:`1px solid ${locked?C.amber:C.mint}`})}}>
          <div style={{fontSize:13,fontWeight:700,color:locked?C.amber:C.green,marginBottom:3}}>
            {locked?"🔒 Edit window closed":"✏️ Edit window open — closes 72 hrs after match"}
          </div>
          <div style={{fontSize:12,color:C.slate,fontFamily:"Arial,sans-serif",lineHeight:1.5}}>
            {locked
              ? "Only the Trip Organizer can override. Tap Unlock (Admin) to demonstrate."
              : "Any player can correct this result within 72 hours. Changes are logged."}
          </div>
        </div>

        {/* Scorecard tabs */}
        <div style={card()}>
          <div style={{fontSize:13,fontWeight:700,color:C.charcoal,marginBottom:8}}>Hole-by-Hole Scorecard</div>
          <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif",marginBottom:10}}>
            {scoreTab==="Scores"
              ? "Enter gross scores — net scores (WHS) auto-determine hole winners. Result updates live."
              : "Hole winners derived from scores. Tap to override manually."}
          </div>
          <div style={{display:"flex",gap:6,marginBottom:14}}>
            {["Scores","Winners"].map(t=>(
              <button key={t} onClick={()=>setScoreTab(t)}
                style={{background:scoreTab===t?C.forest:"transparent",color:scoreTab===t?C.white:C.gray,
                  border:`1.5px solid ${scoreTab===t?C.forest:C.light}`,borderRadius:20,padding:"5px 14px",
                  fontSize:11,fontFamily:"Arial,sans-serif",fontWeight:600,cursor:"pointer"}}>
                {t}
              </button>
            ))}
          </div>

          {/* ── SCORES TAB ── */}
          {scoreTab==="Scores"&&(
            <>
              {[
                {label:"Front 9", holes:Array.from({length:9},(_,i)=>i+1)},
                {label:"Back 9",  holes:Array.from({length:9},(_,i)=>i+10)},
              ].map(({label,holes})=>(
                <div key={label} style={{marginBottom:16}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.gray,fontFamily:"Arial,sans-serif",letterSpacing:.8,textTransform:"uppercase",marginBottom:6}}>{label}</div>

                  {/* Hole numbers header */}
                  <div style={{display:"flex",gap:3,marginBottom:3}}>
                    <div style={{width:46,flexShrink:0}}/>
                    {holes.map(h=>(<div key={h} style={{flex:1,textAlign:"center",fontSize:10,fontWeight:700,color:C.gray,fontFamily:"Arial,sans-serif"}}>{h}</div>))}
                    <div style={{width:28,textAlign:"center",fontSize:10,fontWeight:700,color:C.gray,fontFamily:"Arial,sans-serif"}}>Tot</div>
                  </div>

                  {/* Par row */}
                  <div style={{display:"flex",gap:3,marginBottom:6,alignItems:"center"}}>
                    <div style={{width:46,fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif",flexShrink:0}}>Par</div>
                    {holes.map(h=>(<div key={h} style={{flex:1,textAlign:"center",fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif"}}>{course.pars[h-1]}</div>))}
                    <div style={{width:28,textAlign:"center",fontSize:10,fontWeight:700,color:C.gray,fontFamily:"Arial,sans-serif"}}>{holes.reduce((s,h)=>s+course.pars[h-1],0)}</div>
                  </div>

                  {/* P1 side label */}
                  <div style={{fontSize:10,fontWeight:700,color:p1TeamColor,fontFamily:"Arial,sans-serif",letterSpacing:.5,textTransform:"uppercase",marginBottom:4,paddingLeft:2}}>{match.p1}</div>
                  {p1Players.map(player=>{
                    const isExt = player.isExternal;
                    const total = playerTotal(player.key, holes);
                    return(
                      <div key={player.key} style={{display:"flex",gap:3,marginBottom:4,alignItems:"center"}}>
                        <div style={{width:46,fontSize:11,fontWeight:700,color:isExt?C.gray:p1TeamColor,fontFamily:"Arial,sans-serif",flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {player.name}{isExt&&<span style={{fontSize:8,color:C.gray}}> *</span>}
                        </div>
                        {holes.map(h=>{
                          const val   = holeScores[h]?.[player.key] ?? "";
                          const gross = parseInt(val);
                          const par   = course.pars[h-1];
                          const net   = getNet(player.key, h); // works for both RAW and ext now
                          const res   = holeResult(h);
                          const winning = res==="p1" && net!==null && net===bestNetSide("p1",h);
                          const bg = !isNaN(gross)&&gross>0
                            ?(gross<par?C.greenBg:gross===par?C.white:gross===par+1?C.amberBg:C.redBg)
                            :C.smoke;
                          return(
                            <div key={h} style={{flex:1,position:"relative"}}>
                              <input type="number" min="1" max="15" value={val}
                                onChange={e=>!locked&&setHoleScores(prev=>({...prev,[h]:{...(prev[h]||{}),[player.key]:e.target.value}}))}
                                disabled={locked}
                                style={{width:"100%",height:28,border:`1.5px solid ${winning?"#27AE60":C.light}`,borderRadius:5,textAlign:"center",fontSize:11,fontWeight:700,color:C.charcoal,outline:"none",fontFamily:"Arial,sans-serif",background:bg,padding:0,boxSizing:"border-box"}}
                              />
                              {net!==null&&(
                                <div style={{textAlign:"center",fontSize:8,color:winning?"#27AE60":isExt?C.gray:p1TeamColor,fontFamily:"Arial,sans-serif",marginTop:1}}>
                                  {isExt?`g${net}`:`n${net}`}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <div style={{width:28,textAlign:"center",fontSize:11,fontWeight:700,color:isExt?C.gray:p1TeamColor,fontFamily:"Arial,sans-serif"}}>{total>0?total:"—"}</div>
                      </div>
                    );
                  })}

                  {/* P2 side label */}
                  <div style={{fontSize:10,fontWeight:700,color:p2TeamColor,fontFamily:"Arial,sans-serif",letterSpacing:.5,textTransform:"uppercase",marginBottom:4,paddingLeft:2,marginTop:8}}>{match.p2}</div>
                  {p2Players.map(player=>{
                    const isExt = player.isExternal;
                    const total = playerTotal(player.key, holes);
                    return(
                      <div key={player.key} style={{display:"flex",gap:3,marginBottom:4,alignItems:"center"}}>
                        <div style={{width:46,fontSize:11,fontWeight:700,color:isExt?C.gray:p2TeamColor,fontFamily:"Arial,sans-serif",flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {player.name}{isExt&&<span style={{fontSize:8,color:C.gray}}> *</span>}
                        </div>
                        {holes.map(h=>{
                          const val   = holeScores[h]?.[player.key] ?? "";
                          const gross = parseInt(val);
                          const par   = course.pars[h-1];
                          const net   = getNet(player.key, h);
                          const res   = holeResult(h);
                          const winning = res==="p2" && net!==null && net===bestNetSide("p2",h);
                          const bg = !isNaN(gross)&&gross>0
                            ?(gross<par?C.greenBg:gross===par?C.white:gross===par+1?C.amberBg:C.redBg)
                            :C.smoke;
                          return(
                            <div key={h} style={{flex:1,position:"relative"}}>
                              <input type="number" min="1" max="15" value={val}
                                onChange={e=>!locked&&setHoleScores(prev=>({...prev,[h]:{...(prev[h]||{}),[player.key]:e.target.value}}))}
                                disabled={locked}
                                style={{width:"100%",height:28,border:`1.5px solid ${winning?"#27AE60":C.light}`,borderRadius:5,textAlign:"center",fontSize:11,fontWeight:700,color:C.charcoal,outline:"none",fontFamily:"Arial,sans-serif",background:bg,padding:0,boxSizing:"border-box"}}
                              />
                              {net!==null&&(
                                <div style={{textAlign:"center",fontSize:8,color:winning?"#27AE60":isExt?C.gray:p2TeamColor,fontFamily:"Arial,sans-serif",marginTop:1}}>
                                  {isExt?`g${net}`:`n${net}`}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <div style={{width:28,textAlign:"center",fontSize:11,fontWeight:700,color:isExt?C.gray:p2TeamColor,fontFamily:"Arial,sans-serif"}}>{total>0?total:"—"}</div>
                      </div>
                    );
                  })}

                  {/* Hole result row */}
                  <div style={{display:"flex",gap:3,marginTop:6,alignItems:"center"}}>
                    <div style={{width:46,fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif",flexShrink:0}}>Result</div>
                    {holes.map(h=>{
                      const res=holeResult(h);
                      const wt = res==="p1"?matchWinningTeam({...match,winnerSide:"p1"},tripPlayers)
                               : res==="p2"?matchWinningTeam({...match,winnerSide:"p2"},tripPlayers)
                               : res==="tie"?"tie":null;
                      return(
                        <div key={h} style={{flex:1,height:16,borderRadius:4,
                          background:wt==="red"?C.redBg:wt==="blue"?C.blueBg:wt==="tie"?C.mist:"transparent",
                          display:"flex",alignItems:"center",justifyContent:"center"}}>
                          <span style={{fontSize:9,fontWeight:700,color:wt==="red"?C.red:wt==="blue"?C.blue:C.gray,fontFamily:"Arial,sans-serif"}}>
                            {wt==="red"?"R":wt==="blue"?"B":wt==="tie"?"–":"·"}
                          </span>
                        </div>
                      );
                    })}
                    <div style={{width:28}}/>
                  </div>
                </div>
              ))}

              {/* Totals */}
              <div style={{background:C.mist,borderRadius:10,padding:"10px 12px",marginTop:4}}>
                <div style={{fontSize:11,fontWeight:700,color:C.slate,fontFamily:"Arial,sans-serif",marginBottom:6}}>18-Hole Totals</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {[...p1Players,...p2Players].map((player,pi)=>{
                    const teamCol = pi<p1Players.length?C.red:C.blue;
                    const total18 = playerTotal(player.key, Array.from({length:18},(_,i)=>i+1));
                    const diff = total18-course.par;
                    return(
                      <div key={player.key} style={{flex:1,background:C.white,borderRadius:8,padding:"8px 6px",textAlign:"center",minWidth:52}}>
                        <div style={{fontSize:13,fontWeight:700,color:teamCol,fontFamily:"Arial,sans-serif"}}>{total18>0?total18:"—"}</div>
                        <div style={{fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:1}}>{player.name}</div>
                        {total18>0&&<div style={{fontSize:10,fontWeight:600,color:diff<0?C.green:diff===0?C.gray:C.red,fontFamily:"Arial,sans-serif"}}>{diff===0?"E":diff>0?`+${diff}`:diff}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:6,background:C.mist,borderRadius:8,padding:"7px 10px"}}>
                Color: <span style={{color:C.green,fontWeight:700}}>eagle/birdie</span> · even · <span style={{color:C.amber,fontWeight:700}}>bogey</span> · <span style={{color:C.red,fontWeight:700}}>double+</span> · Green border = hole winner net score<br/>
                * Guest players — gross scores only, not used for net calculation
              </div>
            </>
          )}

          {/* ── WINNERS TAB ── */}
          {scoreTab==="Winners"&&(
            <>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {Array.from({length:18},(_,i)=>i+1).map(h=>{
                  const res = holeResult(h);
                  const isOverridden = holeOverrides[h]!==undefined;
                  const wt = res==="p1"?matchWinningTeam({...match,winnerSide:"p1"},tripPlayers)
                           : res==="p2"?matchWinningTeam({...match,winnerSide:"p2"},tripPlayers)
                           : res==="tie"?"tie":null;
                  return(
                    <div key={h} onClick={()=>{
                      if(locked)return;
                      const next=res==="p1"?"p2":res==="p2"?"tie":"p1";
                      setHoleOverrides(prev=>({...prev,[h]:next}));
                    }} style={{width:42,borderRadius:10,padding:"6px 0",
                      background:wt==="red"?C.redBg:wt==="blue"?C.blueBg:C.mist,
                      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,
                      cursor:locked?"not-allowed":"pointer",
                      border:`1.5px solid ${isOverridden?"#E67E2266":wt==="red"?C.red+"33":wt==="blue"?C.blue+"33":C.light}`}}>
                      <div style={{fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif"}}>{h}</div>
                      <div style={{fontSize:12,fontWeight:700,color:wt==="red"?C.red:wt==="blue"?C.blue:C.gray,fontFamily:"Arial,sans-serif"}}>
                        {wt==="red"?"R":wt==="blue"?"B":wt==="tie"?"–":"·"}
                      </div>
                      {isOverridden&&<div style={{fontSize:8,color:C.amber}}>edit</div>}
                    </div>
                  );
                })}
              </div>
              <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:8,lineHeight:1.5}}>
                Winners auto-derived from scores + WHS. Tap to override (amber = manual). <span onClick={()=>setHoleOverrides({})} style={{color:C.forest,cursor:"pointer",fontWeight:600}}>Reset overrides</span>
              </div>
            </>
          )}
        </div>

        {/* Edit log */}
        <div style={card()}>
          <div style={{fontSize:13,fontWeight:700,color:C.charcoal,marginBottom:10}}>Edit Log</div>
          {[
            {by:"System",time:"Thu 1:00 PM",note:"Match result entered automatically"},
            {by:"Louie", time:"Thu 3:15 PM",note:"Score corrected — Hole 14 updated"},
          ].map((entry,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:i<1?`1px solid ${C.mist}`:"none"}}>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>{entry.by}</div>
                <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif"}}>{entry.note}</div>
              </div>
              <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif"}}>{entry.time}</div>
            </div>
          ))}
        </div>

        {/* Save */}
        {!locked&&(
          <>
            {!confirm
              ? <button onClick={()=>setConfirm(true)} style={bigBtn(`linear-gradient(135deg,${C.forest},${C.fairway})`,C.white,{boxShadow:"0 6px 20px rgba(27,67,50,.25)"})}>
                  Save Changes
                </button>
              : <div style={card({background:C.redBg,border:`1px solid ${C.red}33`})}>
                  <div style={{fontSize:13,fontWeight:700,color:C.red,marginBottom:8}}>Confirm save?</div>
                  <div style={{fontSize:12,color:C.slate,fontFamily:"Arial,sans-serif",marginBottom:12}}>
                    Result: <strong>{matchScore.text}</strong>. {matchScore.winnerSide==="halve"?"Both teams earn ½ point.":"The winning team earns 1 point."} All records update instantly across every tab.
                  </div>
                  <div style={{display:"flex",gap:10}}>
                    <button onClick={()=>{setConfirm(false);saveEdit();}} style={{...bigBtn(C.red,C.white),flex:1}}>Confirm Save</button>
                    <button onClick={()=>setConfirm(false)} style={{...bigBtn(C.mist,C.slate),flex:1}}>Cancel</button>
                  </div>
                </div>
            }
            {saved&&<div style={{textAlign:"center",padding:10,color:C.green,fontFamily:"Arial,sans-serif",fontWeight:600,fontSize:13}}>✓ Saved — updating all tabs…</div>}
          </>
        )}
      </div>
    </div>
  );
}


// ─── LIVE MATCH ───────────────────────────────────────────────────────────────
function LiveMatchScreen({go, goBack, goMatch, matchId, matches, updateMatch, tripPlayers, activeTrip, sideGames, onAddSideGame, onEditSideGameFromLive}){
  // effectiveMatch: auto-starts upcoming matches as live when scorer taps in
  const rawMatch = matches.find(m=>m.id===matchId)
               || matches.find(m=>m.status==="live")
               || matches[0];
  const match = rawMatch?.status === "upcoming"
    ? {...rawMatch, status:"live"}
    : rawMatch;

  // Parse real per-hole data if the organizer scanned/entered it for this tee.
  // Falls back to Mammoth Dunes' layout when no real data exists yet.
  const realHoleData = (() => {
    if(!match.hole_data) return null;
    try {
      const parsed = typeof match.hole_data === "string" ? JSON.parse(match.hole_data) : match.hole_data;
      if(Array.isArray(parsed) && parsed.length === 18) return parsed;
    } catch(e){ /* fall through to demo data */ }
    return null;
  })();

  const course = {
    slope:       match.slope       || COURSES.mammoth.slope,
    rating:      match.rating      || COURSES.mammoth.rating,
    par:         match.par         || COURSES.mammoth.par,
    // Real per-hole stroke index/par when available; otherwise demo layout
    strokeIndex: realHoleData ? realHoleData.map(h=>h.strokeIndex) : COURSES.mammoth.strokeIndex,
    pars:        realHoleData ? realHoleData.map(h=>h.par)         : COURSES.mammoth.pars,
    yardages:    realHoleData ? realHoleData.map(h=>h.yardage)     : null,
    name:        match.course_name || COURSES.mammoth.name,
    hasRealHoleData: !!realHoleData,
  };
  const format = match.format || "Best Ball";

  // ── Players: use real tripPlayers if available ────────────────────────────
  // Build RAW-compatible player objects from tripPlayers for WHS engine
  const buildRealPlayers = () => {
    const allKeys = [...(match.p1Keys||[]), ...(match.p2Keys||[])];
    if(tripPlayers && tripPlayers.length > 0){
      // Match players by name (lowercase) since p1Keys/p2Keys store lowercase names
      return tripPlayers
        .filter(tp => allKeys.includes(tp.name.toLowerCase()))
        .map(tp => ({
          key:   tp.name.toLowerCase(),
          name:  tp.name,
          index: tp.hcp_index || 0,
          team:  tp.team || "red",
          ghin:  false,
        }));
    }
    // Fall back to demo RAW players
    return RAW.filter(p => allKeys.includes(p.key));
  };

  const realPlayers = buildRealPlayers();
  const allKeys     = [...(match.p1Keys||[]),...(match.p2Keys||[])];
  const players     = buildPlayers(realPlayers, course, format);
  const playerByKey = Object.fromEntries(players.map(p=>[p.key,p]));

  // RAW players per side
  const p1RawPlayers = players.filter(p=>(match.p1Keys||[]).includes(p.key));
  const p2RawPlayers = players.filter(p=>(match.p2Keys||[]).includes(p.key));

  // External (guest) players — names in pairing string not in p1Keys/p2Keys
  const parseExt = (pairingStr, rawKeys) => {
    const rawNames = rawKeys.map(k=>realPlayers.find(p=>p.key===k)?.name||"");
    return pairingStr.split("/").map(n=>n.trim())
      .filter(n=>n&&!rawNames.some(rn=>rn.toLowerCase()===n.toLowerCase()))
      .map(n=>{
        // Check if this guest has handicap data in tripPlayers
        const tp = tripPlayers?.find(p=>p.name.toLowerCase()===n.toLowerCase());
        return {
          key:        n.toLowerCase(),
          name:       n,
          index:      tp?.hcp_index || null,
          isExternal: true,
        };
      });
  };
  const p1ExtPlayers = parseExt(match.p1||"", match.p1Keys||[]);
  const p2ExtPlayers = parseExt(match.p2||"", match.p2Keys||[]);

  const p1Players = [...p1RawPlayers, ...p1ExtPlayers];
  const p2Players = [...p2RawPlayers, ...p2ExtPlayers];

  // Team colors from real player data
  const p1Team = p1RawPlayers.length ? p1RawPlayers[0].team
    : realPlayers.find(p=>(match.p1Keys||[]).includes(p.key))?.team || "red";
  const p2Team = p2RawPlayers.length ? p2RawPlayers[0].team
    : realPlayers.find(p=>(match.p2Keys||[]).includes(p.key))?.team || "blue";

  // Seed holeResults from match.holeScores if available (for already-started live matches)
  // holeNum starts at match.thru (where scoring left off) or 1
  const [holeNum,      setHoleNum]      = useState(()=>Math.min((match.thru||0)+1, 18));
  const [quickMode,    setQuickMode]    = useState(false);
  const [showUndo,     setShowUndo]     = useState(false);
  const [expandSide,   setExpandSide]   = useState(false);
  const [expandScorecard, setExpandScorecard] = useState(true);
  const [expandHcp,    setExpandHcp]    = useState(null);
  const [showSummary,  setShowSummary]  = useState(false);
  const [showNet,      setShowNet]      = useState(false); // toggle gross/net view

  // Seed hole scores and results from match.holeScores
  const [holeScores,  setHoleScores]  = useState(()=>{
    const seed = match.holeScores || {};
    const out  = {};
    for(let h=1;h<=18;h++) out[h] = seed[h]?{...seed[h]}:{};
    return out;
  });

  // Track which holes THIS device has already confirmed/submitted, so we know
  // it's safe to merge in remote updates for other holes without ever
  // overwriting scores someone is actively typing on this phone right now.
  const confirmedHolesRef = useRef(new Set(Object.keys(match.holeScores||{}).map(Number)));
  const [remoteUpdateBanner, setRemoteUpdateBanner] = useState(false);

  // When another device saves a score (via Realtime), merge it in here —
  // merging happens per PLAYER, not per hole, so if you've already entered
  // your own score on hole 5 but your partner just submitted theirs on the
  // same hole, their score still comes through instead of being blocked.
  useEffect(() => {
    const incoming = match.holeScores || {};
    let changed = false;
    setHoleScores(prev => {
      const next = {...prev};
      Object.entries(incoming).forEach(([h, remoteScores])=>{
        const hNum = Number(h);
        const localScores = prev[hNum] || {};
        const mergedScores = {...localScores};
        Object.entries(remoteScores||{}).forEach(([key, val])=>{
          // Only fill in keys we don't already have locally — never overwrite
          // a score this device itself entered for that specific player.
          if(mergedScores[key] === undefined || mergedScores[key] === ""){
            mergedScores[key] = val;
            changed = true;
          }
        });
        next[hNum] = mergedScores;
      });
      return changed ? next : prev;
    });
    if(changed){
      setRemoteUpdateBanner(true);
      setTimeout(()=>setRemoteUpdateBanner(false), 2500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(match.holeScores)]);
  // Seed hole results from match data if thru > 0 using guest-aware net
  const [holeResults, setHoleResults] = useState(()=>{
    if(!match.thru || match.thru===0) return {};
    const out={};
    for(let h=1;h<=match.thru;h++){
      const scores = match.holeScores?.[h] || {};
      const hSI    = course.strokeIndex[h-1];
      const allP1  = [...(match.p1Keys||[]), ...(match.p1||"").split("/").map(n=>n.trim().toLowerCase()).filter(n=>!(match.p1Keys||[]).includes(n)&&n)];
      const allP2  = [...(match.p2Keys||[]), ...(match.p2||"").split("/").map(n=>n.trim().toLowerCase()).filter(n=>!(match.p2Keys||[]).includes(n)&&n)];
      const netFor = (k) => {
        const g=parseInt(scores[k]); if(isNaN(g)||g<=0) return Infinity;
        const hSI2=course.strokeIndex[h-1];
        // RAW player built with WHS
        const rBuilt=players.find(p=>p.key===k);
        if(rBuilt) return g-sOnHole(rBuilt.ms, hSI2);
        // Guest player with handicap
        const gp=GUEST_PLAYERS[k];
        if(gp){
          const ch=Math.round(gp.index*(course.slope/113)+(course.rating-course.par));
          const ph=Math.round(ch*(format.toLowerCase().includes("singles")?1.0:0.90));
          return g-sOnHole(Math.max(0,ph-1), hSI2);
        }
        return g;
      };
      const p1best=Math.min(...allP1.map(netFor));
      const p2best=Math.min(...allP2.map(netFor));
      out[h]=p1best<p2best?"p1":p2best<p1best?"p2":"tie";
    }
    return out;
  });

  // 20 Ball / 40 Ball: tracks which player keys' scores are "banked" toward
  // the running total for each hole. Shape: { [hole]: { [playerKey]: true } }
  // Seeded from match.bankedScores if previously saved.
  const [bankedScores, setBankedScores] = useState(()=>match.bankedScores || {});

  const si  = course.strokeIndex[holeNum-1];
  const par = course.pars[holeNum-1];

  const curScores   = holeScores[holeNum]||{};
  const setScore    = (key,val)=>setHoleScores(prev=>({...prev,[holeNum]:{...(prev[holeNum]||{}),[key]:val}}));

  // Format classification
  const isScramble   = format.toLowerCase().includes("scramble");
  const isAltShot    = format.toLowerCase().includes("alt")&&!isScramble;
  const isTeamScoreFormat = isScramble || isAltShot; // both use one score per team
  const isXBall      = format.toLowerCase().includes("ball")&&(format.toLowerCase().includes("20")||format.toLowerCase().includes("40"));
  const xBallTarget  = format.toLowerCase().includes("40") ? 40 : 20; // total banked scores needed by hole 18
  const xBallPerSide = format.toLowerCase().includes("40") ? 4 : 2;   // players per side contributing scores

  // Toggle whether a given player's score on the CURRENT hole counts toward their side's total
  const toggleBank = (key) => {
    setBankedScores(prev => {
      const cur = {...(prev[holeNum]||{})};
      if(cur[key]) delete cur[key]; else cur[key] = true;
      return {...prev, [holeNum]: cur};
    });
  };

  // Count how many scores have been banked so far for a given side (across all holes up to current)
  const bankedCountForSide = (sideKeys) => {
    let count = 0;
    for(let h=1; h<=18; h++){
      const banked = bankedScores[h] || {};
      sideKeys.forEach(k=>{ if(banked[k]) count++; });
    }
    return count;
  };

  // Net total of banked scores for a side (sum of net-vs-par for every banked score)
  const bankedNetTotalForSide = (sideKeys) => {
    let total = 0;
    for(let h=1; h<=18; h++){
      const banked = bankedScores[h] || {};
      const scores = holeScores[h] || {};
      const hSI = course.strokeIndex[h-1];
      const hPar = course.pars[h-1];
      sideKeys.forEach(k=>{
        if(banked[k]){
          const gross = parseInt(scores[k]);
          if(!isNaN(gross) && gross>0){
            const net = getNetLive(k, scores, h);
            total += (net - hPar);
          }
        }
      });
    }
    return total;
  };

  // allEntered: scramble only needs one side's score; alt-shot/match play needs both
  const p1AllKeys = [...(match.p1Keys||[]), ...p1ExtPlayers.map(p=>p.key)];
  const p2AllKeys = [...(match.p2Keys||[]), ...p2ExtPlayers.map(p=>p.key)];

  const allEntered = isXBall
    // X-Ball (20/40 Ball): can always advance — banking 0, 1, or both scores is a valid choice each hole
    ? true
    : isScramble
    // Scramble: just need the current player's team score to advance
    ? (parseInt(curScores["team_p1"])>0 || parseInt(curScores["team_p2"])>0)
    : isAltShot
    ? (parseInt(curScores["team_p1"])>0 && parseInt(curScores["team_p2"])>0)
    : (
        p1AllKeys.some(k=>parseInt(curScores[k])>0) &&
        p2AllKeys.some(k=>parseInt(curScores[k])>0)
      );

  // Get net score for any player key (RAW uses WHS, guest uses GUEST_PLAYERS handicap, unknown uses gross)
  const getNetLive = (key, scores, holeNum) => {
    const gross = parseInt(scores[key]);
    if(isNaN(gross) || gross <= 0) return Infinity;
    const hSI = course.strokeIndex[holeNum-1];
    const rawP = players.find(pl=>pl.key===key);
    if(rawP) return gross - sOnHole(rawP.ms, hSI);
    const guestP = GUEST_PLAYERS[key];
    if(guestP){
      // Compute guest PH relative to side's min PH
      const sideKeys = (match.p1Keys||[]).includes(key)
        ? [...(match.p1Keys||[]), ...p1ExtPlayers.map(p=>p.key)]
        : [...(match.p2Keys||[]), ...p2ExtPlayers.map(p=>p.key)];
      const gCH = Math.round(guestP.index*(course.slope/113)+(course.rating-course.par));
      const gPH = Math.round(gCH*(format.toLowerCase().includes("singles")?1.0:0.90));
      const sidePHs = sideKeys.map(k=>{
        const rp=players.find(pl=>pl.key===k);
        if(rp) return rp.ph;
        const gp=GUEST_PLAYERS[k];
        if(gp){const ch=Math.round(gp.index*(course.slope/113)+(course.rating-course.par));return Math.round(ch*(format.toLowerCase().includes("singles")?1.0:0.90));}
        return gPH;
      }).filter(v=>v!==null);
      const minPH = Math.min(...sidePHs, gPH);
      const gMS   = Math.max(0, gPH - minPH);
      return gross - sOnHole(gMS, hSI);
    }
    return gross; // unknown: gross as-is
  };

  const computeHoleWinner = (scores) => {
    if(isScramble){
      // Scramble: no hole winner — just record that scores exist
      // Return "p1" or "p2" only if that team entered a score (for tracking thru)
      // Winner determined after 18 by total strokes
      const s1=parseInt(scores["team_p1"]), s2=parseInt(scores["team_p2"]);
      if(!isNaN(s1)&&s1>0&&!isNaN(s2)&&s2>0) return "both"; // both teams scored
      if(!isNaN(s1)&&s1>0) return "p1_only"; // only p1 scored this hole yet
      if(!isNaN(s2)&&s2>0) return "p2_only"; // only p2 scored this hole yet
      return "none";
    }
    if(isAltShot){
      const s1=parseInt(scores["team_p1"]), s2=parseInt(scores["team_p2"]);
      if(isNaN(s1)||isNaN(s2)) return "tie";
      return s1<s2?"p1":s2<s1?"p2":"tie";
    }
    // Per-player match play: best net score per side
    const best = side => {
      const sideAllKeys = side==="p1"
        ? [...(match.p1Keys||[]), ...p1ExtPlayers.map(p=>p.key)]
        : [...(match.p2Keys||[]), ...p2ExtPlayers.map(p=>p.key)];
      return Math.min(...sideAllKeys.map(k=>getNetLive(k, scores, holeNum)));
    };
    const n1=best("p1"), n2=best("p2");
    return n1<n2?"p1":n2<n1?"p2":"tie";
  };

  // Pure function: compute match status from hole results and scores
  const computeStatusFromResults = (results) => {
    const p1Col=p1Team==="red"?C.sand:"#85C1E9";
    const p2Col=p2Team==="red"?C.sand:"#85C1E9";

    // X-Ball (20/40 Ball): show banked progress and net totals per side
    if(isXBall){
      const p1Keys=[...(match.p1Keys||[]),...p1ExtPlayers.map(p=>p.key)];
      const p2Keys=[...(match.p2Keys||[]),...p2ExtPlayers.map(p=>p.key)];
      const p1Banked=bankedCountForSide(p1Keys), p2Banked=bankedCountForSide(p2Keys);
      const p1Net=bankedNetTotalForSide(p1Keys), p2Net=bankedNetTotalForSide(p2Keys);
      if(p1Banked===0&&p2Banked===0) return {text:"Not started", color:"rgba(255,255,255,.8)"};
      if(p1Banked>=xBallTarget&&p2Banked>=xBallTarget){
        if(p1Net<p2Net) return {text:`${match.p1} wins (${p1Net} vs ${p2Net})`, color:p1Col};
        if(p2Net<p1Net) return {text:`${match.p2} wins (${p2Net} vs ${p1Net})`, color:p2Col};
        return {text:`Tied (${p1Net} each)`, color:"rgba(255,255,255,.8)"};
      }
      return {text:`${match.p1.split(" / ")[0]}: ${p1Banked}/${xBallTarget} · ${match.p2.split(" / ")[0]}: ${p2Banked}/${xBallTarget}`, color:"rgba(255,255,255,.85)"};
    }

    // Scramble: stroke play — show running totals
    if(isScramble){
      let t1=0,t2=0,h1=0,h2=0;
      for(let h=1;h<=18;h++){
        const hs=holeScores[h]||{};
        const s1=parseInt(hs["team_p1"]), s2=parseInt(hs["team_p2"]);
        if(!isNaN(s1)&&s1>0){t1+=s1;h1++;}
        if(!isNaN(s2)&&s2>0){t2+=s2;h2++;}
      }
      if(h1===0&&h2===0) return {text:"Not started", color:"rgba(255,255,255,.8)"};
      const thruStr = h1>0&&h2>0&&h1===h2?`thru ${h1}`:h1>0||h2>0?`(${match.p1.split(" / ")[0]}: thru ${h1}, ${match.p2.split(" / ")[0]}: thru ${h2})`:"";
      if(h1===18&&h2===18){
        if(t1<t2) return {text:`${match.p1} wins (${t1} vs ${t2})`, color:p1Col};
        if(t2<t1) return {text:`${match.p2} wins (${t2} vs ${t1})`, color:p2Col};
        return {text:`Tied (${t1} each)`, color:"rgba(255,255,255,.8)"};
      }
      return {text:`${match.p1}: ${t1||"—"} · ${match.p2}: ${t2||"—"} ${thruStr}`, color:"rgba(255,255,255,.85)"};
    }

    // Match play (best ball, alt shot, singles, etc.)
    // Once a match is mathematically decided (e.g. "5&3"), the result is
    // LOCKED at that exact margin — additional holes can still be entered
    // for fun/practice, but they never change the official outcome. This
    // mirrors how match play actually works: the match is over the moment
    // a side's lead exceeds the holes remaining, regardless of what happens
    // on any holes played afterward.
    let p1=0,p2=0,ties=0;
    let decidedAt = null; // {diff, remAtDecision, holeNumber} — set the moment the match is won
    for(let h=1;h<=18;h++){
      if(results[h]==="p1")p1++;
      else if(results[h]==="p2")p2++;
      else if(results[h]==="tie")ties++;

      if(!decidedAt){
        const playedSoFar = p1+p2+ties;
        const diffSoFar = p1-p2;
        const remSoFar = 18-playedSoFar;
        if(Math.abs(diffSoFar) > remSoFar){
          decidedAt = { diff: diffSoFar, rem: remSoFar };
        }
      }
    }

    const played=p1+p2+ties;
    if(played===0) return {text:match.liveScore||"Not started", color:"rgba(255,255,255,.8)"};
    const p1Label=match.p1, p2Label=match.p2;

    // Match already mathematically won — report the FROZEN margin, not a
    // recalculated one based on any extra holes played after the win.
    if(decidedAt){
      const {diff, rem} = decidedAt;
      if(diff>0) return {text:`${p1Label} wins ${diff}&${rem}`, color:p1Col};
      return {text:`${p2Label} wins ${-diff}&${rem}`, color:p2Col};
    }

    const diff=p1-p2, rem=18-played;
    if(played===18){
      if(diff>0) return {text:`${p1Label} wins 1UP`, color:p1Col};
      if(diff<0) return {text:`${p2Label} wins 1UP`, color:p2Col};
      return {text:"All Square", color:"rgba(255,255,255,.8)"};
    }
    if(diff===0) return {text:"All Square", color:"rgba(255,255,255,.8)"};
    if(diff>0)   return {text:`${p1Label} ${diff} UP`, color:p1Col};
    return             {text:`${p2Label} ${-diff} UP`, color:p2Col};
  };

  const status        = computeStatusFromResults(holeResults);
  const confirmedThru = Object.keys(holeResults).length;
  const preview = allEntered ? computeHoleWinner(curScores) : null;

  const advanceHole = () => {
    if(holeNum<18) setHoleNum(holeNum+1);
    else setShowSummary(true);
  };

  const submitHole = async () => {
    const winner     = computeHoleWinner(curScores);
    const newHoleScores = {...holeScores, [holeNum]: {...(holeScores[holeNum]||{}), ...curScores}};
    setHoleScores(newHoleScores);

    // For scramble: don't add to holeResults (no hole winners), just track scores
    // Advance hole when at least one team has submitted
    let newResults = holeResults;
    if(!isScramble){
      newResults = {...holeResults, [holeNum]: winner};
      setHoleResults(newResults);
    } else {
      // For scramble, mark hole as having data
      newResults = {...holeResults, [holeNum]: winner}; // "both"/"p1_only"/"p2_only"
      setHoleResults(newResults);
    }

    const newStatus = computeStatusFromResults(newResults);
    updateMatch(match.id, {
      thru:         holeNum,
      liveScore:    newStatus.text,
      holeScores:   newHoleScores,
      bankedScores: bankedScores,
      status:       "live",
    });

    // Save to Supabase
    if(activeTrip && match.id && typeof match.id==="string" && match.id.length>10){
      try {
        // UUID v4 shape check — player_id is a uuid column in Postgres, so we
        // must NEVER send a non-UUID value (like "team_p1" for scramble, or a
        // lowercase name for an unmatched guest) or the insert is rejected
        // outright by Postgres. Those entries are simply skipped here; team
        // scores and guest-only scoring still work via match.holeScores itself
        // (used for in-app display) — only the per-player hole_scores table
        // row requires a real trip_players UUID.
        const isValidUUID = v => typeof v==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
        const holeRows = Object.entries(curScores)
          .filter(([,v])=>v&&parseInt(v)>0)
          .map(([key,gross])=>{
            const tp = tripPlayers?.find(p=>p.name.toLowerCase()===key);
            return tp ? {match_id:match.id, player_id:tp.id, hole_number:holeNum, gross_score:parseInt(gross)} : null;
          })
          .filter(row => row && isValidUUID(row.player_id));
        if(holeRows.length>0){
          const res = await fetch(`${SUPA_URL}/rest/v1/hole_scores`,{
            method:"POST",
            headers:{...db.headers,"Prefer":"resolution=merge-duplicates"},
            body:JSON.stringify(holeRows),
          });
          if(!res.ok) console.warn("hole_scores insert failed:", await res.text());
        }
        await db.patch("matches",`id=eq.${match.id}`,{
          thru:holeNum, live_score:newStatus.text, status:"live",
          banked_scores: isXBall ? JSON.stringify(bankedScores) : undefined,
          // score_data is now saved as a universal backup of the full hole-by-hole
          // map for EVERY format — not just Scramble/X-Ball. The per-player
          // hole_scores table remains the source for cross-match side games
          // (Nassau/Skins), but any player who couldn't be matched to a real
          // UUID (e.g. an unlinked guest) would otherwise have their scores
          // silently dropped on reload. Saving the complete map here guarantees
          // nothing is ever lost, regardless of format or player type.
          score_data: JSON.stringify(newHoleScores),
        });
      } catch(e){console.warn("Failed to save hole:",e.message);}
    }

    setShowUndo(true);
    setTimeout(()=>setShowUndo(false),5000);
    advanceHole();
  };

  const quickWin = async result => {
    const newResults = {...holeResults, [holeNum]: result};
    setHoleResults(newResults);
    const newStatus  = computeStatusFromResults(newResults);
    updateMatch(match.id, {thru: holeNum, liveScore: newStatus.text, status:"live"});
    if(activeTrip && match.id && typeof match.id === "string" && match.id.length > 10){
      try {
        await db.patch("matches", `id=eq.${match.id}`, {
          thru: holeNum, live_score: newStatus.text, status:"live"
        });
      } catch(e){}
    }
    setShowUndo(true);
    setTimeout(()=>setShowUndo(false), 5000);
    advanceHole();
  };

  const undoHole = async () => {
    const last = holeNum-1;
    if(last<1) return;
    const newResults    = {...holeResults};  delete newResults[last];
    const newHoleScores = {...holeScores};   delete newHoleScores[last];
    setHoleResults(newResults);
    setHoleNum(last);
    setShowUndo(false);
    setHoleScores(newHoleScores);
    const newStatus = computeStatusFromResults(newResults);
    updateMatch(match.id, {
      thru:       Math.max(0, last-1),
      liveScore:  newStatus.text,
      holeScores: newHoleScores,
    });
    if(activeTrip && match.id && typeof match.id === "string" && match.id.length > 10){
      try {
        // Remove undone hole scores from DB
        const playerKeys = [...(match.p1Keys||[]),...(match.p2Keys||[])];
        const tpIds = playerKeys.map(k=>tripPlayers?.find(p=>p.name.toLowerCase()===k)?.id).filter(Boolean);
        if(tpIds.length > 0){
          await fetch(`${SUPA_URL}/rest/v1/hole_scores?match_id=eq.${match.id}&hole_number=eq.${last}&player_id=in.(${tpIds.join(",")})`, {
            method:"DELETE", headers: db.headers,
          });
        }
        await db.patch("matches", `id=eq.${match.id}`, {
          thru: Math.max(0, last-1), live_score: newStatus.text,
        });
      } catch(e){}
    }
  };

  // Save final match result to Supabase when match completes
  const finishMatch = async (finalStatus) => {
    updateMatch(match.id, {
      winnerSide: finalStatus.winnerSide,
      score:      finalStatus.text,
      status:     "completed",
      thru:       18,
    });
    if(activeTrip && match.id && typeof match.id === "string" && match.id.length > 10){
      try {
        await db.patch("matches", `id=eq.${match.id}`, {
          winner_side: finalStatus.winnerSide,
          score:       finalStatus.text,
          status:      "completed",
          thru:        18,
          live_score:  finalStatus.text,
        });
      } catch(e){ console.warn("Failed to save match result:", e.message); }
    }
  };

  if(showSummary){
    const s = computeStatusFromResults(holeResults);
    return(
      <div style={{flex:1,display:"flex",flexDirection:"column",background:C.smoke}}>
        <div style={{background:`linear-gradient(135deg,${C.forest},${C.fairway})`,padding:"20px 24px 24px"}}>
          <div style={{color:"rgba(255,255,255,.6)",fontSize:11,fontFamily:"Arial,sans-serif",letterSpacing:"1.2px",textTransform:"uppercase",marginBottom:4}}>Round Complete</div>
          <div style={{color:C.white,fontSize:22,fontWeight:700}}>{match.p1} vs {match.p2} · {course.name}</div>
        </div>
        <div style={{flex:1,padding:16,display:"flex",flexDirection:"column",gap:12,overflowY:"auto"}}>
          <div style={{...card({textAlign:"center",padding:"24px 16px"})}}>
            <div style={{fontSize:32,marginBottom:8}}>🏆</div>
            <div style={{fontSize:22,fontWeight:700,color:C.forest,fontFamily:"Arial,sans-serif"}}>{s.text}</div>
            <div style={{fontSize:13,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:6}}>{match.p1} vs {match.p2}</div>
          </div>
          {/* Full hole-by-hole scorecard — every player's score per hole,
              with PAR/YARDAGE shown like a real scorecard, and only the
              individual player whose score actually won the hole highlighted
              (not their whole side) in their team's color. */}
          <div style={card()}>
            <div style={{fontSize:13,fontWeight:700,color:C.charcoal,marginBottom:10}}>Scorecard</div>
            <div style={{overflowX:"auto"}}>
              <div style={{minWidth:18*26+50+90}}>
                {/* Helper: total for a set of holes */}
                {(() => {
                  const parOut  = course.pars.slice(0,9).reduce((a,b)=>a+b,0);
                  const parIn   = course.pars.slice(9,18).reduce((a,b)=>a+b,0);
                  const parTot  = parOut+parIn;
                  const ydsOut  = course.yardages ? course.yardages.slice(0,9).reduce((a,b)=>a+(b||0),0) : null;
                  const ydsIn   = course.yardages ? course.yardages.slice(9,18).reduce((a,b)=>a+(b||0),0) : null;
                  const ydsTot  = ydsOut!=null ? ydsOut+ydsIn : null;

                  const totCell = (val, bold=false, bg=C.smoke) => (
                    <div style={{width:28,flexShrink:0,height:24,borderRadius:5,background:bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <span style={{fontSize:9,fontWeight:bold?700:500,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>{val}</span>
                    </div>
                  );

                  return (<>
                    {/* Hole number header */}
                    <div style={{display:"flex",gap:2,marginBottom:2,alignItems:"center"}}>
                      <div style={{width:60,flexShrink:0}}/>
                      {Array.from({length:18},(_,i)=>i+1).map(h=>(
                        <div key={h} style={{flex:1,minWidth:24,textAlign:"center",fontSize:9,color:C.gray,fontFamily:"Arial,sans-serif"}}>{h}</div>
                      ))}
                      <div style={{width:28,flexShrink:0,textAlign:"center",fontSize:9,color:C.gray,fontFamily:"Arial,sans-serif"}}>Out</div>
                      <div style={{width:28,flexShrink:0,textAlign:"center",fontSize:9,color:C.gray,fontFamily:"Arial,sans-serif"}}>In</div>
                      <div style={{width:28,flexShrink:0,textAlign:"center",fontSize:9,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>Tot</div>
                    </div>
                    {/* Par row */}
                    <div style={{display:"flex",gap:2,marginBottom:1,alignItems:"center"}}>
                      <div style={{width:60,flexShrink:0,fontSize:9,color:C.gray,fontFamily:"Arial,sans-serif"}}>Par</div>
                      {Array.from({length:18},(_,i)=>i+1).map(h=>(
                        <div key={h} style={{flex:1,minWidth:24,textAlign:"center",fontSize:9,color:C.slate,fontFamily:"Arial,sans-serif"}}>{course.pars[h-1]}</div>
                      ))}
                      <div style={{width:28,flexShrink:0,textAlign:"center",fontSize:9,color:C.slate,fontFamily:"Arial,sans-serif"}}>{parOut}</div>
                      <div style={{width:28,flexShrink:0,textAlign:"center",fontSize:9,color:C.slate,fontFamily:"Arial,sans-serif"}}>{parIn}</div>
                      <div style={{width:28,flexShrink:0,textAlign:"center",fontSize:9,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>{parTot}</div>
                    </div>
                    {/* Yardage row */}
                    {course.yardages&&(
                      <div style={{display:"flex",gap:2,marginBottom:6,alignItems:"center"}}>
                        <div style={{width:60,flexShrink:0,fontSize:9,color:C.gray,fontFamily:"Arial,sans-serif"}}>Yards</div>
                        {Array.from({length:18},(_,i)=>i+1).map(h=>(
                          <div key={h} style={{flex:1,minWidth:24,textAlign:"center",fontSize:8,color:C.gray,fontFamily:"Arial,sans-serif"}}>{course.yardages[h-1]||"—"}</div>
                        ))}
                        <div style={{width:28,flexShrink:0,textAlign:"center",fontSize:8,color:C.gray,fontFamily:"Arial,sans-serif"}}>{ydsOut}</div>
                        <div style={{width:28,flexShrink:0,textAlign:"center",fontSize:8,color:C.gray,fontFamily:"Arial,sans-serif"}}>{ydsIn}</div>
                        <div style={{width:28,flexShrink:0,textAlign:"center",fontSize:8,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>{ydsTot}</div>
                      </div>
                    )}
                    {!course.yardages&&<div style={{marginBottom:6}}/>}
                    {/* Scorecard rows: team-only for Scramble, per-player for everything else */}
                    {isScramble ? (
                      // Scramble: just two team rows using team_p1/team_p2 score keys
                      [{key:"team_p1", label:match.p1, team:p1Team}, {key:"team_p2", label:match.p2, team:p2Team}].map(({key,label,team})=>{
                        const teamColor2 = team==="red"?C.red:C.blue;
                        const teamBg2    = team==="red"?C.redBg:C.blueBg;
                        let scoreOut=0,scoreIn=0,hasOut=false,hasIn=false;
                        for(let h=1;h<=18;h++){
                          const g=parseInt(holeScores[h]?.[key]);
                          if(!isNaN(g)&&g>0){
                            if(h<=9){scoreOut+=g;hasOut=true;}
                            else{scoreIn+=g;hasIn=true;}
                          }
                        }
                        const scoreTot=scoreOut+scoreIn;
                        return(
                          <div key={key} style={{display:"flex",gap:2,marginBottom:3,alignItems:"center"}}>
                            <div style={{width:60,flexShrink:0,fontSize:10,fontWeight:700,color:teamColor2,fontFamily:"Arial,sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                              {label}
                            </div>
                            {Array.from({length:18},(_,i)=>i+1).map(h=>{
                              const gross=parseInt(holeScores[h]?.[key]);
                              const hasScore=!isNaN(gross)&&gross>0;
                              const par=course.pars[h-1]||4;
                              const rel=hasScore?gross-par:null;
                              const bg=rel===null?C.smoke:rel<=-1?C.greenBg:rel===0?C.white:C.redBg;
                              return(
                                <div key={h} style={{flex:1,minWidth:24,height:24,borderRadius:5,background:bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                  <span style={{fontSize:10,fontWeight:600,color:hasScore?C.charcoal:C.light,fontFamily:"Arial,sans-serif"}}>{hasScore?gross:"·"}</span>
                                </div>
                              );
                            })}
                            {totCell(hasOut?scoreOut:"·")}
                            {totCell(hasIn?scoreIn:"·")}
                            <div style={{width:28,flexShrink:0,height:24,borderRadius:5,background:C.charcoal,display:"flex",alignItems:"center",justifyContent:"center"}}>
                              <span style={{fontSize:10,fontWeight:700,color:C.white,fontFamily:"Arial,sans-serif"}}>{(hasOut||hasIn)?scoreTot:"·"}</span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      // All other formats: per-player rows
                      [...p1Players,...p2Players].map((p,pi)=>{
                        const isExt = p.isExternal;
                        const sideTeam = pi<p1Players.length ? p1Team : p2Team;
                        const sideColor = sideTeam==="red"?C.red:C.blue;
                        let scoreOut=0, scoreIn=0, hasOut=false, hasIn=false;
                        for(let h=1;h<=18;h++){
                          const g = parseInt(holeScores[h]?.[p.key]);
                          if(!isNaN(g)&&g>0){
                            if(h<=9){ scoreOut+=g; hasOut=true; }
                            else    { scoreIn+=g;  hasIn=true;  }
                          }
                        }
                        const scoreTot = scoreOut+scoreIn;
                        return(
                          <div key={p.key} style={{display:"flex",gap:2,marginBottom:3,alignItems:"center"}}>
                            <div style={{width:60,flexShrink:0,fontSize:10,fontWeight:700,color:sideColor,fontFamily:"Arial,sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                              {p.name}{isExt&&<span style={{fontSize:8,color:C.gray}}> *</span>}
                            </div>
                            {Array.from({length:18},(_,i)=>i+1).map(h=>{
                              const gross = parseInt(holeScores[h]?.[p.key]);
                              const hasScore = !isNaN(gross) && gross>0;
                              const res = holeResults[h];
                              const onWinningSide = (res==="p1"&&pi<p1Players.length) || (res==="p2"&&pi>=p1Players.length);
                              let isBestOnSide = false;
                              if(onWinningSide && hasScore){
                                const sideKeys = pi<p1Players.length
                                  ? [...(match.p1Keys||[]), ...p1ExtPlayers.map(x=>x.key)]
                                  : [...(match.p2Keys||[]), ...p2ExtPlayers.map(x=>x.key)];
                                const scoresThisHole = holeScores[h]||{};
                                const nets = sideKeys.map(k=>({key:k, net:getNetLive(k, scoresThisHole, h)}));
                                const bestNet = Math.min(...nets.map(n=>n.net));
                                isBestOnSide = nets.find(n=>n.key===p.key)?.net === bestNet;
                              }
                              const bg = isBestOnSide ? (sideTeam==="red"?C.redBg:C.blueBg) : C.smoke;
                              const col = isBestOnSide ? sideColor : C.charcoal;
                              return(
                                <div key={h} style={{flex:1,minWidth:24,height:24,borderRadius:5,background:bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                  <span style={{fontSize:10,fontWeight:isBestOnSide?700:500,color:hasScore?col:C.light,fontFamily:"Arial,sans-serif"}}>{hasScore?gross:"·"}</span>
                                </div>
                              );
                            })}
                            {totCell(hasOut?scoreOut:"·")}
                            {totCell(hasIn?scoreIn:"·")}
                            <div style={{width:28,flexShrink:0,height:24,borderRadius:5,background:C.charcoal,display:"flex",alignItems:"center",justifyContent:"center"}}>
                              <span style={{fontSize:10,fontWeight:700,color:C.white,fontFamily:"Arial,sans-serif"}}>
                                {(hasOut||hasIn)?scoreTot:"·"}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </>);
                })()}
              </div>
            </div>
          </div>
          <button onClick={async ()=>{
            let ws, scoreStr;
            if(isXBall){
              const p1Keys=[...(match.p1Keys||[]),...p1ExtPlayers.map(p=>p.key)];
              const p2Keys=[...(match.p2Keys||[]),...p2ExtPlayers.map(p=>p.key)];
              const p1Net=bankedNetTotalForSide(p1Keys), p2Net=bankedNetTotalForSide(p2Keys);
              ws=p1Net<p2Net?"p1":p2Net<p1Net?"p2":"halve";
              scoreStr=ws==="halve"?`Tied (${p1Net})`:`${ws==="p1"?match.p1:match.p2} wins (${Math.min(p1Net,p2Net)} vs ${Math.max(p1Net,p2Net)})`;
            } else if(isScramble){
              // Scramble: count total strokes per team
              let t1=0,t2=0;
              for(let h=1;h<=18;h++){
                const hs=holeScores[h]||{};
                const s1=parseInt(hs["team_p1"]),s2=parseInt(hs["team_p2"]);
                if(!isNaN(s1)&&s1>0)t1+=s1;
                if(!isNaN(s2)&&s2>0)t2+=s2;
              }
              ws=t1<t2?"p1":t2<t1?"p2":"halve";
              scoreStr=ws==="halve"?`Tied (${t1})`:`${ws==="p1"?match.p1:match.p2} wins (${Math.min(t1,t2)} vs ${Math.max(t1,t2)})`;
            } else {
              // Walk holes in order and freeze the result at the exact moment
              // the match became mathematically decided — extra holes played
              // after that point never change the official outcome.
              let p1c=0,p2c=0,tiesc=0,decided=null;
              for(let h=1;h<=18;h++){
                const r=holeResults[h];
                if(r==="p1")p1c++; else if(r==="p2")p2c++; else if(r==="tie")tiesc++;
                if(!decided){
                  const playedc=p1c+p2c+tiesc, diffc=p1c-p2c, remc=18-playedc;
                  if(Math.abs(diffc)>remc) decided={diff:diffc, rem:remc};
                }
              }
              if(decided){
                ws = decided.diff>0 ? "p1" : "p2";
                scoreStr = `${Math.abs(decided.diff)}&${decided.rem}`;
              } else {
                const played=p1c+p2c+tiesc;
                ws = p1c>p2c?"p1":p2c>p1c?"p2":"halve";
                if(played===18){
                  scoreStr = ws==="halve" ? "All Square" : "1UP";
                } else {
                  scoreStr = ws==="halve" ? "All Square" : `${Math.abs(p1c-p2c)} UP thru ${played}`;
                }
              }
            }
            await finishMatch({winnerSide:ws, text:scoreStr});
            go("board");
          }} style={bigBtn(`linear-gradient(135deg,${C.forest},${C.fairway})`,C.white,{boxShadow:"0 6px 20px rgba(27,67,50,.25)"})}>
            Save & View Leaderboard →
          </button>
          <button onClick={()=>go("matches")} style={bigBtn(C.mist,C.forest,{marginTop:4})}>Back to Matches</button>
        </div>
      </div>
    );
  }

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",background:C.smoke,position:"relative"}}>
      <div style={{background:`linear-gradient(135deg,${C.forest},${C.fairway})`,padding:"14px 18px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <BackBtn goBack={goBack} go={go} to="matches"/>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>setShowNet(!showNet)}
              style={{background:showNet?C.mint:"rgba(255,255,255,.15)",border:"none",color:showNet?C.forest:C.white,borderRadius:8,padding:"5px 10px",fontSize:11,cursor:"pointer",fontFamily:"Arial,sans-serif",fontWeight:700}}>
              {showNet?"Net ✓":"Net"}
            </button>
            <button onClick={()=>setQuickMode(!quickMode)}
              style={{background:quickMode?C.sand:"rgba(255,255,255,.15)",border:"none",color:quickMode?C.charcoal:C.white,borderRadius:8,padding:"5px 10px",fontSize:11,cursor:"pointer",fontFamily:"Arial,sans-serif",fontWeight:700}}>
              {quickMode?"⚡ Quick":"Quick Mode"}
            </button>
            <button onClick={()=>{ goMatch(match.id,"creatematch"); }}
              style={{background:"rgba(255,255,255,.15)",border:"none",color:C.white,borderRadius:8,padding:"5px 10px",fontSize:11,cursor:"pointer",fontFamily:"Arial,sans-serif",fontWeight:700}}>
              Edit
            </button>
            <button onClick={async ()=>{
              if(!window.confirm("Clear all scores and reset this match to upcoming?")) return;
              // Wipe hole scores from DB
              try { await db.delete("hole_scores",`match_id=eq.${match.id}`); } catch(e){}
              // Reset match row
              await db.patch("matches",`id=eq.${match.id}`,{
                status:"upcoming", thru:0, live_score:null,
                score_data:null, banked_scores:null, winner_side:null, score:null
              });
              // Reset local state
              setHoleScores({}); setHoleResults({}); setHoleNum(1);
              setShowSummary(false);
            }}
              style={{background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.3)",color:"rgba(255,255,255,.7)",borderRadius:8,padding:"5px 10px",fontSize:11,cursor:"pointer",fontFamily:"Arial,sans-serif",fontWeight:600}}>
              Clear
            </button>
          </div>
        </div>
          <div style={{color:"rgba(255,255,255,.65)",fontSize:11,fontFamily:"Arial,sans-serif",marginBottom:3}}>
            {course.name}{match.tee_name ? ` · ${match.tee_name} Tees` : ""} · {format}
          </div>
        <div style={{color:C.white,fontSize:14,fontWeight:700,fontFamily:"Arial,sans-serif"}}>
          {isScramble?(
            // Scramble: show team colors, not player names
            <span>
              <span style={{color:p1Team==="red"?C.sand:"#93C5FD"}}>Team {p1Team==="red"?"Red":"Blue"}</span>
              <span style={{color:"rgba(255,255,255,.45)"}}> vs </span>
              <span style={{color:p2Team==="red"?C.sand:"#93C5FD"}}>Team {p2Team==="red"?"Red":"Blue"}</span>
            </span>
          ):(
            <span>{match.p1} <span style={{color:"rgba(255,255,255,.45)"}}>vs</span> {match.p2}</span>
          )}
        </div>
        {/* Scramble score to par display */}
        {isScramble?(()=>{
          let t1=0,t2=0,h1=0,h2=0,totalPar=0;
          for(let h=1;h<=18;h++){
            const hs=holeScores[h]||{};
            const s1=parseInt(hs["team_p1"]),s2=parseInt(hs["team_p2"]);
            const p=course.pars[h-1]||4;
            if(!isNaN(s1)&&s1>0){t1+=s1;h1++;totalPar+=p;}
            if(!isNaN(s2)&&s2>0){t2+=s2;h2++;}
          }
          const fmt=(total,holes)=>{
            if(holes===0) return "—";
            const parSoFar=course.pars.slice(0,holes).reduce((a,b)=>a+b,0);
            const diff=total-parSoFar;
            return `${total} (${diff===0?"E":diff>0?`+${diff}`:diff})`;
          };
          const tc1=p1Team==="red"?C.sand:"#93C5FD";
          const tc2=p2Team==="red"?C.sand:"#93C5FD";
          return(
            <div style={{display:"flex",gap:16,marginTop:8}}>
              <div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.55)",fontFamily:"Arial,sans-serif"}}>Team {p1Team==="red"?"Red":"Blue"}{h1>0?` · thru ${h1}`:""}</div>
                <div style={{fontSize:20,fontWeight:700,color:tc1}}>{fmt(t1,h1)}</div>
              </div>
              <div style={{width:1,background:"rgba(255,255,255,.2)"}}/>
              <div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.55)",fontFamily:"Arial,sans-serif"}}>Team {p2Team==="red"?"Red":"Blue"}{h2>0?` · thru ${h2}`:""}</div>
                <div style={{fontSize:20,fontWeight:700,color:tc2}}>{fmt(t2,h2)}</div>
              </div>
            </div>
          );
        })():isXBall?(()=>{
          // X-Ball (20/40 Ball): net score-to-par is the headline number,
          // matching the clean, simple style used elsewhere — banked count
          // shown smaller alongside it rather than as the primary figure.
          const p1Keys=[...(match.p1Keys||[]),...p1ExtPlayers.map(p=>p.key)];
          const p2Keys=[...(match.p2Keys||[]),...p2ExtPlayers.map(p=>p.key)];
          const p1Banked=bankedCountForSide(p1Keys), p2Banked=bankedCountForSide(p2Keys);
          const p1Net=bankedNetTotalForSide(p1Keys), p2Net=bankedNetTotalForSide(p2Keys);
          const fmtNet = n => n===0?"E":n>0?`+${n}`:`${n}`;
          const tc1=p1Team==="red"?C.sand:"#93C5FD";
          const tc2=p2Team==="red"?C.sand:"#93C5FD";
          return(
            <div style={{display:"flex",gap:16,marginTop:8}}>
              <div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.55)",fontFamily:"Arial,sans-serif"}}>Team {p1Team==="red"?"Red":"Blue"}</div>
                <div style={{display:"flex",alignItems:"baseline",gap:6}}>
                  <span style={{fontSize:20,fontWeight:700,color:tc1}}>{p1Banked>0?fmtNet(p1Net):"—"}</span>
                  <span style={{fontSize:11,color:"rgba(255,255,255,.5)",fontFamily:"Arial,sans-serif"}}>{p1Banked}/{xBallTarget}</span>
                </div>
              </div>
              <div style={{width:1,background:"rgba(255,255,255,.2)"}}/>
              <div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.55)",fontFamily:"Arial,sans-serif"}}>Team {p2Team==="red"?"Red":"Blue"}</div>
                <div style={{display:"flex",alignItems:"baseline",gap:6}}>
                  <span style={{fontSize:20,fontWeight:700,color:tc2}}>{p2Banked>0?fmtNet(p2Net):"—"}</span>
                  <span style={{fontSize:11,color:"rgba(255,255,255,.5)",fontFamily:"Arial,sans-serif"}}>{p2Banked}/{xBallTarget}</span>
                </div>
              </div>
            </div>
          );
        })():(
          <div style={{fontSize:22,fontWeight:700,color:status.color,marginTop:6,letterSpacing:"-.5px"}}>
            {status.text}
            {confirmedThru>0&&<span style={{fontSize:13,color:"rgba(255,255,255,.5)",fontWeight:400}}> thru {confirmedThru}</span>}
          </div>
        )}
      </div>

      {/* Hole progress dots — colored by actual team (red/blue), not just "p1/p2" side order.
          Only meaningful for match-play formats where each hole has a winner;
          Scramble and X-Ball don't have per-hole winners so dots stay neutral there. */}
      <div style={{background:C.white,padding:"9px 14px",display:"flex",gap:3,justifyContent:"center",borderBottom:`1px solid ${C.mist}`}}>
        {Array.from({length:18},(_,i)=>i+1).map(h=>{
          const res=holeResults[h], cur=h===holeNum;
          const showResultColor = !isScramble && !isXBall; // match-play only
          const winColor = res==="p1" ? (p1Team==="red"?C.redBright:C.blueBright)
                         : res==="p2" ? (p2Team==="red"?C.redBright:C.blueBright)
                         : res==="tie" ? C.light : "transparent";
          const bg = cur ? C.sand : (showResultColor ? winColor : "transparent");
          const textCol = cur ? C.charcoal : (showResultColor && res && res!=="tie") ? C.white : C.gray;
          return(
            <div key={h} onClick={()=>setHoleNum(h)} style={{width:16,height:16,borderRadius:"50%",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,fontWeight:700,fontFamily:"Arial,sans-serif",background:bg,border:cur?`2px solid ${C.sand}`:`1.5px solid ${(showResultColor&&res)?"transparent":C.light}`,color:textCol}}>
              {h}
            </div>
          );
        })}
      </div>

      <div style={{flex:1,padding:14,display:"flex",flexDirection:"column",gap:10,overflowY:"auto"}}>
        {remoteUpdateBanner && (
          <div style={{background:C.greenBg,border:`1px solid ${C.mint}`,borderRadius:10,padding:"8px 12px",display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:C.green}}/>
            <span style={{fontSize:11,color:C.green,fontFamily:"Arial,sans-serif",fontWeight:600}}>Synced new scores from another phone</span>
          </div>
        )}
        {/* Side games attached to this match — quick access to view/edit */}
        {(() => {
          // Show only side games that include at least one player from THIS match —
          // whether the game is scoped to this exact round, a different round, or "any round".
          const thisMatchKeys = [...(match.p1Keys||[]), ...(match.p2Keys||[])];
          const gamesHere = (sideGames||[]).filter(g => {
            const gameKeys = g.type==="nassau"||g.type==="vegas"
              ? [...(g.side1Keys||[]), ...(g.side2Keys||[])]
              : (g.poolKeys||[]);
            return gameKeys.some(k => thisMatchKeys.includes(k));
          });
          return(
            <div style={{display:"flex",gap:8,alignItems:"center",overflowX:"auto",WebkitOverflowScrolling:"touch",touchAction:"pan-x"}}>
              {gamesHere.map(g=>{
                const ICONS={nassau:"💵",skins:"🏆",wolf:"🐺",stableford:"📊",vegas:"🎰"};
                return(
                  <button key={g.id} onClick={()=>{onEditSideGameFromLive && onEditSideGameFromLive(g);go("sidegamesetup");}}
                    style={{flexShrink:0,display:"flex",alignItems:"center",gap:5,background:C.mist,border:`1px solid ${C.light}`,borderRadius:20,padding:"6px 12px",cursor:"pointer"}}>
                    <span style={{fontSize:13}}>{ICONS[g.type]}</span>
                    <span style={{fontSize:11,fontWeight:600,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>{g.name||g.type}</span>
                  </button>
                );
              })}
              <button onClick={()=>{
                  onAddSideGame && onAddSideGame(match.id);
                  go("sidegamesetup");
                }}
                style={{flexShrink:0,display:"flex",alignItems:"center",gap:5,background:C.white,border:`1.5px dashed ${C.mint}`,borderRadius:20,padding:"6px 12px",cursor:"pointer"}}>
                <span style={{fontSize:13,color:C.forest}}>+</span>
                <span style={{fontSize:11,fontWeight:600,color:C.forest,fontFamily:"Arial,sans-serif"}}>{gamesHere.length>0?"Side Games":"Add Side Game"}</span>
              </button>
              {gamesHere.length>0&&(
                <button onClick={()=>go("payouts")}
                  style={{flexShrink:0,display:"flex",alignItems:"center",gap:5,background:C.white,border:`1.5px solid ${C.light}`,borderRadius:20,padding:"6px 12px",cursor:"pointer"}}>
                  <span style={{fontSize:11,fontWeight:600,color:C.slate,fontFamily:"Arial,sans-serif"}}>View All →</span>
                </button>
              )}
            </div>
          );
        })()}

        {/* Hole info */}
        <div style={card({display:"flex",justifyContent:"space-around"})}>
          {[["Hole",holeNum],["Par",par],["SI",si],...(course.yardages?.[holeNum-1]?[["Yds",course.yardages[holeNum-1]]]:[[course.tee||"Blue","Tees"]])].map(([l,v])=>(
            <div key={l} style={{textAlign:"center"}}>
              <div style={{fontSize:19,fontWeight:700,color:C.charcoal}}>{v}</div>
              <div style={{fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif"}}>{l}</div>
            </div>
          ))}
        </div>
        {!course.hasRealHoleData&&(
          <div style={{background:C.amberBg,borderRadius:10,padding:"6px 12px",fontSize:11,color:C.amber,fontFamily:"Arial,sans-serif",textAlign:"center"}}>
            ⚠️ Using default hole layout — scan or enter this course's scorecard for accurate stroke allocation
          </div>
        )}

        {quickMode?(
          <div style={card({textAlign:"center"})}>
            <div style={{fontSize:14,fontWeight:700,color:C.charcoal,marginBottom:14}}>Hole {holeNum} — Who wins?</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>quickWin("p1")} style={{...bigBtn(p1Team==="red"?C.red:C.blue,C.white),flex:1}}>{p1Team==="red"?"🔴":"🔵"} {match.p1.split(" / ")[0]}</button>
              <button onClick={()=>quickWin("tie")} style={{...bigBtn(C.mist,C.slate),flex:1,padding:"14px 8px"}}>Tie</button>
              <button onClick={()=>quickWin("p2")} style={{...bigBtn(p2Team==="red"?C.red:C.blue,C.white),flex:1}}>{p2Team==="red"?"🔴":"🔵"} {match.p2.split(" / ")[0]}</button>
            </div>
          </div>
        ):(
          <>
            {isTeamScoreFormat?(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {isScramble&&<div style={{background:C.mist,borderRadius:10,padding:"10px 14px",fontSize:12,color:C.slate,fontFamily:"Arial,sans-serif",textAlign:"center"}}>
                  📋 Enter your team's score and tap Submit. Other team enters theirs separately.
                </div>}
                <div style={{display:"flex",gap:10}}>
                  {[{label:match.p1,team:p1Team,key:"team_p1"},{label:match.p2,team:p2Team,key:"team_p2"}].map(s=>{
                    const grossVal=curScores[s.key]??"",gross=parseInt(grossVal);
                    const tc=s.team==="red"?C.red:C.blue,tbg=s.team==="red"?C.redBg:C.blueBg;
                    const hasScore=!isNaN(gross)&&gross>0;
                    const prevTotal=isScramble?Array.from({length:holeNum-1},(_,i)=>i+1)
                      .reduce((sum,h)=>{const v=parseInt((holeScores[h]||{})[s.key]);return sum+(isNaN(v)?0:v);},0):0;
                    return(
                      <div key={s.key} style={{flex:1,background:C.white,borderRadius:16,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,.05)",border:`2px solid ${hasScore?tc:tbg}`}}>
                        <div style={{background:tc,padding:"8px 12px",color:C.white,fontSize:11,fontFamily:"Arial,sans-serif",fontWeight:700,letterSpacing:.8,textTransform:"uppercase",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span>{s.label}</span>
                          {isScramble&&prevTotal>0&&<span style={{fontSize:10,opacity:.85}}>+{prevTotal}</span>}
                        </div>
                        <div style={{padding:"16px 12px",display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
                          <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif"}}>Hole {holeNum}</div>
                          <input type="number" min="1" max="15" value={grossVal} onChange={e=>setScore(s.key,e.target.value)} placeholder="—"
                            style={{width:64,height:56,border:`2px solid ${grossVal?tc:C.light}`,borderRadius:14,textAlign:"center",fontSize:26,fontWeight:700,color:C.charcoal,outline:"none",fontFamily:"Arial,sans-serif",background:grossVal?C.mist:C.smoke}}/>
                          {hasScore&&<div style={{fontSize:11,color:tc,fontFamily:"Arial,sans-serif"}}>{scoreLabel(gross,par)}</div>}
                          {isScramble&&hasScore&&prevTotal>0&&<div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif"}}>Total: {prevTotal+gross}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ):(
              <>
                <div style={{background:C.white,borderRadius:16,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,.05)",border:`1.5px solid ${p1Team==="red"?C.redBg:C.blueBg}`}}>
                  <div style={{background:p1Team==="red"?C.red:C.blue,padding:"8px 16px",color:C.white,fontSize:11,fontFamily:"Arial,sans-serif",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>{match.p1}</div>
                  {p1Players.map(p=>{
                    const isExt=p.isExternal,grossVal=curScores[p.key]??"",gross=parseInt(grossVal);
                    const strks=!isExt&&!isNaN(gross)&&gross>0?sOnHole(p.ms,si):0;
                    const netVal=!isNaN(gross)&&gross>0?(isExt?getNetLive(p.key,curScores,holeNum):gross-sOnHole(p.ms,si)):null;
                    const isBanked=(bankedScores[holeNum]||{})[p.key];
                    return(
                      <div key={p.key}>
                        <div style={{padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div onClick={()=>!isExt&&setExpandHcp(expandHcp===p.key?null:p.key)} style={{cursor:isExt?"default":"pointer"}}>
                            <div style={{fontSize:14,fontWeight:600,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>
                              {p.name}{!isExt&&strks>0&&<span style={{fontSize:10,background:C.sand,padding:"1px 5px",borderRadius:6,color:C.charcoal,marginLeft:4}}>+{strks}</span>}
                              {isExt&&<span style={{fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif"}}> (guest)</span>}
                            </div>
                            <div style={{fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif"}}>{isExt?`HCP ${p.index||"?"}`:`HCP ${p.index} · tap for details`}</div>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            {netVal!==null&&<div style={{textAlign:"right"}}><div style={{fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif"}}>{showNet?"Net":"→Net"}</div><div style={{fontSize:18,fontWeight:700,color:C.forest}}>{showNet?netVal:gross}</div>{!showNet&&<div style={{fontSize:11,color:C.forest,fontFamily:"Arial,sans-serif"}}>net {netVal}</div>}</div>}
                            <input type="number" min="1" max="15" value={grossVal} onChange={e=>setScore(p.key,e.target.value)} placeholder="—"
                              style={{width:52,height:44,border:`2px solid ${grossVal?C.forest:C.light}`,borderRadius:12,textAlign:"center",fontSize:20,fontWeight:700,color:C.charcoal,outline:"none",fontFamily:"Arial,sans-serif",background:grossVal?C.mist:C.smoke}}/>
                            {isXBall&&!isExt&&grossVal&&(
                              <button onClick={()=>toggleBank(p.key)}
                                style={{width:36,height:36,borderRadius:10,border:`2px solid ${isBanked?C.forest:C.light}`,
                                  background:isBanked?C.forest:C.white,color:isBanked?C.white:C.gray,fontSize:16,cursor:"pointer",flexShrink:0,fontWeight:700}}>
                                {isBanked?"✓":"+"}
                              </button>
                            )}
                          </div>
                        </div>
                        {!isExt&&expandHcp===p.key&&<div style={{background:C.mist,padding:"10px 16px",fontSize:12,fontFamily:"Arial,sans-serif",color:C.slate,borderTop:`1px solid ${C.light}`}}><div>HCP Index: <strong>{p.index}</strong></div><div>Course HCP: <strong>{p.ch}</strong></div><div>Playing HCP: <strong>{p.ph}</strong></div><div>Match strokes: <strong>{p.ms>0?`+${p.ms}`:0}</strong></div><div>Strokes this hole (SI {si}): <strong>{strks>0?`+${strks}`:"None"}</strong></div></div>}
                      </div>
                    );
                  })}
                </div>
                <div style={{background:C.white,borderRadius:16,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,.05)",border:`1.5px solid ${p2Team==="red"?C.redBg:C.blueBg}`}}>
                  <div style={{background:p2Team==="red"?C.red:C.blue,padding:"8px 16px",color:C.white,fontSize:11,fontFamily:"Arial,sans-serif",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>{match.p2}</div>
                  {p2Players.map(p=>{
                    const isExt=p.isExternal,grossVal=curScores[p.key]??"",gross=parseInt(grossVal);
                    const strks=!isExt&&!isNaN(gross)&&gross>0?sOnHole(p.ms,si):0;
                    const netVal=!isNaN(gross)&&gross>0?(isExt?getNetLive(p.key,curScores,holeNum):gross-sOnHole(p.ms,si)):null;
                    const isBanked=(bankedScores[holeNum]||{})[p.key];
                    return(
                      <div key={p.key}>
                        <div style={{padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div onClick={()=>!isExt&&setExpandHcp(expandHcp===p.key?null:p.key)} style={{cursor:isExt?"default":"pointer"}}>
                            <div style={{fontSize:14,fontWeight:600,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>
                              {p.name}{!isExt&&strks>0&&<span style={{fontSize:10,background:C.sand,padding:"1px 5px",borderRadius:6,color:C.charcoal,marginLeft:4}}>+{strks}</span>}
                              {isExt&&<span style={{fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif"}}> (guest)</span>}
                            </div>
                            <div style={{fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif"}}>{isExt?`HCP ${p.index||"?"}`:`HCP ${p.index} · tap for details`}</div>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            {netVal!==null&&<div style={{textAlign:"right"}}><div style={{fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif"}}>{showNet?"Net":"→Net"}</div><div style={{fontSize:18,fontWeight:700,color:C.forest}}>{showNet?netVal:gross}</div>{!showNet&&<div style={{fontSize:11,color:C.forest,fontFamily:"Arial,sans-serif"}}>net {netVal}</div>}</div>}
                            <input type="number" min="1" max="15" value={grossVal} onChange={e=>setScore(p.key,e.target.value)} placeholder="—"
                              style={{width:52,height:44,border:`2px solid ${grossVal?C.forest:C.light}`,borderRadius:12,textAlign:"center",fontSize:20,fontWeight:700,color:C.charcoal,outline:"none",fontFamily:"Arial,sans-serif",background:grossVal?C.mist:C.smoke}}/>
                            {isXBall&&!isExt&&grossVal&&(
                              <button onClick={()=>toggleBank(p.key)}
                                style={{width:36,height:36,borderRadius:10,border:`2px solid ${isBanked?C.forest:C.light}`,
                                  background:isBanked?C.forest:C.white,color:isBanked?C.white:C.gray,fontSize:16,cursor:"pointer",flexShrink:0,fontWeight:700}}>
                                {isBanked?"✓":"+"}
                              </button>
                            )}
                          </div>
                        </div>
                        {!isExt&&expandHcp===p.key&&<div style={{background:C.mist,padding:"10px 16px",fontSize:12,fontFamily:"Arial,sans-serif",color:C.slate,borderTop:`1px solid ${C.light}`}}><div>HCP Index: <strong>{p.index}</strong></div><div>Course HCP: <strong>{p.ch}</strong></div><div>Playing HCP: <strong>{p.ph}</strong></div><div>Match strokes: <strong>{p.ms>0?`+${p.ms}`:0}</strong></div><div>Strokes this hole (SI {si}): <strong>{strks>0?`+${strks}`:"None"}</strong></div></div>}
                      </div>
                    );
                  })}
                </div>

                {/* X-Ball running totals — 20 Ball / 40 Ball banking progress */}
                {isXBall&&(
                  <div style={{display:"flex",gap:10}}>
                    {[{label:match.p1,team:p1Team,keys:[...(match.p1Keys||[]),...p1ExtPlayers.map(p=>p.key)]},
                      {label:match.p2,team:p2Team,keys:[...(match.p2Keys||[]),...p2ExtPlayers.map(p=>p.key)]}].map(side=>{
                      const bankedCount=bankedCountForSide(side.keys);
                      const netTotal=bankedNetTotalForSide(side.keys);
                      const tc=side.team==="red"?C.red:C.blue;
                      return(
                        <div key={side.label} style={{flex:1,background:C.mist,borderRadius:12,padding:"10px 12px",textAlign:"center"}}>
                          <div style={{fontSize:11,fontWeight:700,color:tc,fontFamily:"Arial,sans-serif"}}>{side.label}</div>
                          <div style={{fontSize:18,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>{bankedCount}/{xBallTarget}</div>
                          <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif"}}>banked · net {netTotal>0?`+${netTotal}`:netTotal}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}


            {/* Hole result preview — match play only */}
            {!isScramble && !isXBall && preview&&(()=>{
              const col=preview==="p1"?(p1Team==="red"?C.red:C.blue):preview==="p2"?(p2Team==="red"?C.red:C.blue):C.slate;
              const txt=preview==="p1"?`${match.p1} wins hole`:preview==="p2"?`${match.p2} wins hole`:"Hole tied";
              const bg2=preview==="p1"?(p1Team==="red"?C.redBg:C.blueBg):preview==="p2"?(p2Team==="red"?C.redBg:C.blueBg):C.mist;
              return(<div style={{background:bg2,borderRadius:14,padding:"12px 16px",textAlign:"center"}}><div style={{fontSize:15,fontWeight:700,color:col,fontFamily:"Arial,sans-serif"}}>{txt}</div><div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:3}}>Tap Submit to confirm</div></div>);
            })()} 

            <button onClick={submitHole} disabled={!allEntered}
              style={{...bigBtn(`linear-gradient(135deg,${allEntered?C.forest:"#9CA3AF"},${allEntered?C.fairway:"#D1D5DB"})`,C.white),
                boxShadow:allEntered?"0 6px 20px rgba(27,67,50,.25)":"none",
                cursor:allEntered?"pointer":"not-allowed"}}>
              {allEntered
                ? (isXBall ? `Next Hole →` : isScramble ? `Submit My Team's Score →` : `Submit Hole ${holeNum} →`)
                : (isScramble ? "Enter your team's score" : "Enter at least one score per side")}
            </button>
          </>
        )}

        {/* Previous holes scorecard */}
        {confirmedThru > 0 && (()=>{
          const playedHoles = Array.from({length:confirmedThru},(_,i)=>i+1);
          return(
            <div style={{background:C.white,borderRadius:16,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
              <div onClick={()=>setExpandScorecard(!expandScorecard)} style={{padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:C.charcoal}}>Scorecard — Holes 1–{confirmedThru}</div>
                  <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:1}}>{status.text} · tap to {expandScorecard?"collapse":"expand"}</div>
                </div>
                <span style={{fontSize:13,color:C.gray}}>{expandScorecard?"▲":"▼"}</span>
              </div>
              {expandScorecard&&(
                <div style={{borderTop:`1px solid ${C.mist}`,padding:"10px 14px"}}>
                  {/* Hole numbers header */}
                  <div style={{display:"flex",gap:2,marginBottom:6}}>
                    <div style={{width:46,fontSize:9,color:C.gray,fontFamily:"Arial,sans-serif",flexShrink:0}}></div>
                    {playedHoles.map(h=>(
                      <div key={h} style={{flex:1,textAlign:"center",fontSize:9,fontWeight:700,color:C.gray,fontFamily:"Arial,sans-serif",minWidth:20}}>{h}</div>
                    ))}
                    <div style={{width:26,textAlign:"center",fontSize:9,fontWeight:700,color:C.gray,fontFamily:"Arial,sans-serif"}}>Tot</div>
                  </div>
                  {/* Par row */}
                  <div style={{display:"flex",gap:2,marginBottom:4}}>
                    <div style={{width:46,fontSize:9,color:C.gray,fontFamily:"Arial,sans-serif",flexShrink:0}}>Par</div>
                    {playedHoles.map(h=>(
                      <div key={h} style={{flex:1,textAlign:"center",fontSize:9,color:C.gray,fontFamily:"Arial,sans-serif",minWidth:20}}>{course.pars[h-1]}</div>
                    ))}
                    <div style={{width:26,textAlign:"center",fontSize:9,color:C.gray,fontFamily:"Arial,sans-serif"}}>{playedHoles.reduce((s,h)=>s+course.pars[h-1],0)}</div>
                  </div>
                  {/* Player/team rows */}
                  {isScramble ? (
                    // Scramble: show one row per team with team scores
                    [{label:match.p1, team:p1Team, key:"team_p1"}, {label:match.p2, team:p2Team, key:"team_p2"}].map(side=>{
                      const tc = side.team==="red"?C.red:C.blue;
                      const total = playedHoles.reduce((s,h)=>{const v=parseInt((holeScores[h]||{})[side.key]);return s+(isNaN(v)?0:v);},0);
                      return(
                        <div key={side.key} style={{display:"flex",gap:2,marginBottom:3,alignItems:"center"}}>
                          <div style={{width:46,fontSize:10,fontWeight:700,color:tc,fontFamily:"Arial,sans-serif",flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                            {side.label.split(" / ")[0]}
                          </div>
                          {playedHoles.map(h=>{
                            const val=(holeScores[h]||{})[side.key];
                            const gross=parseInt(val);
                            const par=course.pars[h-1];
                            const bg=!isNaN(gross)&&gross>0?(gross<par?C.greenBg:gross===par?C.white:gross===par+1?C.amberBg:C.redBg):C.smoke;
                            const col=!isNaN(gross)&&gross>0?(gross<par?C.green:gross===par?C.charcoal:gross===par+1?C.amber:C.red):C.gray;
                            return(
                              <div key={h} style={{flex:1,minWidth:20,height:20,borderRadius:4,background:bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                <span style={{fontSize:9,fontWeight:700,color:col,fontFamily:"Arial,sans-serif"}}>{!isNaN(gross)&&gross>0?gross:"·"}</span>
                              </div>
                            );
                          })}
                          <div style={{width:26,textAlign:"center",fontSize:10,fontWeight:700,color:tc,fontFamily:"Arial,sans-serif"}}>{total>0?total:"—"}</div>
                        </div>
                      );
                    })
                  ) : (
                    // Match play: show individual player rows
                    [...p1Players,...p2Players].map((p,pi)=>{
                    const isExt = p.isExternal;
                    const sideColor = pi<p1Players.length
                      ? (p1Team==="red"?C.red:C.blue)
                      : (p2Team==="red"?C.red:C.blue);
                    const total=playedHoles.reduce((s,h)=>{const v=parseInt(holeScores[h]?.[p.key]);return s+(isNaN(v)?0:v);},0);
                    return(
                      <div key={p.key} style={{display:"flex",gap:2,marginBottom:3,alignItems:"center"}}>
                        <div style={{width:46,fontSize:10,fontWeight:700,color:sideColor,fontFamily:"Arial,sans-serif",flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {p.name}{isExt&&<span style={{fontSize:8,color:C.gray}}> *</span>}
                        </div>
                        {playedHoles.map(h=>{
                          const val=holeScores[h]?.[p.key];
                          const gross=parseInt(val);
                          const par=course.pars[h-1];
                          const bg=!isNaN(gross)&&gross>0?(gross<par?C.greenBg:gross===par?C.white:gross===par+1?C.amberBg:C.redBg):C.smoke;
                          const col=!isNaN(gross)&&gross>0?(gross<par?C.green:gross===par?C.charcoal:gross===par+1?C.amber:C.red):C.gray;
                          return(
                            <div key={h} style={{flex:1,minWidth:20,height:20,borderRadius:4,background:bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
                              <span style={{fontSize:9,fontWeight:700,color:col,fontFamily:"Arial,sans-serif"}}>{!isNaN(gross)&&gross>0?gross:"·"}</span>
                            </div>
                          );
                        })}
                        <div style={{width:26,textAlign:"center",fontSize:10,fontWeight:700,color:sideColor,fontFamily:"Arial,sans-serif"}}>{total>0?total:"—"}</div>
                      </div>
                    );
                  }))}
                  {/* Hole result row — match play only */}
                  {!isScramble&&(
                  <div style={{display:"flex",gap:2,marginTop:6,alignItems:"center"}}>
                    <div style={{width:46,fontSize:9,color:C.gray,fontFamily:"Arial,sans-serif",flexShrink:0}}>Result</div>
                    {playedHoles.map(h=>{
                      const res=holeResults[h];
                      const wt=res==="p1"?matchWinningTeam({...match,winnerSide:"p1"},tripPlayers):res==="p2"?matchWinningTeam({...match,winnerSide:"p2"},tripPlayers):"tie";
                      const bg=wt==="red"?C.redBg:wt==="blue"?C.blueBg:C.mist;
                      const col=wt==="red"?C.red:wt==="blue"?C.blue:C.gray;
                      return(
                        <div key={h} style={{flex:1,minWidth:20,height:20,borderRadius:4,background:bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
                          <span style={{fontSize:9,fontWeight:700,color:col,fontFamily:"Arial,sans-serif"}}>{wt==="red"?"R":wt==="blue"?"B":res?"–":"·"}</span>
                        </div>
                      );
                    })}
                    <div style={{width:26}}/>
                  </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Side games teaser */}
        <div style={{background:C.white,borderRadius:16,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
          <div onClick={()=>setExpandSide(!expandSide)} style={{padding:"13px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
            <div style={{fontSize:13,fontWeight:700,color:C.charcoal}}>Side Games</div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:12,color:C.forest,fontFamily:"Arial,sans-serif",fontWeight:600,cursor:"pointer"}} onClick={e=>{e.stopPropagation();go("sidegames");}}>Full View →</span>
              <span style={{fontSize:13,color:C.gray}}>{expandSide?"▲":"▼"}</span>
            </div>
          </div>
          {expandSide&&(
            <div style={{background:C.mist,padding:"12px 16px",display:"flex",flexDirection:"column",gap:8}}>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>Skins</span><span style={{fontSize:12,color:C.forest,fontFamily:"Arial,sans-serif"}}>4 won so far</span></div>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>Nassau</span><span style={{fontSize:12,color:C.red,fontFamily:"Arial,sans-serif",fontWeight:600}}>Red up F9</span></div>
            </div>
          )}
        </div>
      </div>

      {showUndo&&(
        <div style={{position:"absolute",bottom:16,left:"50%",transform:"translateX(-50%)",background:C.charcoal,color:C.white,borderRadius:12,padding:"10px 18px",display:"flex",alignItems:"center",gap:12,fontSize:13,fontFamily:"Arial,sans-serif",boxShadow:"0 4px 16px rgba(0,0,0,.25)",zIndex:99,whiteSpace:"nowrap"}}>
          Hole {holeNum-1} recorded
          <button onClick={undoHole} style={{background:C.sand,color:C.charcoal,border:"none",borderRadius:8,padding:"4px 10px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Arial,sans-serif"}}>Undo</button>
        </div>
      )}
    </div>
  );
}

// ─── FORMAT CARD (reusable, expandable rules panel) ──────────────────────────
function FormatCard({item, actionLabel, isFormat}){
  const [open, setOpen] = useState(false);
  return(
    <div style={{background:C.white,borderRadius:16,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,.05)",marginBottom:6,border:`1px solid ${open?C.forest+"33":C.mist}`}}>
      {/* Header row — always visible */}
      <div style={{display:"flex",alignItems:"flex-start",gap:12,padding:"13px 14px",cursor:"pointer"}} onClick={()=>setOpen(!open)}>
        {isFormat
          ? <div style={{width:36,height:36,borderRadius:10,background:C.mist,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <span style={{fontSize:13,fontWeight:700,color:C.forest,fontFamily:"Arial,sans-serif"}}>{calcInitials(item.name)}</span>
            </div>
          : <div style={{fontSize:24,flexShrink:0,marginTop:2}}>{item.icon}</div>
        }
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <div style={{fontSize:14,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>{item.name}</div>
            {!isFormat&&<span style={{...pill(C.mist,C.gray),fontSize:10}}>{item.cat}</span>}
            {isFormat&&<span style={{...pill(C.mist,C.forest),fontSize:10}}>WHS {item.whs}</span>}
          </div>
          <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:3,lineHeight:1.4}}>{item.desc}</div>
          <div style={{fontSize:11,color:C.forest,fontFamily:"Arial,sans-serif",marginTop:5,fontWeight:600}}>
            {open ? "▲ Hide rules" : "▼ How to play"}
          </div>
        </div>
        <div style={{...pill(C.mist,C.forest),fontSize:11,flexShrink:0,cursor:"pointer",alignSelf:"flex-start",marginTop:2}}
          onClick={e=>{e.stopPropagation();}}>{actionLabel}</div>
      </div>
      {/* Expandable rules */}
      {open&&(
        <div style={{background:C.mist,borderTop:`1px solid ${C.light}`,padding:"12px 14px"}}>
          <div style={{fontSize:12,color:C.slate,fontFamily:"Arial,sans-serif",lineHeight:1.6}}>{item.rules}</div>
        </div>
      )}
    </div>
  );
}

// ─── SIDE GAMES HUB ───────────────────────────────────────────────────────────
function SideGamesScreen({go, goBack}){
  const [tab,setTab]=useState("Active");
  const [catFilter,setCatFilter]=useState("All");

  // ── Nassau state (interactive) ────────────────────────────────────────────
  const [nassau,setNassau]=useState({
    bet:10, carryovers:true,
    // Per-hole results loaded from completed Round 1
    holes:{1:"red",2:"tie",3:"blue",4:"red",5:"red",6:"tie",7:"red",8:"blue",9:"red"},
  });

  const nassauCalc = (holes,bet,carryovers) => {
    let f9={red:0,blue:0,carry:0}, b9={red:0,blue:0,carry:0}, overall={red:0,blue:0};
    // Front 9
    for(let h=1;h<=9;h++){
      const r=holes[h];
      if(!r){continue;}
      if(r==="tie"){if(carryovers)f9.carry+=bet;continue;}
      if(r==="red"){f9.red+=bet+f9.carry;f9.carry=0;}
      else{f9.blue+=bet+f9.carry;f9.carry=0;}
    }
    if(f9.carry>0&&carryovers){// uncollected carryover rolls to back
      b9.carry+=f9.carry;f9.carry=0;
    }
    // Back 9
    for(let h=10;h<=18;h++){
      const r=holes[h];
      if(!r){continue;}
      if(r==="tie"){if(carryovers)b9.carry+=bet;continue;}
      if(r==="red"){b9.red+=bet+b9.carry;b9.carry=0;}
      else{b9.blue+=bet+b9.carry;b9.carry=0;}
    }
    // Overall
    const totalRed=Object.values(holes).filter(v=>v==="red").length;
    const totalBlue=Object.values(holes).filter(v=>v==="blue").length;
    if(totalRed>totalBlue)overall.red=bet;
    else if(totalBlue>totalRed)overall.blue=bet;
    return {f9,b9,overall,pendingCarry:f9.carry+b9.carry};
  };

  const nassauResult = nassauCalc(nassau.holes, nassau.bet, nassau.carryovers);
  const nassauNetRed  = nassauResult.f9.red  + nassauResult.b9.red  + nassauResult.overall.red;
  const nassauNetBlue = nassauResult.f9.blue + nassauResult.b9.blue + nassauResult.overall.blue;

  // ── Skins state ────────────────────────────────────────────────────────────
  const [skinsBet,setSkinsBet]=useState(10);
  const skinsData=[
    {hole:2, winner:"Louie",net:3,par:5,carried:false},
    {hole:5, winner:"Mike", net:2,par:3,carried:false},
    {hole:7, winner:null,   net:null,par:4,carried:true, note:"Tied — carries to Hole 8"},
    {hole:9, winner:"Ryan", net:4,par:4,carried:false},
    {hole:11,winner:"Louie",net:4,par:5,carried:false},
  ];
  const skinsWon = skinsData.filter(s=>s.winner);
  const skinsCarrying = skinsData.filter(s=>s.carried).length;
  const skinsTotals = skinsWon.reduce((acc,s)=>{acc[s.winner]=(acc[s.winner]||0)+1;return acc;},{});

  // ── Wolf state ─────────────────────────────────────────────────────────────
  const wolfOrder=["Louie","Ryan","Mike","John"];
  const wolfData=[
    {hole:1,wolf:"Louie",partner:"Ryan",  result:"wolf_wins", pts:[2,1,0,0]},
    {hole:2,wolf:"Ryan", partner:null,    result:"lone_loss",  pts:[-2,2,2,2],lone:true},
    {hole:3,wolf:"Mike", partner:"John",  result:"partner_wins",pts:[0,0,2,2]},
    {hole:4,wolf:"John", partner:"Louie", result:"wolf_wins",  pts:[1,0,0,1]},
    {hole:5,wolf:"Louie",partner:"Mike",  result:"wolf_wins",  pts:[2,0,1,0]},
  ];
  const wolfTotals=wolfOrder.reduce((acc,p)=>{acc[p]=0;return acc;},{});
  wolfData.forEach((h,hi)=>wolfOrder.forEach((p,pi)=>{wolfTotals[p]+=(h.pts[pi]||0);}));

  const filtered = SIDE_GAMES.filter(g=>catFilter==="All"||g.cat===catFilter);

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",background:C.smoke}}>
      <div style={{background:`linear-gradient(135deg,${C.forest},${C.fairway})`,padding:"14px 20px 18px"}}>
        <div style={{marginBottom:8}}><BackBtn goBack={goBack} go={go} to="board"/></div>
        <div style={{color:"rgba(255,255,255,.6)",fontSize:11,fontFamily:"Arial,sans-serif",letterSpacing:"1.2px",textTransform:"uppercase",marginBottom:3}}>Sand Valley Ryder Cup</div>
        <div style={{color:C.white,fontSize:20,fontWeight:700}}>Side Games</div>
      </div>

      <div style={{background:C.white,padding:"10px 16px",display:"flex",gap:8,borderBottom:`1px solid ${C.light}`,overflowX:"auto"}}>
        {["Active","All Games"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{background:tab===t?C.forest:"transparent",color:tab===t?C.white:C.gray,border:`1.5px solid ${tab===t?C.forest:C.light}`,borderRadius:20,padding:"6px 16px",fontSize:12,fontFamily:"Arial,sans-serif",fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>{t}</button>
        ))}
      </div>

      <div style={{flex:1,padding:16,display:"flex",flexDirection:"column",gap:14,overflowY:"auto"}}>

        {/* ── ACTIVE GAMES ── */}
        {tab==="Active"&&(
          <>
            {/* Nassau */}
            <div style={card()}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:C.charcoal}}>Nassau</div>
                  <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:1}}>Round 1 · ${nassau.bet}/bet · {nassau.carryovers?"Carryovers on":"No carryovers"}</div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:11,fontFamily:"Arial,sans-serif",color:C.gray}}>Carry:</span>
                  <div onClick={()=>setNassau(n=>({...n,carryovers:!n.carryovers}))} style={{width:36,height:20,borderRadius:10,background:nassau.carryovers?C.forest:C.light,cursor:"pointer",position:"relative"}}>
                    <div style={{position:"absolute",top:2,left:nassau.carryovers?16:2,width:16,height:16,borderRadius:"50%",background:C.white,boxShadow:"0 1px 3px rgba(0,0,0,.2)",transition:"left .15s"}}/>
                  </div>
                </div>
              </div>

              {/* Hole grid — rows 1-9 */}
              <div style={{marginBottom:10}}>
                <div style={{fontSize:11,fontWeight:700,color:C.gray,fontFamily:"Arial,sans-serif",marginBottom:5}}>FRONT 9</div>
                <div style={{display:"flex",gap:3}}>
                  {Array.from({length:9},(_,i)=>i+1).map(h=>{
                    const res=nassau.holes[h];
                    return(
                      <div key={h} style={{flex:1,textAlign:"center"}}>
                        <div style={{fontSize:9,color:C.gray,fontFamily:"Arial,sans-serif",marginBottom:2}}>{h}</div>
                        <div style={{height:20,borderRadius:6,background:res==="red"?C.redBg:res==="blue"?C.blueBg:res==="tie"?C.mist:C.smoke,display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${C.light}`}}>
                          <span style={{fontSize:9,fontWeight:700,color:res==="red"?C.red:res==="blue"?C.blue:C.gray,fontFamily:"Arial,sans-serif"}}>{res==="red"?"R":res==="blue"?"B":res==="tie"?"–":"·"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Results breakdown */}
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {[
                  {label:"Front 9",  red:nassauResult.f9.red,   blue:nassauResult.f9.blue,   carry:nassauResult.f9.carry},
                  {label:"Back 9",   red:nassauResult.b9.red,   blue:nassauResult.b9.blue,   carry:nassauResult.b9.carry},
                  {label:"Overall",  red:nassauResult.overall.red,blue:nassauResult.overall.blue,carry:0},
                ].map(row=>{
                  const winner=row.red>row.blue?"red":row.blue>row.red?"blue":null;
                  return(
                    <div key={row.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 10px",borderRadius:10,background:C.smoke}}>
                      <span style={{fontSize:12,fontWeight:700,color:C.slate,fontFamily:"Arial,sans-serif",width:64}}>{row.label}</span>
                      <span style={{fontSize:12,fontWeight:700,color:C.red,fontFamily:"Arial,sans-serif"}}>{row.red>0?`Red +$${row.red}`:"—"}</span>
                      <span style={{fontSize:12,fontWeight:700,color:C.blue,fontFamily:"Arial,sans-serif"}}>{row.blue>0?`Blue +$${row.blue}`:"—"}</span>
                      {row.carry>0&&<span style={{...pill(C.amberBg,C.amber),fontSize:10}}>Carry ${row.carry}</span>}
                    </div>
                  );
                })}
                <div style={{display:"flex",justifyContent:"space-between",padding:"8px 10px",borderRadius:10,background:nassauNetRed>nassauNetBlue?C.redBg:nassauNetBlue>nassauNetRed?C.blueBg:C.mist,marginTop:2}}>
                  <span style={{fontSize:13,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>Net</span>
                  <span style={{fontSize:14,fontWeight:700,color:nassauNetRed>0?C.red:C.blue,fontFamily:"Arial,sans-serif"}}>
                    {nassauNetRed>nassauNetBlue?`Red +$${nassauNetRed-nassauNetBlue}`:nassauNetBlue>nassauNetRed?`Blue +$${nassauNetBlue-nassauNetRed}`:"All Square"}
                  </span>
                </div>
                {nassauResult.pendingCarry>0&&<div style={{...pill(C.amberBg,C.amber),textAlign:"center",fontSize:11}}>${nassauResult.pendingCarry} still in play</div>}
              </div>
            </div>

            {/* Skins */}
            <div style={card()}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:C.charcoal}}>Skins</div>
                  <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:1}}>Round 2 · ${skinsBet}/skin · {18-skinsWon.length} holes remaining</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:18,fontWeight:700,color:C.forest}}>${skinsWon.length*skinsBet}</div>
                  <div style={{fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif"}}>distributed</div>
                </div>
              </div>

              {/* Skins won */}
              {skinsData.map((s,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<skinsData.length-1?`1px solid ${C.mist}`:"none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:28,height:28,borderRadius:8,background:s.winner?C.greenBg:s.carried?C.amberBg:C.mist,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <span style={{fontSize:11,fontWeight:700,color:s.winner?C.green:s.carried?C.amber:C.gray,fontFamily:"Arial,sans-serif"}}>{s.hole}</span>
                    </div>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>Hole {s.hole} · Par {s.par}</div>
                      {s.winner&&<div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif"}}>Net {s.net}</div>}
                      {s.carried&&<div style={{fontSize:11,color:C.amber,fontFamily:"Arial,sans-serif"}}>{s.note}</div>}
                    </div>
                  </div>
                  {s.winner
                    ? <div style={{textAlign:"right"}}><div style={{fontSize:13,fontWeight:700,color:C.green,fontFamily:"Arial,sans-serif"}}>{s.winner}</div><div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif"}}>+${skinsBet}</div></div>
                    : s.carried?<span style={{...pill(C.amberBg,C.amber),fontSize:10}}>Carry</span>:<span style={{...pill(C.mist,C.gray),fontSize:10}}>Open</span>
                  }
                </div>
              ))}

              {/* Running totals */}
              <div style={{marginTop:10,background:C.mist,borderRadius:10,padding:"10px 12px"}}>
                <div style={{fontSize:11,fontWeight:700,color:C.slate,fontFamily:"Arial,sans-serif",marginBottom:6}}>Running Totals</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {Object.entries(skinsTotals).sort((a,b)=>b[1]-a[1]).map(([name,n])=>(
                    <div key={name} style={{background:C.white,borderRadius:8,padding:"6px 10px",textAlign:"center",minWidth:56}}>
                      <div style={{fontSize:13,fontWeight:700,color:C.green,fontFamily:"Arial,sans-serif"}}>{n}</div>
                      <div style={{fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif"}}>{name}</div>
                      <div style={{fontSize:10,color:C.forest,fontFamily:"Arial,sans-serif"}}>+${n*skinsBet}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Wolf */}
            <div style={card()}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:C.charcoal}}>Wolf</div>
                  <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:1}}>Round 2 · Rotation: {wolfOrder.join(" → ")}</div>
                </div>
              </div>

              {/* Hole log */}
              {wolfData.map((h,i)=>{
                const resultLabel=h.lone?(h.result==="lone_win"?"Lone wolf wins":"Lone wolf loses"):h.result==="wolf_wins"?"Wolf team wins":"Partner wins";
                const resultColor=h.result.includes("win")||h.result==="wolf_wins"?C.green:C.red;
                return(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<wolfData.length-1?`1px solid ${C.mist}`:"none"}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>Hole {h.hole} · Wolf: {h.wolf}</div>
                      <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif"}}>{h.lone?`${h.wolf} went alone`:h.partner?`Partner: ${h.partner}`:"No partner"}</div>
                    </div>
                    <div style={{...pill(h.result.includes("win")||h.result==="wolf_wins"?C.greenBg:C.redBg,resultColor),fontSize:11}}>{resultLabel}</div>
                  </div>
                );
              })}

              {/* Points table */}
              <div style={{marginTop:10,background:C.mist,borderRadius:10,padding:"10px 12px"}}>
                <div style={{fontSize:11,fontWeight:700,color:C.slate,fontFamily:"Arial,sans-serif",marginBottom:6}}>Points</div>
                <div style={{display:"flex",gap:8}}>
                  {Object.entries(wolfTotals).sort((a,b)=>b[1]-a[1]).map(([name,pts])=>(
                    <div key={name} style={{flex:1,background:C.white,borderRadius:8,padding:"8px 6px",textAlign:"center"}}>
                      <div style={{fontSize:16,fontWeight:700,color:pts>0?C.green:pts<0?C.red:C.gray,fontFamily:"Arial,sans-serif"}}>{pts>0?`+${pts}`:pts}</div>
                      <div style={{fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:2}}>{name}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── ALL GAMES CATALOGUE ── */}
        {tab==="All Games"&&(
          <>
            <div style={{fontSize:13,color:C.slate,fontFamily:"Arial,sans-serif"}}>Any format below can be the scoring method for a match (earns Ryder Cup points). Side games run alongside for money. Tap any card to read the full rules.</div>

            {/* Match Formats */}
            <div style={{fontSize:11,fontWeight:700,color:C.gray,fontFamily:"Arial,sans-serif",letterSpacing:.8,textTransform:"uppercase",padding:"4px 2px"}}>Match Formats (earn Ryder Cup points)</div>
            {MATCH_FORMATS.map(f=>(
              <FormatCard key={f.id} item={f} actionLabel="+ Use" isFormat={true}/>
            ))}

            {/* Side Games */}
            <div style={{fontSize:11,fontWeight:700,color:C.gray,fontFamily:"Arial,sans-serif",letterSpacing:.8,textTransform:"uppercase",padding:"4px 2px",marginTop:6}}>Side Games (run alongside any format)</div>

            {/* Category filter */}
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {GAME_CATS.map(cat=>(
                <button key={cat} onClick={()=>setCatFilter(cat)} style={{background:catFilter===cat?C.forest:"transparent",color:catFilter===cat?C.white:C.gray,border:`1.5px solid ${catFilter===cat?C.forest:C.light}`,borderRadius:20,padding:"5px 13px",fontSize:12,fontFamily:"Arial,sans-serif",fontWeight:600,cursor:"pointer"}}>{cat}</button>
              ))}
            </div>

            {SIDE_GAMES.filter(g=>catFilter==="All"||g.cat===catFilter).map(g=>(
              <FormatCard key={g.id} item={g} actionLabel="+ Add" isFormat={false}/>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── WHS BREAKDOWN ────────────────────────────────────────────────────────────
function WHSBreakdown(){
  const [open,setOpen]=useState(false);
  // Static illustrative example — no real player names or trip data
  const exSlope=133, exRating=72.0, exPar=72;
  const examples=[
    {name:"Player A", index:8.4},
    {name:"Player B", index:14.2},
    {name:"Player C", index:20.1},
    {name:"Player D", index:5.0},
  ].map(p=>{
    const ch=Math.round(p.index*(exSlope/113)+(exRating-exPar));
    const ph=Math.round(ch*0.90);
    return {...p,ch,ph};
  });
  const lowestPH=Math.min(...examples.map(p=>p.ph));
  return(
    <div style={{background:C.white,borderRadius:16,overflow:"hidden",boxShadow:"0 2px 10px rgba(0,0,0,.06)"}}>
      <div onClick={()=>setOpen(!open)} style={{padding:"13px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:C.charcoal}}>How WHS Handicaps Work</div>
          {!open&&<div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:2}}>Tap to see how strokes are calculated</div>}
        </div>
        <span style={{fontSize:18,color:C.gray}}>{open?"▲":"▼"}</span>
      </div>
      {open&&(
        <div style={{borderTop:`1px solid ${C.mist}`,padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif",background:C.mist,borderRadius:8,padding:"8px 10px",lineHeight:1.5}}>
            Illustrative example · Slope {exSlope} · Rating {exRating} · Par {exPar} · Best Ball (90%)
          </div>
          <div style={{display:"flex",gap:4}}>
            {["Player","HCP Index","Course HCP","Playing HCP","Strokes Given"].map(h=>(
              <div key={h} style={{flex:1,fontSize:9,fontFamily:"Arial,sans-serif",color:C.gray,fontWeight:700,textTransform:"uppercase",textAlign:"center",lineHeight:1.3}}>{h}</div>
            ))}
          </div>
          {examples.map(p=>(
            <div key={p.name} style={{display:"flex",gap:4,padding:"6px 0",borderBottom:`1px solid ${C.mist}`,alignItems:"center"}}>
              <div style={{flex:1,fontSize:12,fontFamily:"Arial,sans-serif",fontWeight:600,color:C.charcoal,textAlign:"center"}}>{p.name}</div>
              <div style={{flex:1,fontSize:12,fontFamily:"Arial,sans-serif",color:C.slate,textAlign:"center"}}>{p.index}</div>
              <div style={{flex:1,fontSize:12,fontFamily:"Arial,sans-serif",color:C.slate,textAlign:"center"}}>{p.ch}</div>
              <div style={{flex:1,fontSize:12,fontFamily:"Arial,sans-serif",color:C.forest,fontWeight:700,textAlign:"center"}}>{p.ph}</div>
              <div style={{flex:1,fontSize:13,fontFamily:"Arial,sans-serif",color:C.charcoal,fontWeight:700,textAlign:"center"}}>
                {p.ph===lowestPH?<span style={{color:C.gray}}>—</span>:`+${p.ph-lowestPH}`}
              </div>
            </div>
          ))}
          <div style={{fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif",lineHeight:1.6,background:C.mist,borderRadius:10,padding:"8px 10px"}}>
            <strong>Course HCP</strong> = Index × Slope÷113 + (Rating−Par){"\n"}
            <strong>Playing HCP</strong> = Course HCP × 90% (Best Ball/Scramble) or 100% (Singles){"\n"}
            <strong>Strokes</strong> = difference from the lowest Playing HCP in the match
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LEADERBOARD ──────────────────────────────────────────────────────────────
function LeaderboardScreen({go, ts, playerRecords, matches, tripPlayers, activeTrip, userInitials}){
  const [sortBy,  setSortBy] = useState("Points");
  const [showAll, setShowAll]= useState(false);
  const parseWins = rec => parseInt((rec||"0–0–0").split("–")[0])||0;

  // Use real trip players if available, otherwise fall back to demo RAW data
  const usingRealData = tripPlayers && tripPlayers.length > 0;

  const allParticipants = usingRealData
    ? tripPlayers.map(tp => ({
        key:    tp.name.toLowerCase(),
        name:   tp.name,
        team:   tp.team || "red",
        index:  tp.hcp_index,
        isGuest:!!tp.is_guest,
        money:  0,
        skinsWon:0,
        rounds: [],
      }))
    : []; // No trip yet — show nothing instead of demo players

  const players = allParticipants.map(p=>({
    ...p,
    points: playerRecords[p.key]?.pts  || 0,
    record: playerRecords[p.key]?.record || "0–0–0",
    w:      playerRecords[p.key]?.w    || 0,
    l:      playerRecords[p.key]?.l    || 0,
    h:      playerRecords[p.key]?.h    || 0,
    played:(playerRecords[p.key]?.w||0)+(playerRecords[p.key]?.l||0)+(playerRecords[p.key]?.h||0),
  }))
    .sort((a,b)=>{
      if(sortBy==="Points") return b.points!==a.points ? b.points-a.points : b.played-a.played;
      if(sortBy==="Money")  return (b.money||0)-(a.money||0);
      if(sortBy==="Record") return parseWins(b.record)-parseWins(a.record);
      return 0;
    })
    .map((p,i)=>({...p,rank:i+1}));

  const hasPlayed  = players.filter(p=>p.played>0);
  const notPlayed  = players.filter(p=>p.played===0);
  const hasPoints  = players.filter(p=>p.points>0);
  const visiblePlayers = players.length<=10||showAll ? players : players.slice(0,Math.max(4,hasPlayed.length));
  const hiddenCount    = players.length - visiblePlayers.length;

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",background:C.smoke}}>
      <Header sub="⛳ MatchUp Golf" title="Leaderboard" detail={activeTrip?.name||"Trip"} onProfile={()=>go("profile")} initials={userInitials}/>
      <div style={{flex:1,padding:16,display:"flex",flexDirection:"column",gap:14,overflowY:"auto"}}>
        <TeamScoreCards ts={ts}/>

        {/* Individual leaderboard — compact list */}
        <div style={card()}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:15,fontWeight:700,color:C.charcoal}}>Individual</div>
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
              style={{border:`1.5px solid ${C.light}`,borderRadius:8,padding:"4px 8px",fontSize:11,
                fontFamily:"Arial,sans-serif",color:C.forest,fontWeight:600,background:C.white,cursor:"pointer"}}>
              {["Points","Record","Money"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>

          {players.length === 0 && (
            <div style={{textAlign:"center",padding:"32px 16px",color:C.gray,fontFamily:"Arial,sans-serif"}}>
              <div style={{fontSize:24,marginBottom:8}}>📋</div>
              <div style={{fontSize:13,fontWeight:700,color:C.charcoal,marginBottom:4}}>No players yet</div>
              <div style={{fontSize:12}}>Add players to your trip to see the leaderboard.</div>
            </div>
          )}

          {players.length > 0 && visiblePlayers.map((p,i)=>{
            const hasPlayed_p = p.played > 0;
            const hasPoints_p = p.points > 0;
            const tc = teamColor(p.team);
            return(
              <div key={p.key} style={{
                display:"flex",alignItems:"center",gap:10,
                padding:"8px 0",
                borderBottom: i<visiblePlayers.length-1 ? `1px solid ${C.mist}` : "none",
                opacity: hasPlayed_p ? 1 : 0.5,
              }}>
                {/* Rank */}
                <div style={{width:18,fontSize:12,fontWeight:700,color:C.gray,fontFamily:"Arial,sans-serif",textAlign:"center",flexShrink:0}}>{p.rank}</div>
                {/* Color bar */}
                <div style={{width:3,height:28,borderRadius:2,background:tc,flexShrink:0}}/>
                {/* Name + record */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif",
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                  <div style={{fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif"}}>
                    {hasPlayed_p ? p.record : "No matches yet"}
                    {p.index!=null ? ` · HCP ${p.index}` : ""}
                  </div>
                </div>
                {/* Score */}
                <div style={{textAlign:"right",flexShrink:0}}>
                  {sortBy==="Points"&&(
                    <div style={{fontSize:16,fontWeight:700,color:hasPoints_p?tc:hasPlayed_p?C.gray:C.light,fontFamily:"Arial,sans-serif"}}>
                      {hasPoints_p ? fmtPts(p.points) : hasPlayed_p ? "0" : "—"}
                    </div>
                  )}
                  {sortBy==="Record"&&(
                    <div style={{fontSize:13,fontWeight:700,color:hasPlayed_p?tc:C.light,fontFamily:"Arial,sans-serif"}}>
                      {hasPlayed_p ? p.record : "—"}
                    </div>
                  )}
                  {sortBy==="Money"&&(
                    <div style={{fontSize:14,fontWeight:700,color:p.money>0?C.green:p.money<0?C.red:C.gray,fontFamily:"Arial,sans-serif"}}>
                      {fmtMoney(p.money)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {(hiddenCount>0||showAll)&&(
            <button onClick={()=>setShowAll(!showAll)}
              style={{width:"100%",background:"none",border:"none",color:C.forest,fontSize:12,
                fontFamily:"Arial,sans-serif",fontWeight:600,cursor:"pointer",padding:"10px 0 2px",textAlign:"center"}}>
              {showAll ? "▲ Show less" : `▼ Show all ${players.length} players`}
            </button>
          )}

          {!showAll&&notPlayed.length>0&&(
            <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif",textAlign:"center",paddingTop:6}}>
              {notPlayed.length} player{notPlayed.length!==1?"s":""} haven't played yet
            </div>
          )}
          
        </div>

      </div>
    </div>
  );
}

// ─── PAYOUTS ──────────────────────────────────────────────────────────────────
// ─── SIDE GAME SETUP SCREEN ───────────────────────────────────────────────────
// Lets the organizer create a fully custom Nassau (1v1, 2v2, etc.) or Skins
// pool independent of the official match pairings.
function SideGameSetupScreen({go, goBack, activeTrip, tripPlayers, matches, editGame, prefillRound, onGameCreated, onGameUpdated, onGameDeleted}){
  const isEdit = !!editGame;
  const [gameType,  setGameType]  = useState(editGame?.type || "nassau");
  const [roundFilter, setRoundFilter] = useState(editGame ? (editGame.matchId || "all") : (prefillRound || "all"));
  const [side1,     setSide1]     = useState(editGame?.side1Keys || []);
  const [side2,     setSide2]     = useState(editGame?.side2Keys || []);
  const [pool,      setPool]      = useState(editGame?.poolKeys || []);
  const [betAmount, setBetAmount] = useState(editGame?.betAmount || 10);
  const [gameName,  setGameName]  = useState(editGame?.name || "");
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [confirmDel,setConfirmDel]= useState(false);
  const [error,     setError]     = useState("");

  // Any player on the trip is eligible — they don't need to be in the same match.
  // This lets you bet against a buddy who's in a totally different group.
  const displayPlayers = tripPlayers.length > 0
    ? tripPlayers.map(p=>({key:p.name.toLowerCase(), name:p.name, team:p.team}))
    : RAW.map(p=>({key:p.key, name:p.name, team:p.team}));

  const togglePlayer = (key, side) => {
    if(gameType==="skins" || gameType==="stableford"){
      setPool(prev => prev.includes(key) ? prev.filter(k=>k!==key) : [...prev,key]);
      return;
    }
    if(gameType==="wolf"){
      // Ordered list, max 4 — order matters for wolf rotation
      setPool(prev => {
        if(prev.includes(key)) return prev.filter(k=>k!==key);
        if(prev.length>=4) return prev; // already full
        return [...prev,key];
      });
      return;
    }
    if(gameType==="vegas"){
      // Two sides, max 2 players each
      if(side===1){
        setSide1(prev => prev.includes(key) ? prev.filter(k=>k!==key) : (prev.length>=2 ? prev : [...prev,key]));
        setSide2(prev => prev.filter(k=>k!==key));
      } else {
        setSide2(prev => prev.includes(key) ? prev.filter(k=>k!==key) : (prev.length>=2 ? prev : [...prev,key]));
        setSide1(prev => prev.filter(k=>k!==key));
      }
      return;
    }
    // Nassau: any size per side
    if(side===1){
      setSide1(prev => prev.includes(key) ? prev.filter(k=>k!==key) : [...prev,key]);
      setSide2(prev => prev.filter(k=>k!==key)); // remove from other side if present
    } else {
      setSide2(prev => prev.includes(key) ? prev.filter(k=>k!==key) : [...prev,key]);
      setSide1(prev => prev.filter(k=>k!==key));
    }
  };

  const canSave =
    gameType==="nassau"     ? side1.length>0 && side2.length>0 :
    gameType==="vegas"      ? side1.length===2 && side2.length===2 :
    gameType==="wolf"       ? pool.length===4 :
    /* skins/stableford */    pool.length>=2;

  const errorMsg = () => {
    if(gameType==="nassau")     return "Pick at least one player per side";
    if(gameType==="vegas")      return "Vegas needs exactly 2 players per side";
    if(gameType==="wolf")       return "Wolf needs exactly 4 players";
    return "Pick at least 2 players";
  };

  const saveGame = async () => {
    if(!canSave){ setError(errorMsg()); return; }
    setSaving(true); setError("");
    try {
      const payload = {
        trip_id:    activeTrip?.id || null,
        match_id:   roundFilter==="all" ? null : roundFilter, // null = pull scores from any round the player has
        type:       gameType,
        name:       gameName.trim() || null,
        side1_keys: (gameType==="nassau"||gameType==="vegas") ? side1 : null,
        side2_keys: (gameType==="nassau"||gameType==="vegas") ? side2 : null,
        pool_keys:  (gameType==="skins"||gameType==="stableford"||gameType==="wolf") ? pool : null,
        bet_amount: betAmount,
        active:     true,
      };
      if(isEdit && editGame.id && typeof editGame.id==="string" && editGame.id.length>10){
        await db.patch("side_games", `id=eq.${editGame.id}`, payload);
        onGameUpdated && onGameUpdated({
          id: editGame.id, matchId: roundFilter==="all" ? null : roundFilter,
          type: gameType, name: gameName.trim()||null,
          side1Keys: side1, side2Keys: side2, poolKeys: pool, betAmount,
        });
      } else {
        const [saved] = await db.post("side_games", payload);
        onGameCreated && onGameCreated({
          id: saved?.id || Date.now(), matchId: roundFilter==="all" ? null : roundFilter,
          type: gameType, name: gameName.trim()||null,
          side1Keys: side1, side2Keys: side2, poolKeys: pool, betAmount,
        });
      }
      go("payouts");
    } catch(e){ setError("Failed to save game: "+e.message); }
    setSaving(false);
  };

  const deleteGame = async () => {
    setDeleting(true);
    try {
      if(editGame?.id && typeof editGame.id==="string" && editGame.id.length>10){
        await db.patch("side_games", `id=eq.${editGame.id}`, {active:false});
      }
      onGameDeleted && onGameDeleted(editGame.id);
      go("payouts");
    } catch(e){ setError("Failed to delete: "+e.message); }
    setDeleting(false);
  };

  const nameFor = key => displayPlayers.find(p=>p.key===key)?.name || key;

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",background:C.smoke}}>
      <div style={{background:`linear-gradient(135deg,${C.forest},${C.fairway})`,padding:"16px 20px 20px"}}>
        <div style={{marginBottom:8}}><BackBtn goBack={goBack} go={go} to="payouts"/></div>
        <div style={{color:C.white,fontSize:20,fontWeight:700}}>{isEdit?"Edit Side Game":"New Side Game"}</div>
        <div style={{color:"rgba(255,255,255,.6)",fontSize:13,fontFamily:"Arial,sans-serif"}}>Set up a custom Nassau or Skins game — any players, any size.</div>
      </div>

      <div style={{flex:1,padding:16,display:"flex",flexDirection:"column",gap:14,overflowY:"auto"}}>
        {error&&<div style={{background:C.redBg,color:C.red,padding:"10px 14px",borderRadius:10,fontSize:13,fontFamily:"Arial,sans-serif"}}>{error}</div>}

        {/* Round filter — OPTIONAL. Defaults to "any round" so you can bet against
            someone in a totally different match/group. Narrow it only if you want
            this game to count just one specific round's scores. */}
        {matches && matches.length>0 && (
          <div style={card()}>
            <div style={{fontSize:11,fontWeight:700,color:C.slate,fontFamily:"Arial,sans-serif",letterSpacing:.7,textTransform:"uppercase",marginBottom:4}}>Which round? (optional)</div>
            <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif",marginBottom:8}}>Leave on "Any round" to bet against players in different matches.</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <button onClick={()=>setRoundFilter("all")}
                style={{width:"100%",textAlign:"left",background:roundFilter==="all"?C.greenBg:C.smoke,
                  border:`1.5px solid ${roundFilter==="all"?C.green:C.light}`,borderRadius:10,
                  padding:"10px 13px",cursor:"pointer"}}>
                <div style={{fontSize:13,fontWeight:700,color:roundFilter==="all"?C.green:C.charcoal,fontFamily:"Arial,sans-serif"}}>Any round</div>
                <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif"}}>Works across any match each player is in</div>
              </button>
              {matches.map(m=>(
                <button key={m.id} onClick={()=>setRoundFilter(m.id)}
                  style={{width:"100%",textAlign:"left",background:roundFilter===m.id?C.mist:C.smoke,
                    border:`1.5px solid ${roundFilter===m.id?C.forest:C.light}`,borderRadius:10,
                    padding:"10px 13px",cursor:"pointer"}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>{m.p1} vs {m.p2}</div>
                  <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif"}}>{m.format} {m.course_name?`· ${m.course_name}`:""}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Game type picker */}
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {[["nassau","💵 Nassau"],["skins","🏆 Skins"],["wolf","🐺 Wolf"],["stableford","📊 Stableford"],["vegas","🎰 Vegas"]].map(([id,label])=>(
            <button key={id} onClick={()=>{setGameType(id);setSide1([]);setSide2([]);setPool([]);}}
              style={{flex:"1 1 30%",minWidth:100,background:gameType===id?C.forest:C.white,color:gameType===id?C.white:C.charcoal,
                border:`1.5px solid ${gameType===id?C.forest:C.light}`,borderRadius:12,padding:"10px 6px",
                fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Arial,sans-serif"}}>
              {label}
            </button>
          ))}
        </div>
        {gameType==="wolf"&&<div style={{...card({background:C.mist})}}><div style={{fontSize:11,color:C.slate,fontFamily:"Arial,sans-serif"}}>🐺 Wolf needs exactly 4 players in rotation order. Pick them below.</div></div>}
        {gameType==="vegas"&&<div style={{...card({background:C.mist})}}><div style={{fontSize:11,color:C.slate,fontFamily:"Arial,sans-serif"}}>🎰 Vegas is 2v2 only — exactly 2 players per side.</div></div>}
        {gameType==="stableford"&&<div style={{...card({background:C.mist})}}><div style={{fontSize:11,color:C.slate,fontFamily:"Arial,sans-serif"}}>📊 Stableford ranks any size group by points; leader collects from the field.</div></div>}

        {/* Optional name */}
        <div style={card()}>
          <div style={{fontSize:11,fontWeight:700,color:C.slate,fontFamily:"Arial,sans-serif",letterSpacing:.7,textTransform:"uppercase",marginBottom:6}}>Game Name (optional)</div>
          <input value={gameName} onChange={e=>setGameName(e.target.value)} placeholder={gameType==="nassau"?"e.g. Louie vs Ryan":"e.g. Saturday Skins"}
            style={{width:"100%",padding:"10px 12px",border:`1.5px solid ${C.light}`,borderRadius:10,fontSize:14,fontFamily:"Arial,sans-serif",outline:"none",boxSizing:"border-box"}}/>
        </div>

        {/* Bet amount */}
        <div style={card()}>
          <div style={{fontSize:11,fontWeight:700,color:C.slate,fontFamily:"Arial,sans-serif",letterSpacing:.7,textTransform:"uppercase",marginBottom:6}}>
            {gameType==="nassau" ? "Bet per segment (F9/B9/18)" : "Amount per skin"}
          </div>
          <input type="number" value={betAmount} onChange={e=>setBetAmount(parseFloat(e.target.value)||0)}
            style={{width:100,padding:"10px 12px",border:`1.5px solid ${C.forest}`,borderRadius:10,fontSize:16,fontWeight:700,fontFamily:"Arial,sans-serif",outline:"none",textAlign:"center"}}/>
        </div>

        {/* Player selection */}
        {(gameType==="nassau"||gameType==="vegas") ? (
          <div style={{display:"flex",gap:10}}>
            {[1,2].map(sideNum=>{
              const list = sideNum===1?side1:side2;
              const otherList = sideNum===1?side2:side1;
              const maxReached = gameType==="vegas" && list.length>=2;
              return(
                <div key={sideNum} style={{flex:1,background:C.white,borderRadius:14,padding:12,boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
                  <div style={{fontSize:12,fontWeight:700,color:sideNum===1?C.red:C.blue,fontFamily:"Arial,sans-serif",marginBottom:8,textTransform:"uppercase"}}>
                    Side {sideNum}{gameType==="vegas"?" (2)":""}
                  </div>
                  {displayPlayers.map(p=>{
                    const selected = list.includes(p.key);
                    const disabled = otherList.includes(p.key) || (maxReached && !selected);
                    return(
                      <button key={p.key} disabled={disabled} onClick={()=>togglePlayer(p.key,sideNum)}
                        style={{width:"100%",textAlign:"left",background:selected?(sideNum===1?C.redBg:C.blueBg):C.smoke,
                          border:`1.5px solid ${selected?(sideNum===1?C.red:C.blue):C.light}`,borderRadius:8,
                          padding:"8px 10px",fontSize:12,fontFamily:"Arial,sans-serif",fontWeight:selected?700:500,
                          color:disabled?C.light:C.charcoal,marginBottom:5,cursor:disabled?"not-allowed":"pointer",
                          opacity:disabled?0.4:1}}>
                        {selected?"✓ ":""}{p.name}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={card()}>
            <div style={{fontSize:12,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif",marginBottom:8}}>
              {gameType==="skins"?"Who's in the skins pool?":gameType==="stableford"?"Who's competing?":"Pick 4 players (rotation order)"}
            </div>
            {displayPlayers.map(p=>{
              const selected = pool.includes(p.key);
              const wolfOrder = gameType==="wolf" && selected ? pool.indexOf(p.key)+1 : null;
              const disabled = gameType==="wolf" && pool.length>=4 && !selected;
              return(
                <button key={p.key} disabled={disabled} onClick={()=>togglePlayer(p.key)}
                  style={{width:"100%",textAlign:"left",background:selected?C.greenBg:C.smoke,
                    border:`1.5px solid ${selected?C.green:C.light}`,borderRadius:8,
                    padding:"9px 12px",fontSize:13,fontFamily:"Arial,sans-serif",fontWeight:selected?700:500,
                    color:disabled?C.light:C.charcoal,marginBottom:5,cursor:disabled?"not-allowed":"pointer",
                    opacity:disabled?0.4:1,display:"flex",justifyContent:"space-between"}}>
                  <span>{selected?"✓ ":""}{p.name}</span>
                  {wolfOrder&&<span style={{fontSize:11,color:C.green}}>Hole {wolfOrder}, {wolfOrder+4}, {wolfOrder+8}, {wolfOrder+12}...</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Summary */}
        {gameType==="nassau" && side1.length>0 && side2.length>0 && (
          <div style={{...card({background:C.mist})}}>
            <div style={{fontSize:12,color:C.slate,fontFamily:"Arial,sans-serif",textAlign:"center"}}>
              {side1.map(nameFor).join(" & ")} <strong>vs</strong> {side2.map(nameFor).join(" & ")} · ${betAmount}/segment
            </div>
          </div>
        )}
        {gameType==="vegas" && side1.length===2 && side2.length===2 && (
          <div style={{...card({background:C.mist})}}>
            <div style={{fontSize:12,color:C.slate,fontFamily:"Arial,sans-serif",textAlign:"center"}}>
              {side1.map(nameFor).join(" & ")} <strong>vs</strong> {side2.map(nameFor).join(" & ")} · ${betAmount}/point
            </div>
          </div>
        )}
        {gameType==="wolf" && pool.length===4 && (
          <div style={{...card({background:C.mist})}}>
            <div style={{fontSize:12,color:C.slate,fontFamily:"Arial,sans-serif",textAlign:"center"}}>
              Wolf rotation: {pool.map(nameFor).join(" → ")} · ${betAmount}/hole
            </div>
          </div>
        )}
        {gameType==="stableford" && pool.length>0 && (
          <div style={{...card({background:C.mist})}}>
            <div style={{fontSize:12,color:C.slate,fontFamily:"Arial,sans-serif",textAlign:"center"}}>
              {pool.length} players · ${betAmount}/point difference from leader
            </div>
          </div>
        )}
        {gameType==="skins" && pool.length>0 && (
          <div style={{...card({background:C.mist})}}>
            <div style={{fontSize:12,color:C.slate,fontFamily:"Arial,sans-serif",textAlign:"center"}}>
              {pool.length} players · ${betAmount}/skin · ${pool.length*betAmount} max pot per hole
            </div>
          </div>
        )}

        <button onClick={saveGame} disabled={saving||!canSave}
          style={{...bigBtn(`linear-gradient(135deg,${canSave?C.forest:"#9CA3AF"},${canSave?C.fairway:"#D1D5DB"})`,C.white),
            cursor:canSave?"pointer":"not-allowed"}}>
          {saving?(isEdit?"Saving…":"Creating…"):(isEdit?"Save Changes →":"Create Side Game →")}
        </button>

        {isEdit&&(
          confirmDel ? (
            <div style={{...card({background:C.redBg,border:`1.5px solid ${C.red}`})}}>
              <div style={{fontSize:13,color:C.red,fontFamily:"Arial,sans-serif",fontWeight:700,marginBottom:10,textAlign:"center"}}>Delete this side game?</div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setConfirmDel(false)} style={{...bigBtn(C.white,C.charcoal),flex:1,border:`1.5px solid ${C.light}`}}>Cancel</button>
                <button onClick={deleteGame} disabled={deleting} style={{...bigBtn(C.red,C.white),flex:1}}>{deleting?"Deleting…":"Delete"}</button>
              </div>
            </div>
          ) : (
            <button onClick={()=>setConfirmDel(true)}
              style={{background:"none",border:"none",color:C.red,fontSize:13,fontFamily:"Arial,sans-serif",fontWeight:600,padding:"8px",cursor:"pointer"}}>
              Delete Side Game
            </button>
          )
        )}
      </div>
    </div>
  );
}


function PayoutsScreen({go, goBack, matches, ts, playerRecords, tripPlayers, activeTrip, sideGames, onEditGame}){
  const [tab, setTab] = useState("Side Games");

  const usingRealData = tripPlayers && tripPlayers.length > 0;
  const nameForKey = key => usingRealData
    ? (tripPlayers.find(p=>p.name.toLowerCase()===key)?.name || key)
    : (RAW.find(p=>p.key===key)?.name || GUEST_PLAYERS[key]?.name || key);

  // Aggregate net money per player from all custom side games
  const moneyByPlayer = {};
  const addMoney = (key, amt) => { moneyByPlayer[key] = (moneyByPlayer[key]||0) + amt; };

  // ── Custom side games — the ONLY source of side-game money. Each one is
  // explicitly created by the organizer with specific players, so there's
  // never any ambiguity about who's in what or where the numbers come from.
  const customGameResults = (sideGames||[]).map(g=>{
    if(g.type==="nassau"){
      const result = deriveNassauForGroup(matches, g.side1Keys, g.side2Keys, g.betAmount, g.matchId);
      [["front",result.front],["back",result.back],["overall",result.overall]].forEach(([,seg])=>{
        if(seg.winner==="tie"||seg.winner==="none"||seg.amt===0) return;
        const winKeys = seg.winner==="side1" ? g.side1Keys : g.side2Keys;
        const loseKeys= seg.winner==="side1" ? g.side2Keys : g.side1Keys;
        winKeys.forEach(k=>addMoney(k, seg.amt));
        loseKeys.forEach(k=>addMoney(k, -seg.amt));
      });
      return {...g, result};
    } else if(g.type==="skins"){
      const result = deriveSkinsForGroup(matches, g.poolKeys, g.betAmount, g.matchId);
      Object.entries(result.skinsByPlayer).forEach(([key,count])=>{
        addMoney(key, count*g.betAmount);
      });
      return {...g, result};
    } else if(g.type==="wolf"){
      const result = deriveWolfForGroup(matches, g.poolKeys, g.betAmount, g.matchId);
      Object.entries(result.pointsByPlayer||{}).forEach(([key,pts])=>addMoney(key, pts));
      return {...g, result};
    } else if(g.type==="stableford"){
      // Use the scoped match's par layout if available, else Mammoth Dunes fallback
      const scopedMatch = g.matchId ? matches.find(m=>m.id===g.matchId) : null;
      let pars = COURSES.mammoth.pars;
      if(scopedMatch?.hole_data){
        try {
          const parsed = typeof scopedMatch.hole_data==="string" ? JSON.parse(scopedMatch.hole_data) : scopedMatch.hole_data;
          if(Array.isArray(parsed)&&parsed.length===18) pars = parsed.map(h=>h.par);
        } catch(e){}
      }
      const result = deriveStablefordForGroup(matches, g.poolKeys, pars, g.betAmount, g.matchId);
      Object.entries(result.moneyByPlayer||{}).forEach(([key,amt])=>addMoney(key, amt));
      return {...g, result};
    } else if(g.type==="vegas"){
      const result = deriveVegasForGroup(matches, g.side1Keys, g.side2Keys, g.betAmount, g.matchId);
      if(result.winner==="side1"){
        g.side1Keys.forEach(k=>addMoney(k, result.netPoints/g.side1Keys.length));
        g.side2Keys.forEach(k=>addMoney(k, -result.netPoints/g.side2Keys.length));
      } else if(result.winner==="side2"){
        g.side2Keys.forEach(k=>addMoney(k, result.netPoints/g.side2Keys.length));
        g.side1Keys.forEach(k=>addMoney(k, -result.netPoints/g.side1Keys.length));
      }
      return {...g, result};
    }
    return g;
  });

  const allPlayerKeys = Object.keys(playerRecords);
  const players = allPlayerKeys.map(key=>({
    key, name: nameForKey(key),
    team: usingRealData ? (tripPlayers.find(p=>p.name.toLowerCase()===key)?.team||"red") : (RAW.find(p=>p.key===key)?.team||"red"),
    money: moneyByPlayer[key]||0,
    skinsWon: customGameResults
      .filter(g=>g.type==="skins")
      .reduce((sum,g)=>sum+(g.result?.skinsByPlayer?.[key]||0),0),
  })).filter(p=>p.money!==0||p.skinsWon>0).sort((a,b)=>b.money-a.money);

  const winners=players.filter(p=>p.money>0), losers=players.filter(p=>p.money<0);
  const transactions=[];
  const wBal=winners.map(p=>({...p,rem:p.money})), lBal=losers.map(p=>({...p,rem:-p.money}));
  let wi=0,li=0;
  while(wi<wBal.length&&li<lBal.length){
    const amt=Math.min(wBal[wi].rem,lBal[li].rem);
    transactions.push({from:lBal[li].name,to:wBal[wi].name,amt});
    wBal[wi].rem-=amt;lBal[li].rem-=amt;
    if(wBal[wi].rem===0)wi++; if(lBal[li].rem===0)li++;
  }

  const hasAnyScores = matches.some(m => m.holeScores && Object.keys(m.holeScores).length>0);

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",background:C.smoke}}>
      <div style={{background:`linear-gradient(135deg,${C.forest},${C.fairway})`,padding:"14px 20px 18px"}}>
        <div style={{marginBottom:8}}><BackBtn goBack={goBack} go={go} to="board"/></div>
        <div style={{color:"rgba(255,255,255,.6)",fontSize:11,fontFamily:"Arial,sans-serif",letterSpacing:"1.2px",textTransform:"uppercase",marginBottom:3}}>{activeTrip?.name||"My Golf Trip"}</div>
        <div style={{color:C.white,fontSize:20,fontWeight:700}}>Payouts & Side Games</div>
      </div>
      <div style={{background:C.white,padding:"10px 16px",display:"flex",gap:8,borderBottom:`1px solid ${C.light}`,overflowX:"auto"}}>
        {["Side Games","Summary","Who Pays Who"].map(t=>(<button key={t} onClick={()=>setTab(t)} style={{background:tab===t?C.forest:"transparent",color:tab===t?C.white:C.gray,border:`1.5px solid ${tab===t?C.forest:C.light}`,borderRadius:20,padding:"6px 14px",fontSize:12,fontFamily:"Arial,sans-serif",fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>{t}</button>))}
      </div>
      <div style={{flex:1,padding:16,display:"flex",flexDirection:"column",gap:12,overflowY:"auto"}}>

        {tab==="Side Games" && customGameResults.length>0 && !hasAnyScores && (
          <div style={{...card({background:C.mist})}}>
            <div style={{fontSize:13,color:C.slate,fontFamily:"Arial,sans-serif",textAlign:"center"}}>
              No scores entered yet. Side game results calculate automatically as matches are scored.
            </div>
          </div>
        )}

        {/* ── SIDE GAMES TAB ── */}
        {tab==="Side Games"&&(<>
          <button onClick={()=>{onEditGame&&onEditGame(null);go("sidegamesetup");}}
            style={{width:"100%",background:`linear-gradient(135deg,${C.forest},${C.fairway})`,border:"none",borderRadius:14,
              padding:"13px",fontSize:14,fontWeight:700,color:C.white,cursor:"pointer",fontFamily:"Arial,sans-serif"}}>
            + New Side Game (1v1, 2v2, custom group)
          </button>

          {/* Custom games created by the organizer */}
          {customGameResults.length>0 && customGameResults.map(g=>{
            const ICONS = {nassau:"💵",skins:"🏆",wolf:"🐺",stableford:"📊",vegas:"🎰"};
            const LABELS = {nassau:"Custom Nassau",skins:"Custom Skins",wolf:"Wolf",stableford:"Stableford",vegas:"Vegas"};
            const UNIT = {nassau:"per segment",skins:"per skin",wolf:"per hole",stableford:"per point",vegas:"per point"};
            return(
            <div key={g.id} style={card()}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:18}}>{ICONS[g.type]}</span>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:C.charcoal}}>{g.name||LABELS[g.type]}</div>
                    <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif"}}>
                      ${g.betAmount} {UNIT[g.type]}
                      {(() => { const m=matches.find(mm=>mm.id===g.matchId); return m ? ` · ${m.p1} vs ${m.p2}` : g.matchId ? "" : " · any round"; })()}
                    </div>
                  </div>
                </div>
                <button onClick={()=>{onEditGame&&onEditGame(g);go("sidegamesetup");}}
                  style={{background:C.smoke,color:C.forest,border:`1.5px solid ${C.light}`,borderRadius:8,padding:"5px 10px",fontSize:11,fontFamily:"Arial,sans-serif",fontWeight:600,cursor:"pointer",flexShrink:0}}>
                  Edit
                </button>
              </div>

              {g.type==="nassau" && (
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  <div style={{fontSize:11,color:C.slate,fontFamily:"Arial,sans-serif",marginBottom:4}}>
                    {g.side1Keys.map(nameForKey).join(" & ")} <strong>vs</strong> {g.side2Keys.map(nameForKey).join(" & ")}
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    {[["Front 9",g.result.front],["Back 9",g.result.back],["Overall",g.result.overall]].map(([label,seg])=>(
                      <div key={label} style={{flex:1,background:C.smoke,borderRadius:8,padding:"6px 8px",textAlign:"center"}}>
                        <div style={{fontSize:9,color:C.gray,fontFamily:"Arial,sans-serif"}}>{label}</div>
                        <div style={{fontSize:11,fontWeight:700,color:seg.winner==="tie"||seg.winner==="none"?C.gray:C.forest,fontFamily:"Arial,sans-serif"}}>
                          {seg.winner==="none"?"—":seg.winner==="tie"?"Tied":seg.winner==="side1"?g.side1Keys.map(nameForKey).join(" & "):g.side2Keys.map(nameForKey).join(" & ")}
                        </div>
                        {seg.amt>0&&<div style={{fontSize:10,color:C.green,fontFamily:"Arial,sans-serif"}}>${seg.amt}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {g.type==="skins" && (
                Object.keys(g.result.skinsByPlayer).length===0
                  ? <div style={{fontSize:12,color:C.gray,fontFamily:"Arial,sans-serif",textAlign:"center",padding:8}}>No skins won yet</div>
                  : Object.entries(g.result.skinsByPlayer).sort((a,b)=>b[1]-a[1]).map(([key,count])=>(
                    <div key={key} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.mist}`}}>
                      <span style={{fontSize:13,fontFamily:"Arial,sans-serif",color:C.charcoal}}>{nameForKey(key)}</span>
                      <span style={{fontSize:13,fontWeight:700,color:C.green,fontFamily:"Arial,sans-serif"}}>{count} skin{count!==1?"s":""} · ${count*g.betAmount}</span>
                    </div>
                  ))
              )}

              {g.type==="wolf" && (
                g.result.error
                  ? <div style={{fontSize:12,color:C.red,fontFamily:"Arial,sans-serif",textAlign:"center",padding:8}}>{g.result.error}</div>
                  : (g.result.holes||[]).length===0
                    ? <div style={{fontSize:12,color:C.gray,fontFamily:"Arial,sans-serif",textAlign:"center",padding:8}}>No holes scored yet</div>
                    : Object.entries(g.result.pointsByPlayer||{}).sort((a,b)=>b[1]-a[1]).map(([key,pts])=>(
                      <div key={key} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.mist}`}}>
                        <span style={{fontSize:13,fontFamily:"Arial,sans-serif",color:C.charcoal}}>{nameForKey(key)}</span>
                        <span style={{fontSize:13,fontWeight:700,color:pts>=0?C.green:C.red,fontFamily:"Arial,sans-serif"}}>{fmtMoney(pts)}</span>
                      </div>
                    ))
              )}

              {g.type==="stableford" && (
                (g.result.ranked||[]).length===0
                  ? <div style={{fontSize:12,color:C.gray,fontFamily:"Arial,sans-serif",textAlign:"center",padding:8}}>No holes scored yet</div>
                  : g.result.ranked.map(([key,pts],i)=>(
                    <div key={key} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.mist}`}}>
                      <span style={{fontSize:13,fontFamily:"Arial,sans-serif",color:C.charcoal}}>{i===0?"🥇 ":""}{nameForKey(key)}</span>
                      <span style={{fontSize:13,fontWeight:700,color:C.forest,fontFamily:"Arial,sans-serif"}}>{pts} pts</span>
                    </div>
                  ))
              )}

              {g.type==="vegas" && (
                g.result.error
                  ? <div style={{fontSize:12,color:C.red,fontFamily:"Arial,sans-serif",textAlign:"center",padding:8}}>{g.result.error}</div>
                  : (g.result.holes||[]).length===0
                    ? <div style={{fontSize:12,color:C.gray,fontFamily:"Arial,sans-serif",textAlign:"center",padding:8}}>No holes scored yet</div>
                    : (
                      <div style={{fontSize:13,fontFamily:"Arial,sans-serif",textAlign:"center",padding:6}}>
                        <span style={{color:C.charcoal}}>{g.side1Keys.map(nameForKey).join(" & ")} <strong>vs</strong> {g.side2Keys.map(nameForKey).join(" & ")}</span>
                        <div style={{fontWeight:700,color:g.result.winner==="tie"?C.gray:C.green,marginTop:4}}>
                          {g.result.winner==="tie"?"Tied":`${g.result.winner==="side1"?g.side1Keys.map(nameForKey).join(" & "):g.side2Keys.map(nameForKey).join(" & ")} +$${g.result.netPoints}`}
                        </div>
                      </div>
                    )
              )}
            </div>
            );
          })}

          {customGameResults.length===0 && (
            <div style={{...card({background:C.mist,textAlign:"center"})}}>
              <div style={{fontSize:28,marginBottom:6}}>🎲</div>
              <div style={{fontSize:13,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif",marginBottom:4}}>No side games yet</div>
              <div style={{fontSize:12,color:C.slate,fontFamily:"Arial,sans-serif"}}>Tap "+ New Side Game" above to set up a Nassau, Skins, Wolf, Stableford, or Vegas bet with any players on the trip.</div>
            </div>
          )}
        </>)}

        {/* ── SUMMARY TAB ── */}
        {tab==="Summary"&&(
          players.length===0
            ? <div style={{textAlign:"center",padding:"40px 20px",color:C.gray,fontFamily:"Arial,sans-serif"}}>No side games set up yet — go to the Side Games tab to create one</div>
            : players.map(p=>(
              <div key={p.key} style={{...card({display:"flex",alignItems:"center",gap:14,borderLeft:`4px solid ${teamColor(p.team)}`})}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:teamBg(p.team),display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:12,fontWeight:700,color:teamColor(p.team),fontFamily:"Arial,sans-serif"}}>{calcInitials(p.name)}</span></div>
                <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>{p.name}</div><div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif"}}>{p.skinsWon} skin{p.skinsWon!==1?"s":""} won</div></div>
                <div style={{textAlign:"right"}}><div style={{fontSize:20,fontWeight:700,color:p.money>0?C.green:C.red,fontFamily:"Arial,sans-serif"}}>{fmtMoney(p.money)}</div><div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif"}}>{p.money>0?"Winner":"Owes"}</div></div>
              </div>
            ))
        )}

        {/* ── WHO PAYS WHO TAB ── */}
        {tab==="Who Pays Who"&&(
          <>
            <div style={{fontSize:13,color:C.slate,fontFamily:"Arial,sans-serif",marginBottom:4}}>Simplified payouts to minimize transactions.</div>
            {transactions.length===0
              ? <div style={{textAlign:"center",padding:"40px 20px",color:C.gray,fontFamily:"Arial,sans-serif"}}>No payouts to settle yet</div>
              : transactions.map((t,i)=>(<div key={i} style={card({display:"flex",alignItems:"center",gap:12})}><div style={{fontSize:22}}>💸</div><div style={{flex:1}}><div style={{fontSize:14,fontFamily:"Arial,sans-serif",color:C.charcoal}}><strong style={{color:C.red}}>{t.from}</strong> pays <strong style={{color:C.green}}>{t.to}</strong></div></div><div style={{fontSize:20,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>${t.amt}</div></div>))
            }
            {transactions.length>0&&<div style={{...card({background:C.greenBg,border:`1px solid ${C.mint}`})}}><div style={{fontSize:13,color:C.green,fontFamily:"Arial,sans-serif",fontWeight:700,marginBottom:4}}>✓ Balanced</div><div style={{fontSize:12,color:C.slate,fontFamily:"Arial,sans-serif"}}>{transactions.length} payment{transactions.length!==1?"s":""} settle all debts.</div></div>}
          </>
        )}
      </div>
    </div>
  );
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────
function ProfileScreen({go, goBack, matches, playerRecords, onSignOut, session, tripPlayers, activeTrip, lifetimeStats}){
  const [tab,setTab]=useState("Trip");
  // Find THIS logged-in user's real player record — try multiple strategies
  // so organizers and joined players are both found reliably.
  const userId = session?.user?.id;
  const emailRaw = session?.user?.email || "";
  const emailPrefix = emailRaw.split("@")[0].replace(/[._-]/g," ").toLowerCase();
  const displayMeta = (session?.user?.user_metadata?.display_name || "").toLowerCase();
  const myPlayer = tripPlayers?.find(p => p.user_id === userId)
    || tripPlayers?.find(p => {
        const pn = p.name?.toLowerCase() || "";
        return pn === displayMeta
          || pn === emailPrefix
          || (emailPrefix && emailPrefix.includes(pn.split(" ")[0]))
          || (pn && emailPrefix.startsWith(pn.split(" ")[0]));
       });

  // Auto-link silently — patches trip_players.user_id once so future lookups
  // always find the player by id rather than falling back to name matching.
  useEffect(() => {
    if(!userId || !myPlayer?.id) return;
    if(myPlayer.user_id) return;
    db.patch("trip_players", `id=eq.${myPlayer.id}`, { user_id: userId })
      .catch(e => console.warn("Auto-link failed:", e.message));
  }, [userId, myPlayer?.id]);

  const usingRealData = tripPlayers && tripPlayers.length > 0;
  const displayName = myPlayer?.name || session?.user?.user_metadata?.display_name || session?.user?.email?.split("@")[0] || "Player";
  const myTeam = myPlayer?.team || "red";
  const myKey = (myPlayer?.name || displayName).toLowerCase();
  const myRecord = playerRecords?.[myKey] || {pts:0, record:"0–0–0", w:0, l:0, h:0};
  const initials = calcInitials(displayName);

  const [showSettings, setShowSettings] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const [settingsHcp,  setSettingsHcp]  = useState("");
  const [settingsTeam, setSettingsTeam] = useState("red");
  const [savingSettings, setSavingSettings] = useState(false);

  const openSettings = () => {
    setSettingsName(myPlayer?.name || displayName);
    setSettingsHcp(myPlayer?.hcp_index!=null ? String(myPlayer.hcp_index) : "");
    setSettingsTeam(myPlayer?.team || myTeam);
    setShowSettings(true);
  };

  const saveSettings = async () => {
    const target = myPlayer || (tripPlayers?.length === 1 ? tripPlayers[0] : null);
    if(!target?.id){ setShowSettings(false); return; }
    setSavingSettings(true);
    try {
      const updates = {
        name:      settingsName.trim() || target.name,
        hcp_index: settingsHcp.trim()==="" ? null : parseFloat(settingsHcp),
        team:      settingsTeam,
      };
      await db.patch("trip_players", `id=eq.${target.id}`, updates);
      target.name      = updates.name;
      target.hcp_index = updates.hcp_index;
      target.team      = updates.team;
    } catch(e){ console.warn("Failed to save settings:", e.message); }
    setSavingSettings(false);
    setShowSettings(false);
  };

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",background:C.smoke}}>
      <div style={{background:`linear-gradient(135deg,${C.forest},${C.fairway})`,padding:"14px 20px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <BackBtn goBack={goBack} go={go} to="dashboard"/>
          <button onClick={openSettings}
            style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.25)",color:C.white,
              borderRadius:8,padding:"5px 14px",fontSize:12,cursor:"pointer",fontFamily:"Arial,sans-serif",fontWeight:600}}>
            ⚙️ Settings
          </button>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:64,height:64,borderRadius:"50%",background:"rgba(255,255,255,.18)",border:"2px solid rgba(255,255,255,.3)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:"Arial,sans-serif"}}>{initials}</span>
          </div>
          <div style={{flex:1}}>
            <div style={{color:C.white,fontSize:22,fontWeight:700}}>{displayName}</div>
            <div style={{color:"rgba(255,255,255,.65)",fontSize:12,fontFamily:"Arial,sans-serif",marginTop:3}}>
              Team {myTeam==="red"?"Red":"Blue"}{activeTrip?.name?` · ${activeTrip.name}`:""}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginTop:8}}>
              <span style={{background:"rgba(255,255,255,.2)",color:C.white,borderRadius:20,padding:"3px 10px",fontSize:12,fontFamily:"Arial,sans-serif",fontWeight:700}}>
                HCP {myPlayer?.hcp_index!=null ? myPlayer.hcp_index : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div style={{background:C.white,padding:"10px 16px",display:"flex",gap:8,borderBottom:`1px solid ${C.light}`,overflowX:"auto"}}>
        {["Trip","Lifetime"].map(t=>(<button key={t} onClick={()=>setTab(t)} style={{background:tab===t?C.forest:"transparent",color:tab===t?C.white:C.gray,border:`1.5px solid ${tab===t?C.forest:C.light}`,borderRadius:20,padding:"6px 16px",fontSize:12,fontFamily:"Arial,sans-serif",fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>{t}</button>))}
      </div>
      <div style={{flex:1,padding:16,display:"flex",flexDirection:"column",gap:12,overflowY:"auto"}}>

        {!usingRealData && (
          <div style={{...card({background:C.mist})}}>
            <div style={{fontSize:12,color:C.slate,fontFamily:"Arial,sans-serif",textAlign:"center"}}>
              We couldn't find your player record on this trip yet — stats below may be incomplete. Ask your organizer to make sure your account is linked on the Trip roster.
            </div>
          </div>
        )}

        {tab==="Trip"&&(
          <>
            <StatRow items={[
              {label:"Points", value:fmtPts(myRecord.pts), color:C.red, bg:C.redBg},
              {label:"Record", value:myRecord.record, color:C.charcoal},
              {label:"Matches", value:(myRecord.w||0)+(myRecord.l||0)+(myRecord.h||0), color:C.forest, bg:C.mist},
            ]}/>
            <div style={card()}>
              <div style={{fontSize:13,fontWeight:700,color:C.charcoal,marginBottom:10}}>My Matches</div>
              {(() => {
                const myMatches = matches.filter(m =>
                  (m.p1Keys||[]).includes(myKey) || (m.p2Keys||[]).includes(myKey)
                );
                if(myMatches.length===0) return(
                  <div style={{fontSize:12,color:C.gray,fontFamily:"Arial,sans-serif",textAlign:"center",padding:"12px 0"}}>
                    No matches yet this trip
                  </div>
                );
                return myMatches.map((m,i,arr)=>{
                  const mySide = (m.p1Keys||[]).includes(myKey) ? "p1" : "p2";
                  const opp = mySide==="p1" ? m.p2 : m.p1;
                  const isLive = m.status==="live";
                  const isUpcoming = m.status==="upcoming";
                  const won = m.status==="completed" && m.winnerSide===mySide;
                  const half = m.status==="completed" && m.winnerSide==="halve";
                  return(
                    <div key={m.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:i<arr.length-1?`1px solid ${C.mist}`:"none"}}>
                      <div>
                        <div style={{fontSize:13,fontFamily:"Arial,sans-serif",color:C.charcoal,fontWeight:600}}>vs {opp}</div>
                        <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:1}}>{m.format}{m.course_name?` · ${m.course_name}`:""}</div>
                      </div>
                      {m.status==="completed" ? (
                        <div style={{...pill(won?C.greenBg:half?C.mist:C.redBg, won?C.green:half?C.gray:C.red)}}>
                          {won?"Win":half?"Halve":"Loss"} — {m.score}
                        </div>
                      ) : isLive ? (
                        <div style={{...pill(C.greenBg,C.green)}}>LIVE</div>
                      ) : (
                        <div style={{...pill(C.mist,C.gray)}}>Upcoming</div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </>
        )}

        {tab==="Lifetime"&&(
          lifetimeStats===null ? (
            <div style={{textAlign:"center",padding:"40px 20px",color:C.gray,fontFamily:"Arial,sans-serif"}}>Loading…</div>
          ) : !lifetimeStats.trips ? (
            <div style={{...card({textAlign:"center",padding:"32px 16px"})}}>
              <div style={{fontSize:28,marginBottom:8}}>📊</div>
              <div style={{fontSize:14,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>No trip history yet</div>
              <div style={{fontSize:12,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:4}}>Once you've completed matches across trips, your career record will show up here.</div>
            </div>
          ) : (
            <>
              <StatRow items={[
                {label:"Trips", value:lifetimeStats.trips, color:C.forest, bg:C.mist},
                {label:"Record", value:lifetimeStats.record, color:C.charcoal},
                {label:"Win %", value:`${lifetimeStats.winPct}%`, color:C.green, bg:C.greenBg},
              ]}/>
              <div style={card()}>
                <div style={{fontSize:13,fontWeight:700,color:C.charcoal,marginBottom:10}}>Record by Trip</div>
                {lifetimeStats.tripBreakdown.length===0 ? (
                  <div style={{fontSize:12,color:C.gray,fontFamily:"Arial,sans-serif",textAlign:"center",padding:"8px 0"}}>No completed matches yet</div>
                ) : lifetimeStats.tripBreakdown.map((t,i,arr)=>(
                  <div key={t.tripId} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:i<arr.length-1?`1px solid ${C.mist}`:"none"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>{t.name}</div>
                      {t.date&&<div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:1}}>{t.date}</div>}
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:13,fontWeight:700,color:C.forest,fontFamily:"Arial,sans-serif"}}>{fmtPts(t.pts)}</div>
                      <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif"}}>{t.record}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )
        )}

        {/* Sign Out */}
        {onSignOut&&(
          <button onClick={onSignOut}
            style={{width:"100%",background:"transparent",color:C.red,
              border:`1.5px solid ${C.redBg}`,borderRadius:14,padding:14,
              fontSize:13,fontFamily:"Arial,sans-serif",fontWeight:600,cursor:"pointer",marginTop:4}}>
            Sign Out
          </button>
        )}
      </div>

      {/* Settings bottom sheet */}
      {showSettings&&(
        <div onClick={()=>setShowSettings(false)}
          style={{position:"absolute",inset:0,background:"rgba(0,0,0,.4)",zIndex:100,display:"flex",alignItems:"flex-end"}}>
          <div onClick={e=>e.stopPropagation()}
            style={{background:C.white,borderRadius:"20px 20px 0 0",padding:"20px 20px 36px",width:"100%",display:"flex",flexDirection:"column",gap:14}}>
            <div style={{width:36,height:4,background:C.light,borderRadius:2,margin:"0 auto 4px"}}/>
            <div style={{fontSize:16,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>Profile Settings</div>

            {/* Name */}
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.slate,fontFamily:"Arial,sans-serif",letterSpacing:.7,textTransform:"uppercase",marginBottom:6}}>Display Name</div>
              <input value={settingsName} onChange={e=>setSettingsName(e.target.value)}
                placeholder="Your name"
                style={{width:"100%",padding:"12px 14px",border:`1.5px solid ${C.light}`,borderRadius:12,fontSize:15,fontFamily:"Arial,sans-serif",outline:"none",boxSizing:"border-box"}}/>
            </div>

            {/* Handicap */}
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.slate,fontFamily:"Arial,sans-serif",letterSpacing:.7,textTransform:"uppercase",marginBottom:6}}>Handicap Index</div>
              <input type="number" step="0.1" min="0" max="54" value={settingsHcp} onChange={e=>setSettingsHcp(e.target.value)}
                placeholder="e.g. 8.4"
                style={{width:"100%",padding:"12px 14px",border:`1.5px solid ${C.light}`,borderRadius:12,fontSize:15,fontFamily:"Arial,sans-serif",outline:"none",boxSizing:"border-box"}}/>
            </div>

            {/* Team */}
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.slate,fontFamily:"Arial,sans-serif",letterSpacing:.7,textTransform:"uppercase",marginBottom:6}}>Team</div>
              <div style={{display:"flex",gap:10}}>
                {[["red","Team Red"],["blue","Team Blue"]].map(([t,label])=>(
                  <button key={t} onClick={()=>setSettingsTeam(t)}
                    style={{flex:1,padding:"11px",borderRadius:12,border:`2px solid ${settingsTeam===t?(t==="red"?C.red:C.blue):C.light}`,
                      background:settingsTeam===t?(t==="red"?C.redBg:C.blueBg):C.white,
                      color:settingsTeam===t?(t==="red"?C.red:C.blue):C.gray,
                      fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"Arial,sans-serif"}}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={saveSettings} disabled={savingSettings}
              style={{width:"100%",background:`linear-gradient(135deg,${C.forest},${C.fairway})`,border:"none",color:C.white,
                borderRadius:14,padding:14,fontSize:14,fontFamily:"Arial,sans-serif",fontWeight:700,cursor:"pointer",marginTop:4}}>
              {savingSettings?"Saving…":"Save Changes"}
            </button>
            <button onClick={()=>setShowSettings(false)}
              style={{background:"none",border:"none",color:C.gray,fontSize:13,fontFamily:"Arial,sans-serif",padding:"4px",cursor:"pointer"}}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
function TripNameEditor({activeTrip}){
  const [editing, setEditing] = useState(false);
  const [name,    setName]    = useState("");
  const [saving,  setSaving]  = useState(false);

  const open = () => { setName(activeTrip?.name||""); setEditing(true); };
  const save = async () => {
    if(!activeTrip?.id||!name.trim()){ setEditing(false); return; }
    setSaving(true);
    try {
      await db.patch("trips", `id=eq.${activeTrip.id}`, { name: name.trim() });
      activeTrip.name = name.trim(); // optimistic update
    } catch(e){ console.warn("Failed to save trip name:", e.message); }
    setSaving(false);
    setEditing(false);
  };

  return(
    <div style={card()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:editing?12:0}}>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>Trip Name</div>
          {!editing&&<div style={{fontSize:13,color:C.forest,fontFamily:"Arial,sans-serif",marginTop:2,fontWeight:600}}>{activeTrip?.name||"—"}</div>}
        </div>
        {!editing&&<button onClick={open}
          style={{background:C.smoke,border:`1.5px solid ${C.light}`,color:C.forest,borderRadius:8,
            padding:"5px 12px",fontSize:12,fontFamily:"Arial,sans-serif",fontWeight:600,cursor:"pointer"}}>
          Edit
        </button>}
      </div>
      {editing&&(<>
        <input value={name} onChange={e=>setName(e.target.value)} autoFocus
          placeholder="e.g. Ranger Open 2026"
          style={{width:"100%",padding:"12px 14px",border:`1.5px solid ${C.forest}`,borderRadius:12,
            fontSize:15,fontFamily:"Arial,sans-serif",outline:"none",boxSizing:"border-box",marginBottom:10}}/>
        <div style={{display:"flex",gap:8}}>
          <button onClick={save} disabled={saving}
            style={{flex:1,background:`linear-gradient(135deg,${C.forest},${C.fairway})`,border:"none",
              color:C.white,borderRadius:10,padding:"11px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"Arial,sans-serif"}}>
            {saving?"Saving…":"Save"}
          </button>
          <button onClick={()=>setEditing(false)}
            style={{flex:1,background:C.smoke,border:`1.5px solid ${C.light}`,color:C.gray,
              borderRadius:10,padding:"11px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"Arial,sans-serif"}}>
            Cancel
          </button>
        </div>
      </>)}
    </div>
  );
}

function TripScreen({go, matches, playerRecords, activeTrip, tripPlayers, onAddMatch, onGoMatch, userInitials}){
  const [section,   setSection]  = useState("Matches");
  const [collapsedRounds, setCollapsedRounds] = useState({});
  const [editingPlayer, setEditingPlayer] = useState(null); // player being edited
  const [editName,  setEditName]  = useState("");
  const [editHcp,   setEditHcp]   = useState("");
  const [editTeam,  setEditTeam]  = useState("red");
  const [savingEdit,setSavingEdit]= useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [newName,   setNewName]  = useState("");
  const [newHcp,    setNewHcp]   = useState("");
  const [newTeam,   setNewTeam]  = useState("red");
  const [saving,    setSaving]   = useState(false);
  const [saveMsg,   setSaveMsg]  = useState("");

  // Navigate to create/edit match, optionally passing a match to edit
  const goCreateMatch = (matchToEdit) => {
    onGoMatch && onGoMatch(matchToEdit || null);
    go("creatematch");
  };

  const openEditPlayer = (p) => {
    setEditingPlayer(p);
    setEditName(p.name);
    setEditHcp(p.hcp_index!=null ? String(p.hcp_index) : "");
    setEditTeam(p.team||"red");
  };

  const savePlayerEdit = async () => {
    if(!editingPlayer?.id){ setEditingPlayer(null); return; }
    setSavingEdit(true);
    try {
      await db.patch("trip_players", `id=eq.${editingPlayer.id}`, {
        name:      editName.trim() || editingPlayer.name,
        hcp_index: editHcp.trim()==="" ? null : parseFloat(editHcp),
        team:      editTeam,
      });
      editingPlayer.name      = editName.trim() || editingPlayer.name;
      editingPlayer.hcp_index = editHcp.trim()==="" ? null : parseFloat(editHcp);
      editingPlayer.team      = editTeam;
    } catch(e){ console.warn("Failed to save player:", e.message); }
    setSavingEdit(false);
    setEditingPlayer(null);
  };

  // Use real tripPlayers if available, fall back to RAW demo data
  const displayPlayers = tripPlayers.length > 0
    ? tripPlayers
    : RAW.map(p=>({id:p.key, name:p.name, hcp_index:p.index, team:p.team, is_guest:false}));

  const redPlayers  = displayPlayers.filter(p=>p.team==="red");
  const bluePlayers = displayPlayers.filter(p=>p.team==="blue");

  const addPlayer = async () => {
    if(!newName.trim()) return;
    setSaving(true);
    try {
      if(activeTrip){
        await db.post("trip_players", [{
          trip_id:   activeTrip.id,
          name:      newName.trim(),
          hcp_index: newHcp ? parseFloat(newHcp) : null,
          team:      newTeam,
          is_guest:  false,
        }]);
        setSaveMsg("Player added! Refresh to see changes.");
      }
      setNewName(""); setNewHcp(""); setAddingPlayer(false);
    } catch(e){ setSaveMsg("Failed to add player"); }
    setSaving(false);
  };

  const tripCode = activeTrip?.join_code?.toUpperCase() || "SV2026";
  const tripName = activeTrip?.name || "My Golf Trip";

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",background:C.smoke}}>
      <Header sub="⛳ MatchUp Golf" title={tripName}
        detail={`Trip Code: ${tripCode}`}
        onProfile={()=>go("profile")} initials={userInitials}/>
      <div style={{background:C.white,padding:"10px 16px",display:"flex",gap:8,borderBottom:`1px solid ${C.light}`,overflowX:"auto"}}>
        {["Players","Matches","My Trips","Settings"].map(s=>(
          <button key={s} onClick={()=>setSection(s)}
            style={{background:section===s?C.forest:"transparent",color:section===s?C.white:C.gray,
              border:`1.5px solid ${section===s?C.forest:C.light}`,borderRadius:20,padding:"6px 14px",
              fontSize:12,fontFamily:"Arial,sans-serif",fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
            {s}
          </button>
        ))}
      </div>

      <div style={{flex:1,padding:16,display:"flex",flexDirection:"column",gap:12,overflowY:"auto"}}>

        {/* ── PLAYERS TAB ── */}
        {section==="Players"&&(<>
          {saveMsg&&<div style={{background:C.greenBg,color:C.green,padding:"10px 14px",borderRadius:10,fontSize:13,fontFamily:"Arial,sans-serif"}}>{saveMsg}</div>}

          {/* Share code card */}
          <div style={{...card({background:`linear-gradient(135deg,${C.forest},${C.fairway})`,padding:"16px"})}}>
            <div style={{fontSize:12,color:"rgba(255,255,255,.65)",fontFamily:"Arial,sans-serif",marginBottom:4}}>Share this code to invite players</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:32,fontWeight:700,color:C.white,letterSpacing:6}}>{tripCode}</div>
              <div style={{background:"rgba(255,255,255,.15)",borderRadius:10,padding:"8px 14px",color:C.white,fontSize:12,fontFamily:"Arial,sans-serif",fontWeight:600,cursor:"pointer"}}
                onClick={()=>{navigator.clipboard?.writeText(tripCode);setSaveMsg("Code copied!");}}>
                Copy
              </div>
            </div>
          </div>

          {/* Team Red */}
          <div style={{background:C.white,borderRadius:16,overflow:"hidden",boxShadow:"0 2px 10px rgba(0,0,0,.06)"}}>
            <div style={{background:C.red,padding:"9px 16px",color:C.white,fontWeight:700,fontFamily:"Arial,sans-serif",fontSize:13,textTransform:"uppercase",letterSpacing:.8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span>Team Red</span>
              <span style={{fontSize:12,opacity:.8}}>{redPlayers.length} players</span>
            </div>
            {redPlayers.length===0&&<div style={{padding:"16px",fontSize:13,color:C.gray,fontFamily:"Arial,sans-serif",textAlign:"center"}}>No red team players yet</div>}
            {redPlayers.map((p,i,arr)=>{
              const key = p.name.toLowerCase();
              const pts  = playerRecords[key]?.pts||0;
              const rec  = playerRecords[key]?.record||"0–0–0";
              return(<div key={p.id||i} onClick={()=>openEditPlayer(p)}
                style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:12,
                  borderBottom:i<arr.length-1?`1px solid ${C.mist}`:"none",cursor:"pointer"}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:C.redBg,border:`1.5px solid ${C.red}33`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontSize:12,fontWeight:700,color:C.red,fontFamily:"Arial,sans-serif"}}>{calcInitials(p.name)}</span>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>{p.name}</div>
                  <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif"}}>
                    {p.hcp_index!=null?`HCP ${p.hcp_index}`:"No HCP"} · {rec}
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{fontSize:14,fontWeight:700,color:C.red,fontFamily:"Arial,sans-serif"}}>{fmtPts(pts)}</div>
                  <span style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif"}}>Edit</span>
                </div>
              </div>);
            })}
          </div>

          {/* Team Blue */}
          <div style={{background:C.white,borderRadius:16,overflow:"hidden",boxShadow:"0 2px 10px rgba(0,0,0,.06)"}}>
            <div style={{background:C.blue,padding:"9px 16px",color:C.white,fontWeight:700,fontFamily:"Arial,sans-serif",fontSize:13,textTransform:"uppercase",letterSpacing:.8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span>Team Blue</span>
              <span style={{fontSize:12,opacity:.8}}>{bluePlayers.length} players</span>
            </div>
            {bluePlayers.length===0&&<div style={{padding:"16px",fontSize:13,color:C.gray,fontFamily:"Arial,sans-serif",textAlign:"center"}}>No blue team players yet</div>}
            {bluePlayers.map((p,i,arr)=>{
              const key = p.name.toLowerCase();
              const pts  = playerRecords[key]?.pts||0;
              const rec  = playerRecords[key]?.record||"0–0–0";
              return(<div key={p.id||i} onClick={()=>openEditPlayer(p)}
                style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:12,
                  borderBottom:i<arr.length-1?`1px solid ${C.mist}`:"none",cursor:"pointer"}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:C.blueBg,border:`1.5px solid ${C.blue}33`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontSize:12,fontWeight:700,color:C.blue,fontFamily:"Arial,sans-serif"}}>{calcInitials(p.name)}</span>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>{p.name}</div>
                  <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif"}}>
                    {p.hcp_index!=null?`HCP ${p.hcp_index}`:"No HCP"} · {rec}
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{fontSize:14,fontWeight:700,color:C.blue,fontFamily:"Arial,sans-serif"}}>{fmtPts(pts)}</div>
                  <span style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif"}}>Edit</span>
                </div>
              </div>);
            })}
          </div>

          {/* Add player */}
          {!addingPlayer
            ? <button onClick={()=>setAddingPlayer(true)}
                style={{background:C.white,border:`2px dashed ${C.mint}`,borderRadius:16,padding:16,
                  fontSize:13,color:C.forest,fontWeight:700,cursor:"pointer",fontFamily:"Arial,sans-serif"}}>
                + Add Player
              </button>
            : <div style={card()}>
                <div style={{fontSize:13,fontWeight:700,color:C.charcoal,marginBottom:12}}>Add Player</div>
                <input placeholder="Player name" value={newName} onChange={e=>setNewName(e.target.value)}
                  style={{width:"100%",padding:"11px 13px",border:`1.5px solid ${newName?C.forest:C.light}`,borderRadius:11,fontSize:14,fontFamily:"Arial,sans-serif",outline:"none",boxSizing:"border-box",marginBottom:8}}/>
                <div style={{display:"flex",gap:8,marginBottom:12}}>
                  <input placeholder="HCP Index" value={newHcp} onChange={e=>setNewHcp(e.target.value)} type="number" step="0.1"
                    style={{flex:1,padding:"11px 13px",border:`1.5px solid ${C.light}`,borderRadius:11,fontSize:14,fontFamily:"Arial,sans-serif",outline:"none"}}/>
                  <select value={newTeam} onChange={e=>setNewTeam(e.target.value)}
                    style={{flex:1,padding:"11px 13px",border:`1.5px solid ${C.light}`,borderRadius:11,fontSize:14,fontFamily:"Arial,sans-serif",outline:"none",background:C.white}}>
                    <option value="red">Team Red</option>
                    <option value="blue">Team Blue</option>
                  </select>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={addPlayer} disabled={saving}
                    style={{flex:1,background:C.forest,color:C.white,border:"none",borderRadius:11,padding:12,fontSize:13,fontFamily:"Arial,sans-serif",fontWeight:700,cursor:"pointer"}}>
                    {saving?"Saving…":"Add Player"}
                  </button>
                  <button onClick={()=>setAddingPlayer(false)}
                    style={{flex:1,background:C.smoke,color:C.gray,border:`1px solid ${C.light}`,borderRadius:11,padding:12,fontSize:13,fontFamily:"Arial,sans-serif",cursor:"pointer"}}>
                    Cancel
                  </button>
                </div>
              </div>
          }

          {/* Edit player bottom sheet */}
          {editingPlayer&&(
            <div onClick={()=>setEditingPlayer(null)}
              style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
              <div onClick={e=>e.stopPropagation()}
                style={{background:C.white,borderRadius:"20px 20px 0 0",padding:"20px 20px 36px",
                  width:"100%",display:"flex",flexDirection:"column",gap:14}}>
                <div style={{width:36,height:4,background:C.light,borderRadius:2,margin:"0 auto 4px"}}/>
                <div style={{fontSize:16,fontWeight:700,color:C.charcoal}}>Edit Player</div>

                <div>
                  <div style={{fontSize:11,fontWeight:700,color:C.slate,textTransform:"uppercase",letterSpacing:.7,marginBottom:6,fontFamily:"Arial,sans-serif"}}>Name</div>
                  <input value={editName} onChange={e=>setEditName(e.target.value)}
                    style={{width:"100%",padding:"12px 14px",border:`1.5px solid ${C.light}`,borderRadius:12,
                      fontSize:15,fontFamily:"Arial,sans-serif",outline:"none",boxSizing:"border-box"}}/>
                </div>

                <div>
                  <div style={{fontSize:11,fontWeight:700,color:C.slate,textTransform:"uppercase",letterSpacing:.7,marginBottom:6,fontFamily:"Arial,sans-serif"}}>Handicap Index</div>
                  <input type="number" step="0.1" min="0" max="54" value={editHcp}
                    onChange={e=>setEditHcp(e.target.value)} placeholder="e.g. 8.4"
                    style={{width:"100%",padding:"12px 14px",border:`1.5px solid ${C.light}`,borderRadius:12,
                      fontSize:15,fontFamily:"Arial,sans-serif",outline:"none",boxSizing:"border-box"}}/>
                </div>

                <div>
                  <div style={{fontSize:11,fontWeight:700,color:C.slate,textTransform:"uppercase",letterSpacing:.7,marginBottom:6,fontFamily:"Arial,sans-serif"}}>Team</div>
                  <div style={{display:"flex",gap:10}}>
                    {[["red","Team Red"],["blue","Team Blue"]].map(([t,label])=>(
                      <button key={t} onClick={()=>setEditTeam(t)}
                        style={{flex:1,padding:"11px",borderRadius:12,
                          border:`2px solid ${editTeam===t?(t==="red"?C.red:C.blue):C.light}`,
                          background:editTeam===t?(t==="red"?C.redBg:C.blueBg):C.white,
                          color:editTeam===t?(t==="red"?C.red:C.blue):C.gray,
                          fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"Arial,sans-serif"}}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={savePlayerEdit} disabled={savingEdit}
                  style={{width:"100%",background:`linear-gradient(135deg,${C.forest},${C.fairway})`,
                    border:"none",color:C.white,borderRadius:14,padding:14,
                    fontSize:14,fontFamily:"Arial,sans-serif",fontWeight:700,cursor:"pointer"}}>
                  {savingEdit?"Saving…":"Save Changes"}
                </button>
                <button onClick={()=>setEditingPlayer(null)}
                  style={{background:"none",border:"none",color:C.gray,fontSize:13,
                    fontFamily:"Arial,sans-serif",padding:"4px",cursor:"pointer"}}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>)}

        {/* ── MATCHES TAB ── */}
        {section==="Matches"&&(<>
          <button onClick={()=>goCreateMatch()}
            style={bigBtn(`linear-gradient(135deg,${C.forest},${C.fairway})`,C.white,{boxShadow:"0 6px 20px rgba(27,67,50,.22)"})}>
            + Create New Match
          </button>

          {(() => {
            const today = new Date().toISOString().split("T")[0];
            const active = matches.filter(m=>m.status!=="deleted");

            if(active.length===0) return(
              <div style={{textAlign:"center",padding:"40px 20px",color:C.gray,fontFamily:"Arial,sans-serif"}}>
                No matches yet. Create your first match above.
              </div>
            );

            // Group by round_name or date, unscheduled at bottom
            const byKey = {};
            active.forEach(m=>{
              const key = m.round_name || m.match_date || "unscheduled";
              if(!byKey[key]) byKey[key] = {
                key,
                label:  m.round_name || null,
                date:   m.match_date || null,
                matches: [],
              };
              byKey[key].matches.push(m);
            });

            const groups = Object.values(byKey).sort((a,b)=>{
              if(a.key==="unscheduled") return 1;
              if(b.key==="unscheduled") return -1;
              const ad = a.matches[0]?.match_date||"9999";
              const bd = b.matches[0]?.match_date||"9999";
              return ad.localeCompare(bd);
            });

            const fmtDate = (d) => {
              if(!d) return null;
              if(d===today) return "Today";
              const dt = new Date(d+"T12:00:00");
              return dt.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
            };

            return groups.map(group=>{
              const isCollapsed = collapsedRounds[group.key];
              const dateLabel = fmtDate(group.date);
              const headerLabel = group.label
                ? (dateLabel ? `${group.label} · ${dateLabel}` : group.label)
                : (dateLabel || "Unscheduled");
              const allDone = group.matches.every(m=>m.status==="completed");
              const anyLive = group.matches.some(m=>m.status==="live");
              const courses = [...new Set(group.matches.map(m=>m.course_name).filter(Boolean))];
              const hasTBD = group.matches.some(m=>!m.p1Keys?.length||!m.p2Keys?.length);

              return(
                <div key={group.key} style={{marginBottom:4}}>
                  {/* Round header — tappable to collapse */}
                  <button onClick={()=>setCollapsedRounds(p=>({...p,[group.key]:!p[group.key]}))}
                    style={{width:"100%",background:C.white,border:`1px solid ${C.light}`,
                      borderRadius:isCollapsed?12:"12px 12px 0 0",padding:"11px 14px",
                      cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",
                      borderBottom:isCollapsed?undefined:`1px solid ${C.mist}`}}>
                    <div style={{textAlign:"left"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontSize:13,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>{headerLabel}</span>
                        {anyLive&&<div style={{width:6,height:6,borderRadius:"50%",background:C.green}}/>}
                        {hasTBD&&<span style={{...pill(C.amberBg,C.amber),fontSize:9}}>TBD</span>}
                        {allDone&&<span style={{fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif"}}>✓</span>}
                      </div>
                      {courses.length>0&&<div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:1}}>📍 {courses.join(" · ")} · {group.matches.length} match{group.matches.length!==1?"es":""}</div>}
                    </div>
                    <span style={{fontSize:12,color:C.gray,marginLeft:8}}>{isCollapsed?"▼":"▲"}</span>
                  </button>

                  {/* Match rows — shown when not collapsed */}
                  {!isCollapsed&&(
                    <div style={{background:C.white,borderRadius:"0 0 12px 12px",border:`1px solid ${C.light}`,borderTop:"none",overflow:"hidden"}}>
                      {group.matches.map((m,mi)=>{
                        const isLive = m.status==="live";
                        const isDone = m.status==="completed";
                        const isTBD  = !m.p1Keys?.length||!m.p2Keys?.length;
                        return(
                          <div key={m.id} style={{
                            padding:"10px 14px",
                            borderBottom:mi<group.matches.length-1?`1px solid ${C.mist}`:"none",
                            display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,
                          }}>
                            <div style={{flex:1,minWidth:0}}>
                              {isLive&&<div style={{display:"flex",alignItems:"center",gap:4,marginBottom:2}}>
                                <div style={{width:5,height:5,borderRadius:"50%",background:C.green}}/>
                                <span style={{fontSize:9,color:C.green,fontFamily:"Arial,sans-serif",fontWeight:700}}>LIVE</span>
                              </div>}
                              <div style={{fontSize:13,fontWeight:600,color:isTBD?C.gray:C.charcoal,fontFamily:"Arial,sans-serif",
                                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                {isTBD?"TBD vs TBD":`${m.p1} vs ${m.p2}`}
                              </div>
                              <div style={{fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:1}}>
                                {m.format||"Best Ball"}
                                {isDone&&m.score?<span style={{color:C.forest,fontWeight:700}}> · {m.score}</span>:""}
                                {isLive&&m.liveScore?<span style={{color:scoreColor(m.liveScore),fontWeight:700}}> · {m.liveScore}</span>:""}
                              </div>
                            </div>
                            <button onClick={()=>goCreateMatch(m)}
                              style={{background:C.smoke,color:C.forest,border:`1.5px solid ${C.light}`,
                                borderRadius:8,padding:"5px 10px",fontSize:11,fontFamily:"Arial,sans-serif",
                                fontWeight:600,cursor:"pointer",flexShrink:0}}>
                              Edit
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </>)}

        {/* ── MY TRIPS TAB ── */}
        {section==="My Trips"&&(<>
          <button onClick={()=>go("setup")}
            style={bigBtn(`linear-gradient(135deg,${C.forest},${C.fairway})`,C.white,{boxShadow:"0 6px 20px rgba(27,67,50,.22)"})}>
            + Create New Trip
          </button>
          {activeTrip&&(
            <div style={{...card({border:`2px solid ${C.forest}`})}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:C.charcoal}}>{activeTrip.name}</div>
                  <div style={{fontSize:12,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:2}}>
                    {displayPlayers.length} players · Code: {tripCode}
                  </div>
                </div>
                <span style={{...pill(C.greenBg,C.green),fontSize:10}}>Active</span>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>go("dashboard")}
                  style={{flex:1,background:C.forest,color:C.white,border:"none",borderRadius:10,padding:"9px",fontSize:12,fontFamily:"Arial,sans-serif",fontWeight:700,cursor:"pointer"}}>
                  Open Trip
                </button>
                <div onClick={()=>{navigator.clipboard?.writeText(tripCode);setSaveMsg("Code copied!");}}
                  style={{...pill(C.mist,C.gray),padding:"9px 12px",fontSize:11,cursor:"pointer",borderRadius:10,display:"flex",alignItems:"center"}}>
                  📋 {tripCode}
                </div>
              </div>
            </div>
          )}
        </>)}

        {/* ── SETTINGS TAB ── */}
        {section==="Settings"&&(<>
          {/* Trip Name */}
          <TripNameEditor activeTrip={activeTrip}/>

          {/* Trip Code */}
          <div style={card({display:"flex",alignItems:"center",gap:14})}>
            <div style={{fontSize:24}}>📤</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>Trip Code</div>
              <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif"}}>Share to invite players</div>
            </div>
            <div onClick={()=>{navigator.clipboard?.writeText(tripCode);setSaveMsg("Code copied!");}}
              style={{...pill(C.mist,C.forest),fontSize:11,cursor:"pointer",fontWeight:700,letterSpacing:1}}>
              {tripCode}
            </div>
          </div>
        </>)}

      </div>
    </div>
  );
}


// ─── COURSE SETUP SCREEN ──────────────────────────────────────────────────────
function CourseSetupScreen({go, goBack, activeTrip, onCourseAdded}){
  const [step,       setStep]      = useState(1);
  const [name,       setName]      = useState("");
  const [city,       setCity]      = useState("");
  const [state,      setState]     = useState("");
  const [tees,       setTees]      = useState([
    {name:"Blue",  color:"blue",  slope:"",rating:"",par:"72",yardage:""},
    {name:"White", color:"white", slope:"",rating:"",par:"72",yardage:""},
  ]);
  const [saving,     setSaving]    = useState(false);
  const [error,      setError]     = useState("");
  const [searching,  setSearching] = useState(false);
  const [searchQ,    setSearchQ]   = useState("");
  const [results,    setResults]   = useState(null); // null = not searched yet
  const [searchErr,  setSearchErr] = useState("");
  const searchRef = useRef(null);

  const TEE_COLORS = ["blue","white","gold","red","green","black","platinum"];
  const updateTee = (i, field, val) => setTees(prev=>{const t=[...prev]; t[i]={...t[i],[field]:val}; return t;});
  const addTee    = () => setTees(prev=>[...prev,{name:"",color:"white",slope:"",rating:"",par:"72",yardage:""}]);
  const removeTee = i  => setTees(prev=>prev.filter((_,idx)=>idx!==i));

  // ── Course Search ────────────────────────────────────────────────────────────
  const GOLF_API_KEY = import.meta.env.VITE_GOLF_API_KEY || "";

  const searchCourses = async () => {
    if(!searchQ.trim()){ setSearchErr("Enter a course or club name"); return; }
    if(!GOLF_API_KEY){ setSearchErr("Golf API key not configured — enter course details manually below."); return; }
    setSearching(true); setSearchErr(""); setResults(null);
    try {
      const res = await fetch(
        `https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(searchQ.trim())}`,
        { headers: { "Authorization": `Key ${GOLF_API_KEY}` } }
      );
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); }
      catch(e){ throw new Error(`Unexpected response: ${text.slice(0,150)}`); }
      if(!res.ok) throw new Error(data.detail || data.error || `Error ${res.status}`);
      const courses = data.courses || [];
      setResults(courses);
      if(courses.length === 0) setSearchErr("No courses found — try a different name or enter manually below.");
    } catch(e){
      setSearchErr(`Search error: ${e.message}`);
    }
    setSearching(false);
  };

  const pickCourse = async (course) => {
    // The API has club_name (the club) and course_name (the specific course,
    // e.g. "Quarry" or "Legend" at a resort with multiple courses).
    // Use "Club Name - Course Name" when they differ, just club name when same.
    const clubName = course.club_name || "";
    const courseName = course.course_name || "";
    const displayName = courseName && courseName !== clubName
      ? `${clubName} - ${courseName}`
      : clubName;

    // location is nested: { city, state, country }
    const loc = course.location || {};
    setName(displayName);
    setCity(loc.city || "");
    setState(loc.state || "");

    // Fetch full detail for tee box data
    if(course.id){
      try {
        const res = await fetch(
          `https://api.golfcourseapi.com/v1/courses/${encodeURIComponent(course.id)}`,
          { headers: { "Authorization": `Key ${GOLF_API_KEY}` } }
        );
        const data = await res.json();
        const detail = data.course || data;

        // API splits tees into tees.male[] and tees.female[] — combine both,
        // labelling female tees so organizers can include them if needed.
        const maleTees   = detail.tees?.male   || [];
        const femaleTees = detail.tees?.female || [];
        const allTees    = [...maleTees, ...femaleTees];

        if(allTees.length){
          setTees(allTees.map(t=>{
            const teeName = t.tee_name || "Blue";
            // Normalize color from tee name (e.g. "Blue" → "blue", "Blue/Gold" → "blue")
            const color = teeName.toLowerCase().split(/[\s/\-]/)[0].replace(/[^a-z]/g,"") || "blue";
            return {
              name:    teeName,
              color:   color,
              slope:   t.slope_rating  ? String(t.slope_rating)  : "",
              rating:  t.course_rating ? String(t.course_rating) : "",
              par:     t.par_total     ? String(t.par_total)     : "72",
              yardage: t.total_yards   ? String(t.total_yards)   : "",
              // holes[] has { par, yardage, handicap } — maps directly to our format
              holes:   (t.holes||[]).map((h,i)=>({
                hole:        i+1,
                par:         h.par      || 4,
                yardage:     h.yardage  || 0,
                strokeIndex: h.handicap || (i+1),
              })),
            };
          }));
        }
      } catch(e){ /* tee fetch failed — user can still enter manually */ }
    }

    setResults(null); setSearchQ("");
    setStep(2);
  };

  const saveCourse = async () => {
    if(!name.trim()){ setError("Enter course name"); return; }
    const validTees = tees.filter(t=>t.name&&t.slope&&t.rating);
    if(!validTees.length){ setError("Add at least one tee box with slope and rating"); return; }
    setSaving(true); setError("");
    try {
      const [course] = await db.post("courses",{
        name:       name.trim(),
        city:       city.trim()||null,
        state:      state.trim()||null,
        trip_id:    activeTrip?.id||null,
      });
      await db.post("tee_boxes", validTees.map(t=>({
        course_id:  course.id,
        name:       t.name,
        color:      t.color||"blue",
        slope:      parseInt(t.slope),
        rating:     parseFloat(t.rating),
        par:        parseInt(t.par)||72,
        yardage:    t.yardage?parseInt(t.yardage):null,
        hole_data:  t.holes?.length>0 ? JSON.stringify(t.holes) : null,
      })));
      // Fetch back the saved tee rows so they have real DB-generated IDs.
      // Without this, the tee objects have no id field and the selection
      // check (selectedTee?.id===t.id) silently breaks in CreateMatchScreen.
      const savedTees = await db.get("tee_boxes", `course_id=eq.${course.id}&select=*&order=created_at.asc`);
      onCourseAdded && onCourseAdded({...course, tee_boxes: savedTees});
      go("creatematch");
    } catch(e){ setError("Failed to save course: "+e.message); }
    setSaving(false);
  };

  const inp = (val,fn,ph,type="text",extra={}) => (
    <input type={type} value={val} onChange={e=>fn(e.target.value)} placeholder={ph}
      style={{width:"100%",padding:"12px 13px",border:`1.5px solid ${val?C.forest:C.light}`,
        borderRadius:11,fontSize:14,fontFamily:"Arial,sans-serif",outline:"none",
        boxSizing:"border-box",background:val?C.mist:C.white,...extra}}/>
  );

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",background:C.smoke}}>
      <div style={{background:`linear-gradient(135deg,${C.forest},${C.fairway})`,padding:"16px 20px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <BackBtn goBack={goBack} go={go} to="creatematch"/>
          <span style={{color:"rgba(255,255,255,.6)",fontSize:12,fontFamily:"Arial,sans-serif"}}>{step} of 2</span>
        </div>
        <div style={{color:C.white,fontSize:20,fontWeight:700}}>
          {step===1?"Add Course":"Add Tee Boxes"}
        </div>
        <div style={{color:"rgba(255,255,255,.6)",fontSize:13,fontFamily:"Arial,sans-serif"}}>
          {step===1?"Search or enter course details":"Slope, rating & par per tee"}
        </div>
        <div style={{marginTop:10,background:"rgba(255,255,255,.2)",borderRadius:8,height:4}}>
          <div style={{width:step===1?"50%":"100%",background:C.sand,height:"100%",borderRadius:8,transition:"width .3s"}}/>
        </div>
      </div>

      <div style={{flex:1,padding:16,display:"flex",flexDirection:"column",gap:14,overflowY:"auto"}}>
        {error&&<div style={{background:C.redBg,color:C.red,padding:"10px 14px",borderRadius:10,fontSize:13,fontFamily:"Arial,sans-serif"}}>{error}</div>}

        {step===1&&(<>
          {/* Course search */}
          <div style={card()}>
            <div style={{fontSize:13,fontWeight:700,color:C.charcoal,marginBottom:10}}>🔍 Search for Your Course</div>
            <div style={{display:"flex",gap:8}}>
              <input
                ref={searchRef}
                value={searchQ}
                onChange={e=>setSearchQ(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&searchCourses()}
                placeholder="e.g. Giants Ridge, Mammoth Dunes…"
                style={{flex:1,padding:"11px 13px",border:`1.5px solid ${C.light}`,borderRadius:11,fontSize:14,fontFamily:"Arial,sans-serif",outline:"none"}}/>
              <button onClick={searchCourses} disabled={searching}
                style={{background:C.forest,color:C.white,border:"none",borderRadius:11,padding:"0 16px",fontSize:14,fontWeight:700,cursor:searching?"not-allowed":"pointer",flexShrink:0}}>
                {searching?"…":"Go"}
              </button>
            </div>
            {searchErr&&<div style={{color:C.red,fontSize:12,fontFamily:"Arial,sans-serif",marginTop:8}}>{searchErr}</div>}

            {/* Search results */}
            {results&&results.length>0&&(
              <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:6}}>
                {results.slice(0,8).map(c=>{
                  const loc = c.location || {};
                  const clubName = c.club_name || c.course_name || "";
                  const courseName = c.course_name && c.course_name !== c.club_name ? c.course_name : null;
                  const locStr = [loc.city, loc.state].filter(Boolean).join(", ");
                  return(
                    <button key={c.id} onClick={()=>pickCourse(c)}
                      style={{textAlign:"left",background:C.smoke,border:`1px solid ${C.light}`,borderRadius:10,padding:"10px 12px",cursor:"pointer",width:"100%"}}>
                      <div style={{fontSize:13,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>{clubName}</div>
                      {courseName&&<div style={{fontSize:12,color:C.forest,fontFamily:"Arial,sans-serif",fontWeight:600,marginTop:1}}>📍 {courseName}</div>}
                      {locStr&&<div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:2}}>{locStr}</div>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{flex:1,height:1,background:C.light}}/>
            <span style={{color:C.gray,fontSize:12,fontFamily:"Arial,sans-serif"}}>or enter manually</span>
            <div style={{flex:1,height:1,background:C.light}}/>
          </div>
          <div style={card()}>
            <div style={{fontSize:13,fontWeight:700,color:C.charcoal,marginBottom:12}}>Course Details</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:C.slate,fontFamily:"Arial,sans-serif",letterSpacing:.7,textTransform:"uppercase",marginBottom:4}}>Course Name *</div>
                {inp(name,setName,"e.g. Mammoth Dunes")}
              </div>
              <div style={{display:"flex",gap:8}}>
                <div style={{flex:2}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.slate,fontFamily:"Arial,sans-serif",letterSpacing:.7,textTransform:"uppercase",marginBottom:4}}>City</div>
                  {inp(city,setCity,"e.g. Wisconsin Dells")}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.slate,fontFamily:"Arial,sans-serif",letterSpacing:.7,textTransform:"uppercase",marginBottom:4}}>State</div>
                  {inp(state,setState,"WI")}
                </div>
              </div>
            </div>
          </div>
          <div style={{...card({background:C.mist})}}>
            <div style={{fontSize:12,color:C.slate,fontFamily:"Arial,sans-serif",lineHeight:1.6}}>
              📋 <strong>Where to find this info:</strong><br/>
              Slope, rating, and par are printed on every scorecard. They're also posted at the starter's window or pro shop. Each set of tees (Blue, White, Red, etc.) has its own values.
            </div>
          </div>
          <button onClick={()=>{if(!name.trim()){setError("Enter course name");return;}setError("");setStep(2);}}
            style={bigBtn(`linear-gradient(135deg,${C.forest},${C.fairway})`,C.white)}>
            Next: Add Tees →
          </button>
        </>)}

        {step===2&&(<>
          {tees.map((tee,i)=>(
            <div key={i} style={{...card({border:`2px solid ${tee.name?C.forest:C.light}`})}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:13,fontWeight:700,color:C.charcoal}}>
                  Tee Box {i+1}
                  {tee.name&&<span style={{marginLeft:8,fontSize:11,background:C.mist,padding:"2px 8px",borderRadius:8,color:C.forest,fontWeight:600}}>{tee.name}</span>}
                </div>
                {tees.length>1&&(
                  <button onClick={()=>removeTee(i)}
                    style={{background:"none",border:"none",color:C.red,fontSize:18,cursor:"pointer",padding:"0 4px"}}>×</button>
                )}
              </div>
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                {/* Tee name */}
                <div style={{flex:2}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.slate,fontFamily:"Arial,sans-serif",textTransform:"uppercase",marginBottom:3}}>Tee Name</div>
                  <input value={tee.name} onChange={e=>updateTee(i,"name",e.target.value)} placeholder="Blue"
                    style={{width:"100%",padding:"10px 12px",border:`1.5px solid ${tee.name?C.forest:C.light}`,borderRadius:10,fontSize:13,fontFamily:"Arial,sans-serif",outline:"none",boxSizing:"border-box"}}/>
                </div>
                {/* Color dot picker */}
                <div style={{flex:1}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.slate,fontFamily:"Arial,sans-serif",textTransform:"uppercase",marginBottom:3}}>Color</div>
                  <select value={tee.color} onChange={e=>updateTee(i,"color",e.target.value)}
                    style={{width:"100%",padding:"10px 8px",border:`1.5px solid ${C.light}`,borderRadius:10,fontSize:13,fontFamily:"Arial,sans-serif",outline:"none",background:C.white}}>
                    {TEE_COLORS.map(c=><option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.slate,fontFamily:"Arial,sans-serif",textTransform:"uppercase",marginBottom:3}}>Slope *</div>
                  <input type="number" value={tee.slope} onChange={e=>updateTee(i,"slope",e.target.value)} placeholder="138"
                    style={{width:"100%",padding:"10px 12px",border:`1.5px solid ${tee.slope?C.forest:C.light}`,borderRadius:10,fontSize:14,fontFamily:"Arial,sans-serif",outline:"none",textAlign:"center",boxSizing:"border-box",fontWeight:700}}/>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.slate,fontFamily:"Arial,sans-serif",textTransform:"uppercase",marginBottom:3}}>Rating *</div>
                  <input type="number" step="0.1" value={tee.rating} onChange={e=>updateTee(i,"rating",e.target.value)} placeholder="74.3"
                    style={{width:"100%",padding:"10px 12px",border:`1.5px solid ${tee.rating?C.forest:C.light}`,borderRadius:10,fontSize:14,fontFamily:"Arial,sans-serif",outline:"none",textAlign:"center",boxSizing:"border-box",fontWeight:700}}/>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.slate,fontFamily:"Arial,sans-serif",textTransform:"uppercase",marginBottom:3}}>Par *</div>
                  <input type="number" value={tee.par} onChange={e=>updateTee(i,"par",e.target.value)} placeholder="72"
                    style={{width:"100%",padding:"10px 12px",border:`1.5px solid ${C.forest}`,borderRadius:10,fontSize:14,fontFamily:"Arial,sans-serif",outline:"none",textAlign:"center",boxSizing:"border-box",fontWeight:700}}/>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.slate,fontFamily:"Arial,sans-serif",textTransform:"uppercase",marginBottom:3}}>Yards</div>
                  <input type="number" value={tee.yardage} onChange={e=>updateTee(i,"yardage",e.target.value)} placeholder="7200"
                    style={{width:"100%",padding:"10px 12px",border:`1.5px solid ${C.light}`,borderRadius:10,fontSize:13,fontFamily:"Arial,sans-serif",outline:"none",textAlign:"center",boxSizing:"border-box"}}/>
                </div>
              </div>
              {tee.slope&&tee.rating&&(
                <div style={{background:C.mist,borderRadius:8,padding:"7px 10px",fontSize:11,color:C.slate,fontFamily:"Arial,sans-serif"}}>
                  Example: HCP 15 → Course HCP {Math.round(15*(parseInt(tee.slope)||113)/113+(parseFloat(tee.rating)||72)-(parseInt(tee.par)||72))} → Playing HCP ~{Math.round(Math.round(15*(parseInt(tee.slope)||113)/113+(parseFloat(tee.rating)||72)-(parseInt(tee.par)||72))*0.9)}
                </div>
              )}
            </div>
          ))}

          <button onClick={addTee}
            style={{background:C.white,border:`2px dashed ${C.mint}`,borderRadius:14,padding:13,
              fontSize:13,color:C.forest,fontWeight:700,cursor:"pointer",fontFamily:"Arial,sans-serif"}}>
            + Add Another Tee Box
          </button>

          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setStep(1)}
              style={{...bigBtn(C.mist,C.forest),flex:1}}>← Back</button>
            <button onClick={saveCourse} disabled={saving}
              style={{...bigBtn(`linear-gradient(135deg,${C.forest},${C.fairway})`,C.white),flex:2}}>
              {saving?"Saving…":"Save Course →"}
            </button>
          </div>
        </>)}
      </div>
    </div>
  );
}


function CreateMatchScreen({go, goBack, activeTrip, tripPlayers, onMatchCreated, editMatch, tripCourses, onCourseAdded}){
  const isEdit = !!editMatch;

  const displayPlayers = tripPlayers.length > 0
    ? tripPlayers
    : RAW.map(p=>({id:p.key, name:p.name, hcp_index:p.index, team:p.team}));

  // Filter players by their assigned team so Side 1 (red) only shows red
  // players and Side 2 (blue) only shows blue players — prevents someone
  // from accidentally putting a blue team player on the red side.
  const redPlayers  = displayPlayers.filter(p=>(p.team||"red")==="red");
  const bluePlayers = displayPlayers.filter(p=>(p.team||"red")==="blue");

  const [p1Players,      setP1Players]     = useState(()=>
    isEdit ? displayPlayers.filter(p=>(editMatch.p1Keys||[]).includes(p.name?.toLowerCase())) : []
  );
  const [p2Players,      setP2Players]     = useState(()=>
    isEdit ? displayPlayers.filter(p=>(editMatch.p2Keys||[]).includes(p.name?.toLowerCase())) : []
  );
  const [format,         setFormat]        = useState(isEdit ? (editMatch.format||"Best Ball") : "Best Ball");
  const [hcpMode,        setHcpMode]       = useState(isEdit ? (editMatch.hcp_mode||"whs") : "whs");
  const [hcpPct,         setHcpPct]        = useState(isEdit ? (editMatch.hcp_pct||90) : 90);
  const [matchDate,      setMatchDate]     = useState(()=>{
    if(isEdit && editMatch.match_date) return editMatch.match_date;
    // Default to today in YYYY-MM-DD format
    return new Date().toISOString().split("T")[0];
  });
  const [roundName,      setRoundName]     = useState(isEdit ? (editMatch.round_name||"") : "");
  const [selectedCourse, setSelectedCourse]= useState(null);
  const [selectedTee,    setSelectedTee]   = useState(null);
  const [saving,         setSaving]        = useState(false);
  const [deleting,       setDeleting]      = useState(false);
  const [confirmDel,     setConfirmDel]    = useState(false);
  const [error,          setError]         = useState("");

  const togglePlayer = (player, side) => {
    if(side==="p1"){
      setP1Players(prev=>prev.find(p=>p.id===player.id)
        ? prev.filter(p=>p.id!==player.id)
        : [...prev, player]);
    } else {
      setP2Players(prev=>prev.find(p=>p.id===player.id)
        ? prev.filter(p=>p.id!==player.id)
        : [...prev, player]);
    }
  };

  const selectedFormat = MATCH_FORMATS.find(f=>f.name===format) || MATCH_FORMATS[0];
  const p1Label = p1Players.length ? p1Players.map(p=>p.name).join(" / ") : "TBD";
  const p2Label = p2Players.length ? p2Players.map(p=>p.name).join(" / ") : "TBD";

  const saveMatch = async () => {
    // Players are optional — matches can be saved as TBD and players assigned later
    setSaving(true); setError("");
    try {
      const matchData = {
        p1_label:      p1Label,
        p2_label:      p2Label,
        p1_player_ids: p1Players.map(p=>p.id),
        p2_player_ids: p2Players.map(p=>p.id),
        format:        format,
        hcp_mode:      hcpMode,
        hcp_pct:       hcpMode==="custom" ? hcpPct : (hcpMode==="off" ? 0 : null),
        status:        isEdit ? (editMatch.status||"upcoming") : "upcoming",
        winner_side:   isEdit ? editMatch.winnerSide : null,
        thru:          isEdit ? (editMatch.thru||0) : 0,
        match_date:    matchDate || new Date().toISOString().split("T")[0],
        round_name:    roundName.trim() || null,
        // Only update course/tee if user actually selected one — preserve existing on edit
        course_name:   selectedCourse?.name || (isEdit ? editMatch.course_name : null),
        tee_name:      selectedTee?.name    || (isEdit ? editMatch.tee_name    : null),
        slope:         selectedTee?.slope   ? parseInt(selectedTee.slope)    : (isEdit ? editMatch.slope  : null),
        rating:        selectedTee?.rating  ? parseFloat(selectedTee.rating) : (isEdit ? editMatch.rating : null),
        par:           selectedTee?.par     ? parseInt(selectedTee.par)      : (isEdit ? editMatch.par    : null),
        // Per-hole par/yardage/stroke-index data from the selected tee (if scanned/entered)
        hole_data:     selectedTee?.holes?.length>0 ? JSON.stringify(selectedTee.holes)
                       : selectedTee?.hole_data ? (typeof selectedTee.hole_data==="string"?selectedTee.hole_data:JSON.stringify(selectedTee.hole_data))
                       : (isEdit ? editMatch.hole_data : null),
      };
      if(activeTrip) matchData.trip_id = activeTrip.id;

      if(isEdit && editMatch.id && typeof editMatch.id === "string" && editMatch.id.length > 10){
        // Update existing Supabase match — include all editable fields
        await db.patch("matches", `id=eq.${editMatch.id}`, {
          p1_label:      p1Label,
          p2_label:      p2Label,
          p1_player_ids: matchData.p1_player_ids,
          p2_player_ids: matchData.p2_player_ids,
          format:        format,
          hcp_mode:      matchData.hcp_mode,
          hcp_pct:       matchData.hcp_pct,
          course_name:   matchData.course_name,
          tee_name:      matchData.tee_name,
          slope:         matchData.slope,
          rating:        matchData.rating,
          par:           matchData.par,
          hole_data:     matchData.hole_data,
          match_date:    matchData.match_date,
          round_name:    matchData.round_name,
        });
        onMatchCreated && onMatchCreated({
          ...editMatch,
          p1:          p1Label,
          p2:          p2Label,
          p1Keys:      p1Players.map(p=>p.name.toLowerCase()),
          p2Keys:      p2Players.map(p=>p.name.toLowerCase()),
          format:      format,
          hcp_mode:    hcpMode,
          hcp_pct:     hcpMode==="custom" ? hcpPct : null,
          course_name: matchData.course_name,
          tee_name:    matchData.tee_name,
          slope:       matchData.slope,
          rating:      matchData.rating,
          par:         matchData.par,
          hole_data:   matchData.hole_data,
          match_date:  matchData.match_date,
          round_name:  matchData.round_name,
        });
      } else {
        // Create new match
        const [saved] = await db.post("matches", matchData);
        onMatchCreated && onMatchCreated({
          ...saved, id: saved?.id||Date.now(),
          p1:p1Label, p2:p2Label,
          p1Keys: p1Players.map(p=>p.name.toLowerCase()),
          p2Keys: p2Players.map(p=>p.name.toLowerCase()),
          round:1, day:"Trip Day", holeScores:{}, format,
          status:"upcoming", winnerSide:null, thru:0,
          hole_data: matchData.hole_data,
          match_date: matchData.match_date,
          round_name: matchData.round_name,
        });
      }
      go("trip");
    } catch(e){ setError((isEdit?"Failed to update":"Failed to create")+" match: "+e.message); }
    setSaving(false);
  };

  const deleteMatch = async () => {
    setDeleting(true);
    try {
      if(editMatch?.id && typeof editMatch.id === "string" && editMatch.id.length > 10){
        // Real Supabase UUID — soft delete via status
        await db.patch("matches", `id=eq.${editMatch.id}`, {status:"deleted"});
      }
      onMatchCreated && onMatchCreated({...editMatch, status:"deleted"});
      go("trip");
    } catch(e){ setError("Failed to delete: "+e.message); }
    setDeleting(false);
  };

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",background:C.smoke}}>
      <div style={{background:`linear-gradient(135deg,${C.forest},${C.fairway})`,padding:"16px 20px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <BackBtn goBack={goBack} go={go} to="trip"/>
          {isEdit&&<button onClick={()=>setConfirmDel(true)}
            style={{background:"rgba(220,38,38,.2)",border:"none",color:"#FCA5A5",borderRadius:8,
              padding:"5px 12px",fontSize:12,fontFamily:"Arial,sans-serif",fontWeight:600,cursor:"pointer"}}>
            Delete
          </button>}
        </div>
        <div style={{color:C.white,fontSize:20,fontWeight:700}}>{isEdit?"Edit Match":"Create Match"}</div>
        <div style={{color:"rgba(255,255,255,.6)",fontSize:13,fontFamily:"Arial,sans-serif"}}>Pick sides and format</div>
      </div>

      <div style={{flex:1,padding:16,display:"flex",flexDirection:"column",gap:14,overflowY:"auto"}}>
        {error&&<div style={{background:C.redBg,color:C.red,padding:"10px 14px",borderRadius:10,fontSize:13,fontFamily:"Arial,sans-serif"}}>{error}</div>}

        {/* Delete confirmation */}
        {confirmDel&&(
          <div style={{...card({background:C.redBg,border:`1px solid ${C.red}33`})}}>
            <div style={{fontSize:14,fontWeight:700,color:C.red,marginBottom:8}}>Delete this match?</div>
            <div style={{fontSize:12,color:C.slate,fontFamily:"Arial,sans-serif",marginBottom:12}}>This cannot be undone. All scores for this match will be removed.</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={deleteMatch} disabled={deleting}
                style={{flex:1,background:C.red,color:C.white,border:"none",borderRadius:10,padding:11,fontSize:13,fontFamily:"Arial,sans-serif",fontWeight:700,cursor:"pointer"}}>
                {deleting?"Deleting…":"Yes, Delete"}
              </button>
              <button onClick={()=>setConfirmDel(false)}
                style={{flex:1,background:C.white,color:C.gray,border:`1px solid ${C.light}`,borderRadius:10,padding:11,fontSize:13,fontFamily:"Arial,sans-serif",cursor:"pointer"}}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Date & Round picker */}
        <div style={card()}>
          <div style={{fontSize:13,fontWeight:700,color:C.charcoal,marginBottom:4}}>Date & Round</div>
          <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif",marginBottom:10}}>
            Set the date and optionally name the round. Matches with the same round name will group together on the Matches tab.
          </div>
          <input type="date" value={matchDate} onChange={e=>setMatchDate(e.target.value)}
            style={{width:"100%",padding:"12px 14px",border:`1.5px solid ${C.forest}`,borderRadius:12,
              fontSize:15,fontFamily:"Arial,sans-serif",outline:"none",
              color:C.charcoal,background:C.white,boxSizing:"border-box",marginBottom:8}}/>
          {/* Quick-select buttons for common relative dates */}
          <div style={{display:"flex",gap:6,marginBottom:12}}>
            {[["Today",0],["Tomorrow",1],["In 2 days",2]].map(([label,offset])=>{
              const d = new Date(); d.setDate(d.getDate()+offset);
              const val = d.toISOString().split("T")[0];
              const active = matchDate===val;
              return(
                <button key={label} onClick={()=>setMatchDate(val)}
                  style={{flex:1,background:active?C.forest:C.smoke,color:active?C.white:C.gray,
                    border:`1.5px solid ${active?C.forest:C.light}`,borderRadius:8,padding:"6px 0",
                    fontSize:11,fontFamily:"Arial,sans-serif",fontWeight:600,cursor:"pointer"}}>
                  {label}
                </button>
              );
            })}
          </div>
          <div style={{fontSize:11,fontWeight:700,color:C.slate,fontFamily:"Arial,sans-serif",textTransform:"uppercase",letterSpacing:.7,marginBottom:6}}>Round Name <span style={{fontWeight:400,textTransform:"none",letterSpacing:0}}>(optional)</span></div>
          <input value={roundName} onChange={e=>setRoundName(e.target.value)}
            placeholder="e.g. Round 1, Morning Wave, Day 2…"
            style={{width:"100%",padding:"11px 13px",border:`1.5px solid ${C.light}`,borderRadius:11,
              fontSize:14,fontFamily:"Arial,sans-serif",outline:"none",boxSizing:"border-box"}}/>
          {roundName.trim()&&(
            <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:6}}>
              This match will group with other "{roundName.trim()}" matches on the Matches tab.
            </div>
          )}
        </div>

        {/* Format picker */}
        <div style={card()}>
          <div style={{fontSize:13,fontWeight:700,color:C.charcoal,marginBottom:4}}>Format</div>
          <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif",marginBottom:10}}>All formats earn Ryder Cup points. WHS handicaps applied per format rules.</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {MATCH_FORMATS.map(f=>(
              <button key={f.id} onClick={()=>setFormat(f.name)}
                style={{background:format===f.name?C.forest:C.smoke,
                  color:format===f.name?C.white:C.charcoal,
                  border:`1.5px solid ${format===f.name?C.forest:C.light}`,
                  borderRadius:12,padding:"10px 14px",cursor:"pointer",
                  display:"flex",justifyContent:"space-between",alignItems:"center",
                  textAlign:"left"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,fontFamily:"Arial,sans-serif"}}>{f.name}</div>
                  <div style={{fontSize:11,fontFamily:"Arial,sans-serif",opacity:.75,marginTop:2}}>{f.desc.slice(0,55)}…</div>
                </div>
                <div style={{fontSize:10,fontFamily:"Arial,sans-serif",opacity:.7,marginLeft:8,flexShrink:0}}>{f.whs}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Course & Tee Selection */}
        <div style={card()}>
          <div style={{fontSize:13,fontWeight:700,color:C.charcoal,marginBottom:4}}>Course & Tees</div>
          <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif",marginBottom:10}}>
            Required for accurate WHS handicap calculations
          </div>

          {/* Course list */}
          {(tripCourses||[]).length > 0 ? (
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
              {(tripCourses||[]).map(c=>(
                <div key={c.id}>
                  <button onClick={()=>{setSelectedCourse(selectedCourse?.id===c.id?null:c); setSelectedTee(null);}}
                    style={{width:"100%",background:selectedCourse?.id===c.id?C.mist:C.smoke,
                      border:`1.5px solid ${selectedCourse?.id===c.id?C.forest:C.light}`,
                      borderRadius:11,padding:"10px 13px",cursor:"pointer",textAlign:"left",
                      display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>{c.name}</div>
                      {c.city&&<div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif"}}>{c.city}{c.state?`, ${c.state}`:""}</div>}
                    </div>
                    <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif"}}>{(c.tee_boxes||[]).length} tees</div>
                  </button>
                  {/* Tee box picker — shows when course is selected */}
                  {selectedCourse?.id===c.id&&(c.tee_boxes||[]).length>0&&(
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",padding:"8px 4px 4px"}}>
                      {(c.tee_boxes||[]).map(t=>{
                        const isSel = selectedTee?.id===t.id;
                        const dotColor = t.color==="blue"?"#3B82F6":t.color==="white"?"#9CA3AF":
                          t.color==="gold"||t.color==="yellow"?"#F59E0B":t.color==="red"?"#EF4444":
                          t.color==="black"?"#1F2937":t.color==="green"?"#10B981":"#6B7280";
                        return(
                          <button key={t.id} onClick={()=>setSelectedTee(isSel?null:t)}
                            style={{background:isSel?C.forest:C.white,
                              color:isSel?C.white:C.charcoal,
                              border:`2px solid ${isSel?C.forest:C.light}`,
                              borderRadius:10,padding:"7px 12px",cursor:"pointer",
                              display:"flex",alignItems:"center",gap:6}}>
                            <div style={{width:10,height:10,borderRadius:"50%",background:dotColor,border:"1px solid rgba(0,0,0,.1)",flexShrink:0}}/>
                            <div style={{textAlign:"left"}}>
                              <div style={{fontSize:12,fontWeight:700,fontFamily:"Arial,sans-serif"}}>{t.name}</div>
                              <div style={{fontSize:10,fontFamily:"Arial,sans-serif",opacity:.8}}>
                                {t.slope} / {t.rating} / Par {t.par}{t.yardage?` / ${t.yardage}y`:""}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{background:C.mist,borderRadius:10,padding:"12px 14px",marginBottom:10,fontSize:12,color:C.slate,fontFamily:"Arial,sans-serif",textAlign:"center"}}>
              No courses added yet
            </div>
          )}

          {/* Selected summary */}
          {selectedCourse&&selectedTee&&(
            <div style={{background:C.greenBg,borderRadius:10,padding:"10px 13px",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:C.green,fontFamily:"Arial,sans-serif"}}>{selectedCourse.name} — {selectedTee.name} Tees</div>
                <div style={{fontSize:11,color:C.forest,fontFamily:"Arial,sans-serif"}}>Slope {selectedTee.slope} · Rating {selectedTee.rating} · Par {selectedTee.par}{selectedTee.yardage?` · ${selectedTee.yardage}y`:""}</div>
              </div>
              <div style={{fontSize:16}}>✓</div>
            </div>
          )}

          <button onClick={()=>go("coursesetup")}
            style={{width:"100%",background:C.white,border:`2px dashed ${C.mint}`,borderRadius:11,
              padding:"10px",fontSize:12,color:C.forest,fontWeight:700,cursor:"pointer",fontFamily:"Arial,sans-serif"}}>
            + Add New Course
          </button>
        </div>

        {/* Handicap settings */}
        <div style={card()}>
          <div style={{fontSize:13,fontWeight:700,color:C.charcoal,marginBottom:4}}>Handicaps</div>
          <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif",marginBottom:10}}>
            {hcpMode==="whs"    ? `WHS: ${selectedFormat?.whs||"90%"} of each player's course handicap`
            : hcpMode==="custom"? `Custom: ${hcpPct}% of each player's course handicap`
            : "Off: gross scores only, no strokes applied"}
          </div>
          <div style={{display:"flex",gap:6,marginBottom:hcpMode==="custom"?12:0}}>
            {[["whs","WHS (auto)"],["custom","Custom %"],["off","Off (gross)"]].map(([id,label])=>(
              <button key={id} onClick={()=>setHcpMode(id)}
                style={{flex:1,background:hcpMode===id?C.forest:C.smoke,
                  color:hcpMode===id?C.white:C.gray,
                  border:`1.5px solid ${hcpMode===id?C.forest:C.light}`,
                  borderRadius:10,padding:"8px 4px",fontSize:11,
                  fontFamily:"Arial,sans-serif",fontWeight:600,cursor:"pointer"}}>
                {label}
              </button>
            ))}
          </div>
          {hcpMode==="custom"&&(
            <div style={{display:"flex",alignItems:"center",gap:12,marginTop:8}}>
              <input type="range" min={0} max={100} step={5} value={hcpPct}
                onChange={e=>setHcpPct(parseInt(e.target.value))}
                style={{flex:1,accentColor:C.forest}}/>
              <div style={{fontSize:18,fontWeight:700,color:C.forest,fontFamily:"Arial,sans-serif",minWidth:44,textAlign:"right"}}>
                {hcpPct}%
              </div>
            </div>
          )}
        </div>

        {/* Side 1 */}
        <div style={card()}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{fontSize:13,fontWeight:700,color:C.red}}>Side 1</div>
              <span style={{fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif"}}>optional — can assign later</span>
            </div>
            <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif"}}>{p1Players.length} selected</div>
          </div>
          <div style={{fontSize:13,fontFamily:"Arial,sans-serif",color:C.forest,fontWeight:600,marginBottom:10,minHeight:20}}>{p1Label}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {redPlayers.map(p=>{
              const sel=p1Players.find(pl=>pl.id===p.id);
              const inP2=p2Players.find(pl=>pl.id===p.id);
              return(
                <button key={p.id} onClick={()=>!inP2&&togglePlayer(p,"p1")} disabled={!!inP2}
                  style={{background:sel?C.red:C.smoke,color:sel?C.white:inP2?C.light:C.charcoal,
                    border:`1.5px solid ${sel?C.red:C.light}`,borderRadius:20,
                    padding:"6px 14px",fontSize:12,fontFamily:"Arial,sans-serif",fontWeight:600,
                    cursor:inP2?"not-allowed":"pointer",opacity:inP2?.4:1}}>
                  {p.name}
                </button>
              );
            })}
            {redPlayers.length===0&&<div style={{fontSize:12,color:C.gray,fontFamily:"Arial,sans-serif"}}>No red team players — assign teams in Trip → Players</div>}
          </div>
        </div>

        {/* Side 2 */}
        <div style={card()}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{fontSize:13,fontWeight:700,color:C.blue}}>Side 2</div>
              <span style={{fontSize:10,color:C.gray,fontFamily:"Arial,sans-serif"}}>optional — can assign later</span>
            </div>
            <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif"}}>{p2Players.length} selected</div>
          </div>
          <div style={{fontSize:13,fontFamily:"Arial,sans-serif",color:C.forest,fontWeight:600,marginBottom:10,minHeight:20}}>{p2Label}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {bluePlayers.map(p=>{
              const sel=p2Players.find(pl=>pl.id===p.id);
              const inP1=p1Players.find(pl=>pl.id===p.id);
              return(
                <button key={p.id} onClick={()=>!inP1&&togglePlayer(p,"p2")} disabled={!!inP1}
                  style={{background:sel?C.blue:C.smoke,color:sel?C.white:inP1?C.light:C.charcoal,
                    border:`1.5px solid ${sel?C.blue:C.light}`,borderRadius:20,
                    padding:"6px 14px",fontSize:12,fontFamily:"Arial,sans-serif",fontWeight:600,
                    cursor:inP1?"not-allowed":"pointer",opacity:inP1?.4:1}}>
                  {p.name}
                </button>
              );
            })}
            {bluePlayers.length===0&&<div style={{fontSize:12,color:C.gray,fontFamily:"Arial,sans-serif"}}>No blue team players — assign teams in Trip → Players</div>}
          </div>
        </div>

        {/* Preview — show even with TBD players */}
        <div style={{background:C.mist,borderRadius:14,padding:"14px 16px",textAlign:"center"}}>
          <div style={{fontSize:12,color:C.gray,fontFamily:"Arial,sans-serif",marginBottom:4}}>{format}</div>
          <div style={{fontSize:15,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>
            {p1Label} <span style={{color:C.gray,fontWeight:400}}>vs</span> {p2Label}
          </div>
          {(!p1Players.length||!p2Players.length)&&(
            <div style={{fontSize:11,color:C.amber,fontFamily:"Arial,sans-serif",marginTop:4}}>Players TBD — can be assigned before the round</div>
          )}
        </div>

        <button onClick={saveMatch} disabled={saving}
          style={bigBtn(`linear-gradient(135deg,${C.forest},${C.fairway})`,C.white,{
            boxShadow:"0 6px 20px rgba(27,67,50,.25)",
          })}>
          {saving?(isEdit?"Saving…":"Creating Match…"):(isEdit?"Save Changes →":"Create Match →")}
        </button>
      </div>
    </div>
  );
}


// ─── NO TRIP SCREEN ───────────────────────────────────────────────────────────
// Shown when a user is signed in but has no active trip. Clean entry point
// that separates organizers (create a trip) from players (join with a code).
function NoTripScreen({onCreateTrip, onJoinTrip}){
  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      background:`linear-gradient(165deg,${C.forest},${C.turf})`,padding:32}}>
      <div style={{fontSize:56,marginBottom:16}}>⛳</div>
      <div style={{fontSize:26,fontWeight:700,color:C.white,marginBottom:6,textAlign:"center"}}>
        MatchUp Golf
      </div>
      <div style={{fontSize:14,color:"rgba(255,255,255,.65)",fontFamily:"Arial,sans-serif",
        marginBottom:44,textAlign:"center",lineHeight:1.5}}>
        You're not on an active trip yet.{"\n"}Create one or join with a code.
      </div>

      <button onClick={onCreateTrip}
        style={{width:"100%",background:C.white,border:"none",borderRadius:18,
          padding:"20px 24px",marginBottom:14,cursor:"pointer",textAlign:"left",
          boxShadow:"0 4px 20px rgba(0,0,0,.2)"}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{fontSize:36}}>🗓️</div>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:C.forest,fontFamily:"Arial,sans-serif"}}>
              Create a Trip
            </div>
            <div style={{fontSize:12,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:3,lineHeight:1.4}}>
              Set up rounds, invite your group, track the whole trip
            </div>
          </div>
        </div>
      </button>

      <button onClick={onJoinTrip}
        style={{width:"100%",background:"rgba(255,255,255,.15)",
          border:"2px solid rgba(255,255,255,.3)",borderRadius:18,
          padding:"20px 24px",cursor:"pointer",textAlign:"left"}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{fontSize:36}}>🔑</div>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:C.white,fontFamily:"Arial,sans-serif"}}>
              Join a Trip
            </div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.65)",fontFamily:"Arial,sans-serif",marginTop:3,lineHeight:1.4}}>
              Enter the 6-digit code from your trip organizer
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}

function TripSetupScreen({go, session, onTripCreated}){
  const [step,      setStep]     = useState(1);
  const [tripName,  setTripName] = useState("");
  const [location,  setLocation] = useState("");
  const [startDate, setStartDate]= useState("");
  const [endDate,   setEndDate]  = useState("");
  const [players,   setPlayers]  = useState([
    {name:"",hcp:"",team:"red"},
    {name:"",hcp:"",team:"red"},
    {name:"",hcp:"",team:"blue"},
    {name:"",hcp:"",team:"blue"},
  ]);
  const [template,  setTemplate] = useState("ryder");
  const [games,     setGames]    = useState([]);
  const [loading,   setLoading]  = useState(false);
  const [error,     setError]    = useState("");
  const [joinCode,  setJoinCode] = useState("");

  const total=5, steps=["Trip Details","Add Players","Teams","Rounds","Side Games"];
  const toggleGame=g=>setGames(prev=>prev.includes(g)?prev.filter(x=>x!==g):[...prev,g]);

  const updatePlayer=(i,field,val)=>setPlayers(prev=>{const p=[...prev];p[i]={...p[i],[field]:val};return p;});

  const createTrip = async () => {
    setLoading(true); setError("");
    try {
      // 1. Generate join code
      const code = String(Math.floor(100000+Math.random()*900000));

      // 2. Create the trip
      const [trip] = await db.post("trips", {
        name:       tripName || "My Golf Trip",
        join_code:  code,
        organizer_id: session?.user?.id || null,
        course_name: location,
        start_date: startDate || null,
        end_date:   endDate || null,
        team1_name: "Red",
        team2_name: "Blue",
        status:     "active",
      });

      // 3. Add players
      const validPlayers = players.filter(p=>p.name.trim());
      if(validPlayers.length > 0){
        await db.post("trip_players", validPlayers.map(p=>({
          trip_id:   trip.id,
          name:      p.name.trim(),
          hcp_index: p.hcp ? parseFloat(p.hcp) : null,
          team:      p.team || "red",
          is_guest:  false,
        })));
      }

      setJoinCode(code);
      setStep(6); // success screen
      onTripCreated && onTripCreated(trip);
    } catch(e){
      setError("Failed to create trip: " + (e.message||"Unknown error"));
    }
    setLoading(false);
  };

  const inp=(val,fn,ph,type="text",extra={})=>(
    <input type={type} value={val} onChange={e=>fn(e.target.value)} placeholder={ph}
      style={{width:"100%",padding:"13px 14px",border:`2px solid ${val?C.forest:C.light}`,
        borderRadius:13,fontSize:14,fontFamily:"Arial,sans-serif",outline:"none",
        boxSizing:"border-box",background:val?C.mist:C.white,...extra}}/>
  );

  // ── Success screen ──
  if(step===6) return(
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,gap:20,background:C.smoke}}>
      <div style={{fontSize:64}}>🎉</div>
      <div style={{fontSize:24,fontWeight:700,color:C.forest,textAlign:"center"}}>Trip Created!</div>
      <div style={{fontSize:14,color:C.slate,fontFamily:"Arial,sans-serif",textAlign:"center"}}>Share this code with your group</div>
      <div style={{background:C.white,borderRadius:20,padding:"24px 32px",textAlign:"center",boxShadow:"0 4px 20px rgba(0,0,0,.08)"}}>
        <div style={{fontSize:12,color:C.gray,fontFamily:"Arial,sans-serif",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Trip Code</div>
        <div style={{fontSize:48,fontWeight:700,color:C.forest,letterSpacing:8}}>{joinCode}</div>
        <div style={{fontSize:12,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:8}}>Anyone with this code can join the trip</div>
      </div>
      <button onClick={()=>go("dashboard")} style={bigBtn(`linear-gradient(135deg,${C.forest},${C.fairway})`,C.white,{width:"100%"})}>
        Go to Trip Dashboard →
      </button>
    </div>
  );

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",background:C.smoke}}>
      <div style={{background:`linear-gradient(135deg,${C.forest},${C.fairway})`,padding:"16px 24px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <button onClick={()=>step>1?setStep(step-1):go("trip")} style={{background:"rgba(255,255,255,.15)",border:"none",color:C.white,borderRadius:8,padding:"5px 10px",fontSize:12,cursor:"pointer",fontFamily:"Arial,sans-serif"}}>← {step>1?"Back":"Exit"}</button>
          <span style={{color:"rgba(255,255,255,.6)",fontSize:12,fontFamily:"Arial,sans-serif"}}>{step} of {total}</span>
        </div>
        <div style={{color:C.white,fontSize:20,fontWeight:700}}>Create Trip</div>
        <div style={{color:"rgba(255,255,255,.6)",fontSize:13,fontFamily:"Arial,sans-serif"}}>{steps[step-1]}</div>
        <div style={{marginTop:12,background:"rgba(255,255,255,.2)",borderRadius:8,height:4}}>
          <div style={{width:`${(step/total)*100}%`,background:C.sand,height:"100%",borderRadius:8,transition:"width .3s ease"}}/>
        </div>
      </div>

      <div style={{flex:1,padding:24,overflowY:"auto"}}>
        {error&&<div style={{background:C.redBg,color:C.red,padding:"10px 14px",borderRadius:10,fontSize:13,fontFamily:"Arial,sans-serif",marginBottom:12}}>{error}</div>}

        {step===1&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.slate,fontFamily:"Arial,sans-serif",letterSpacing:.8,textTransform:"uppercase",marginBottom:5}}>Trip Name</div>
              {inp(tripName,setTripName,"e.g. Sand Valley 2026")}
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.slate,fontFamily:"Arial,sans-serif",letterSpacing:.8,textTransform:"uppercase",marginBottom:5}}>Location / Course</div>
              {inp(location,setLocation,"e.g. Sand Valley, WI")}
            </div>
            <div style={{display:"flex",gap:10}}>
              <div style={{flex:1}}>
                <div style={{fontSize:10,fontWeight:700,color:C.slate,fontFamily:"Arial,sans-serif",textTransform:"uppercase",marginBottom:4}}>Start Date</div>
                {inp(startDate,setStartDate,"",  "date")}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:10,fontWeight:700,color:C.slate,fontFamily:"Arial,sans-serif",textTransform:"uppercase",marginBottom:4}}>End Date</div>
                {inp(endDate,setEndDate,"", "date")}
              </div>
            </div>
          </div>
        )}

        {step===2&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{fontSize:12,color:C.slate,fontFamily:"Arial,sans-serif",marginBottom:4}}>
              Enter each player's name and handicap index. WHS course handicap is calculated automatically per round.
            </div>
            {players.map((p,i)=>(
              <div key={i} style={{...card({display:"flex",gap:8,alignItems:"center"})}}>
                <input placeholder={`Player ${i+1}`} value={p.name} onChange={e=>updatePlayer(i,"name",e.target.value)}
                  style={{flex:2,padding:"10px 12px",border:`1.5px solid ${p.name?C.forest:C.light}`,borderRadius:10,fontSize:13,fontFamily:"Arial,sans-serif",outline:"none"}}/>
                <input placeholder="HCP" value={p.hcp} onChange={e=>updatePlayer(i,"hcp",e.target.value)} type="number" min="0" max="54" step="0.1"
                  style={{flex:1,padding:"10px 8px",border:`1.5px solid ${p.hcp?C.forest:C.light}`,borderRadius:10,fontSize:13,fontFamily:"Arial,sans-serif",outline:"none",textAlign:"center"}}/>
              </div>
            ))}
            <button onClick={()=>setPlayers([...players,{name:"",hcp:"",team:"red"}])}
              style={{background:C.mist,border:`1.5px dashed ${C.mint}`,borderRadius:13,padding:14,fontSize:13,color:C.forest,fontWeight:700,cursor:"pointer",fontFamily:"Arial,sans-serif"}}>
              + Add Player
            </button>
          </div>
        )}

        {step===3&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{fontSize:12,color:C.slate,fontFamily:"Arial,sans-serif",marginBottom:4}}>Assign players to teams. Tap a player to switch teams.</div>
            {["red","blue"].map(team=>(
              <div key={team} style={{background:C.white,borderRadius:16,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
                <div style={{background:team==="red"?C.red:C.blue,padding:"10px 16px",color:C.white,fontWeight:700,fontFamily:"Arial,sans-serif",fontSize:13}}>
                  Team {team==="red"?"Red":"Blue"}
                </div>
                <div style={{padding:"12px 16px",display:"flex",flexWrap:"wrap",gap:8}}>
                  {players.filter(p=>p.name&&p.team===team).map((p,i)=>(
                    <div key={i} onClick={()=>{const idx=players.findIndex(pl=>pl.name===p.name&&pl.team===team);updatePlayer(idx,"team",team==="red"?"blue":"red");}}
                      style={{background:team==="red"?C.redBg:C.blueBg,borderRadius:20,padding:"6px 14px",fontSize:13,fontFamily:"Arial,sans-serif",fontWeight:600,color:team==="red"?C.red:C.blue,cursor:"pointer"}}>
                      {p.name}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={()=>{
              const updated=[...players];
              const named=updated.filter(p=>p.name);
              named.forEach((p,i)=>{const idx=players.indexOf(p);updated[idx].team=i%2===0?"red":"blue";});
              setPlayers(updated);
            }} style={{background:C.mist,border:`1.5px solid ${C.light}`,borderRadius:13,padding:12,fontSize:13,color:C.forest,fontWeight:600,cursor:"pointer",fontFamily:"Arial,sans-serif"}}>
              ⚡ Auto Balance Teams
            </button>
          </div>
        )}

        {step===4&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{fontSize:13,color:C.slate,fontFamily:"Arial,sans-serif",marginBottom:4}}>Choose a format template. You can customise rounds after the trip is created.</div>
            {[
              {id:"ryder",icon:"🏆",name:"Ryder Cup Template",desc:"Best Ball · Alt Shot · Singles",days:["Day 1: Best Ball + Alternate Shot","Day 2: Best Ball + Alternate Shot","Day 3: Singles"]},
              {id:"bestball",icon:"🤝",name:"Best Ball Only",desc:"All rounds are Best Ball",days:[]},
              {id:"singles",icon:"👤",name:"Singles",desc:"All rounds are individual match play",days:[]},
              {id:"custom",icon:"✏️",name:"Custom Setup",desc:"Build your own rounds after creation",days:[]},
            ].map(opt=>(
              <div key={opt.id} onClick={()=>setTemplate(opt.id)} style={{background:C.white,borderRadius:16,padding:"15px 18px",border:`2px solid ${template===opt.id?C.forest:C.light}`,cursor:"pointer",boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>{opt.icon} {opt.name}</div>
                    <div style={{fontSize:12,color:C.gray,fontFamily:"Arial,sans-serif",marginTop:2}}>{opt.desc}</div>
                  </div>
                  <div style={{fontSize:18}}>{template===opt.id?"✅":"⭕"}</div>
                </div>
                {template===opt.id&&opt.days.length>0&&(
                  <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:5}}>
                    {opt.days.map(d=><div key={d} style={{fontSize:12,color:C.forest,fontFamily:"Arial,sans-serif",paddingLeft:8}}>• {d}</div>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {step===5&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{fontSize:13,color:C.slate,fontFamily:"Arial,sans-serif",marginBottom:4}}>Select side games (optional — can add later)</div>
            {SIDE_GAMES.slice(0,6).map(g=>{
              const on=games.includes(g.id);
              return(
                <div key={g.id} onClick={()=>toggleGame(g.id)} style={{background:C.white,borderRadius:14,padding:"13px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 2px 6px rgba(0,0,0,.04)",cursor:"pointer",border:`1.5px solid ${on?C.forest:C.mist}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <span style={{fontSize:20}}>{g.icon}</span>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:C.charcoal,fontFamily:"Arial,sans-serif"}}>{g.name}</div>
                      <div style={{fontSize:11,color:C.gray,fontFamily:"Arial,sans-serif"}}>{g.desc.slice(0,45)}…</div>
                    </div>
                  </div>
                  <div style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${on?C.forest:C.light}`,background:on?C.forest:"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:C.white,fontSize:13,fontWeight:700,flexShrink:0}}>{on?"✓":""}</div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{marginTop:24}}>
          <button
            onClick={step<total?()=>setStep(step+1):createTrip}
            disabled={loading}
            style={bigBtn(`linear-gradient(135deg,${C.forest},${C.fairway})`,C.white,{boxShadow:"0 6px 20px rgba(27,67,50,.25)"})}>
            {loading?"Creating trip…":step===total?"Create Trip 🏌️":"Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}
// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App(){
  const [screen,          setScreenRaw]      = useState("login");
  const [screenHistory,   setScreenHistory]  = useState([]); // stack of previous screens for accurate Back navigation
  const [selectedMatchId, setSelectedMatchId]= useState(null);
  const [matches,         setMatches]        = useState([]);
  const [session,         setSession]        = useState(null);

  // While the app is open, proactively refresh the access token every 50
  // minutes (tokens last ~60 min) so an active session never expires
  // mid-use — this is on top of the on-load refresh check, covering the
  // case where someone leaves the app open for hours without reloading.
  useEffect(() => {
    if(!session?.refresh_token) return;
    const interval = setInterval(async () => {
      try {
        const refreshed = await auth.refreshSession(session.refresh_token);
        if(refreshed.access_token){
          setSession(refreshed);
          try { localStorage.setItem("matchup_session", JSON.stringify(refreshed)); } catch(e){}
        }
      } catch(e){ /* will retry on next interval or on next reload */ }
    }, 50 * 60 * 1000); // 50 minutes
    return () => clearInterval(interval);
  }, [session?.refresh_token]);
  const [activeTrip,      setActiveTrip]     = useState(null);
  const [tripLoading,     setTripLoading]    = useState(false);
  const [tripPlayers,     setTripPlayers]    = useState([]);
  const [appReady,        setAppReady]       = useState(false);
  const [editMatch,       setEditMatch]      = useState(null);
  const [tripCourses,     setTripCourses]    = useState([]);
  const [sideGames,       setSideGames]      = useState([]);
  const [editSideGame,    setEditSideGame]   = useState(null);
  const [lifetimeStats,   setLifetimeStats]  = useState(null); // null = not loaded yet, {} = loaded but no data

  // Compute the logged-in user's initials once here — derived from their
  // trip_players row (authoritative name) or session metadata as fallback.
  // Passed into every Header so the avatar bubble is always consistent.
  const userInitials = (() => {
    const tp = tripPlayers?.find(p => p.user_id === session?.user?.id)
      || tripPlayers?.find(p => p.name?.toLowerCase() === (session?.user?.email?.split("@")[0]||"").toLowerCase());
    const name = tp?.name
      || session?.user?.user_metadata?.display_name
      || session?.user?.email?.split("@")[0]
      || "";
    return calcInitials(name);
  })();
  const [prefillRound,    setPrefillRound]   = useState(null); // matchId to pre-select when opening side game setup fresh
  // setScreen pushes the CURRENT screen onto history before navigating, so Back
  // always returns to wherever the person actually came from — not a hardcoded
  // destination. Bottom-nav taps (dashboard/matches/board/trip/profile) reset
  // history since those are top-level destinations, not a "drill in" action.
  const TOP_LEVEL_SCREENS = ["dashboard","matches","board","trip","profile"];
  const setScreen = (dest) => {
    setScreenHistory(prev => {
      if(TOP_LEVEL_SCREENS.includes(dest)) return []; // fresh start from a tab
      if(screen === dest) return prev; // no-op navigation, don't push duplicate
      return [...prev, screen];
    });
    setScreenRaw(dest);
  };
  const goBack = () => {
    setScreenHistory(prev => {
      if(prev.length === 0){ setScreenRaw("dashboard"); return []; }
      const last = prev[prev.length-1];
      setScreenRaw(last);
      return prev.slice(0,-1);
    });
  };
  // Bottom-nav taps always start a fresh history — these are top-level
  // destinations, not a "drill in" action, so Back from here should go
  // to Dashboard rather than wherever you happened to be navigating before.
  const navigateTab = (dest) => {
    setScreenHistory([]);
    setScreenRaw(dest);
  };

  const updateMatch = (id, changes) =>
    setMatches(prev => prev.map(m => m.id===id ? {...m, ...changes} : m));

  const ts            = useMemo(()=>deriveTeamScores(matches, tripPlayers),    [matches, tripPlayers]);
  const playerRecords = useMemo(()=>derivePlayerRecords(matches), [matches]);

  const navScreens = ["dashboard","matches","live","board","trip","profile","sidegames","setup","matchedit","creatematch","coursesetup","payouts","sidegamesetup","intent","join"];
  const showNav    = navScreens.includes(screen) && screen !== "intent" && screen !== "join" && screen !== "login";
  const goMatch = (matchId, dest) => {
    setSelectedMatchId(matchId);
    if(dest === "creatematch"){
      const m = matches.find(m=>m.id===matchId);
      setEditMatch(m || null);
    }
    setScreen(dest);
  };

  const loadTrip = useCallback(async (trip) => {
    setTripLoading(true);
    try {
      const players = await db.get("trip_players", `trip_id=eq.${trip.id}&select=*&order=created_at.asc`);
      setTripPlayers(players);

      // Load courses and tee boxes for this trip
      const courses = await db.get("courses", `trip_id=eq.${trip.id}&select=*&order=created_at.asc`);
      if(courses.length > 0){
        const tees = await db.get("tee_boxes",
          `course_id=in.(${courses.map(c=>c.id).join(",")})&select=*&order=created_at.asc`);
        const coursesWithTees = courses.map(c=>({
          ...c,
          tee_boxes: tees.filter(t=>t.course_id===c.id),
        }));
        setTripCourses(coursesWithTees);
      }

      // Load custom side games for this trip
      const dbSideGames = await db.get("side_games", `trip_id=eq.${trip.id}&active=eq.true&select=*&order=created_at.asc`);
      if(dbSideGames.length > 0){
        setSideGames(dbSideGames.map(g=>({
          id: g.id, matchId: g.match_id, type: g.type, name: g.name,
          side1Keys: g.side1_keys||[], side2Keys: g.side2_keys||[],
          poolKeys: g.pool_keys||[], betAmount: parseFloat(g.bet_amount)||10,
        })));
      }
      const dbMatches = await db.get("matches",
        `trip_id=eq.${trip.id}&status=neq.deleted&select=*&order=created_at.asc`);
      if(dbMatches.length > 0){
        // Fetch every hole score row for these matches and rebuild each match's
        // holeScores map — without this, scores entered during live scoring
        // would vanish on every page reload even though they're saved in the DB.
        const matchIds = dbMatches.map(m=>m.id);
        let holeScoresByMatch = {};
        try {
          const allHoleScores = await db.get("hole_scores",
            `match_id=in.(${matchIds.join(",")})&select=*`);
          allHoleScores.forEach(hs => {
            if(!holeScoresByMatch[hs.match_id]) holeScoresByMatch[hs.match_id] = {};
            const matchScores = holeScoresByMatch[hs.match_id];
            if(!matchScores[hs.hole_number]) matchScores[hs.hole_number] = {};
            // Resolve player_id back to the lowercase-name key used throughout the app
            const tp = players.find(p => p.id === hs.player_id);
            const key = tp ? tp.name.toLowerCase() : hs.player_id;
            matchScores[hs.hole_number][key] = hs.gross_score;
          });
        } catch(e){ console.warn("Failed to load hole_scores:", e.message); }

        const appMatches = dbMatches.map(m => ({
          id:          m.id,
          round:       1,
          day:         "Trip Day",
          p1:          m.p1_label || "Team 1",
          p2:          m.p2_label || "Team 2",
          p1Keys:      (m.p1_player_ids||[]).map(pid => { const p=players.find(pl=>pl.id===pid); return p?p.name.toLowerCase():pid; }),
          p2Keys:      (m.p2_player_ids||[]).map(pid => { const p=players.find(pl=>pl.id===pid); return p?p.name.toLowerCase():pid; }),
          status:      m.status      || "upcoming",
          winnerSide:  m.winner_side || null,
          score:       m.score       || null,
          thru:        m.thru        || 0,
          liveScore:   m.live_score  || null,
          format:      m.format      || "Best Ball",
          hcp_mode:    m.hcp_mode    || "whs",
          hcp_pct:     m.hcp_pct     || 90,
          course_name: m.course_name || null,
          match_date:  m.match_date  || null,
          round_name:  m.round_name  || null,
          tee_name:    m.tee_name    || null,
          slope:       m.slope       || null,
          rating:      m.rating      || null,
          par:         m.par         || null,
          hole_data:    m.hole_data    || null,
          bankedScores: m.banked_scores ? (typeof m.banked_scores==="string"?JSON.parse(m.banked_scores):m.banked_scores) : {},
          // score_data holds the full hole-by-hole map for Scramble/Alt Shot/
          // X-Ball formats (team_p1/team_p2 keys, or per-player keys for X-Ball
          // banking) — these don't fit the per-player UUID-based hole_scores
          // table, so they're saved/restored as one JSON blob on the match row.
          holeScores: (() => {
            const fromHoleScoresTable = holeScoresByMatch[m.id] || {};
            if(!m.score_data) return fromHoleScoresTable;
            try {
              const parsed = typeof m.score_data==="string" ? JSON.parse(m.score_data) : m.score_data;
              // Merge: score_data is authoritative for team/X-ball formats,
              // but don't discard anything also tracked via hole_scores.
              const merged = {...fromHoleScoresTable};
              Object.entries(parsed||{}).forEach(([h, scores])=>{
                merged[h] = {...(merged[h]||{}), ...scores};
              });
              return merged;
            } catch(e){ return fromHoleScoresTable; }
          })(),
        }));
        setMatches(appMatches);
      }
      setActiveTrip(trip);
    } catch(e){ console.error("Failed to load trip:", e); }
    setTripLoading(false);
  }, []);

  // ── Lifetime stats: aggregates this user's record across EVERY trip they've
  // ever been linked to (organized or joined), not just the active one. This
  // replaces what used to be entirely fabricated "career" demo data in the
  // Profile screen — every number here is now derived from real completed
  // matches across real trips this account has actually played in.
  const loadLifetimeStats = useCallback(async (userId) => {
    if(!userId) { setLifetimeStats({}); return; }
    try {
      // Find every trip this user organized
      const organizedTrips = await db.get("trips", `organizer_id=eq.${userId}&select=id,name,start_date`);
      // Find every trip this user joined as a player
      const memberships = await db.get("trip_players", `user_id=eq.${userId}&select=trip_id,name`);
      const joinedTripIds = [...new Set(memberships.map(m=>m.trip_id))];
      const myNameOnTrips = memberships.map(m=>m.name.toLowerCase());

      const allTripIds = [...new Set([...organizedTrips.map(t=>t.id), ...joinedTripIds])];
      if(allTripIds.length === 0) { setLifetimeStats({}); return; }

      let joinedTripDetails = [];
      if(joinedTripIds.length > 0){
        joinedTripDetails = await db.get("trips", `id=in.(${joinedTripIds.join(",")})&select=id,name,start_date`);
      }
      const allTripsById = Object.fromEntries(
        [...organizedTrips, ...joinedTripDetails].map(t=>[t.id, t])
      );

      // Fetch every completed match across all of this user's trips
      const allMatches = await db.get("matches",
        `trip_id=in.(${allTripIds.join(",")})&status=eq.completed&select=*`);

      // Aggregate per-trip and overall stats, matching by this user's lowercase
      // name(s) across trips (a person might be on multiple trips' rosters)
      const perTrip = {};
      let totalW=0, totalL=0, totalH=0, totalPts=0;

      allMatches.forEach(m => {
        const p1Keys = m.p1_player_ids ? null : null; // not used — match by name keys below
        const namesOnTrip = myNameOnTrips; // could differ per trip, but usually consistent
        const p1HasMe = (m.p1_label||"").toLowerCase().split("/").some(n=>namesOnTrip.includes(n.trim()));
        const p2HasMe = (m.p2_label||"").toLowerCase().split("/").some(n=>namesOnTrip.includes(n.trim()));
        if(!p1HasMe && !p2HasMe) return;

        const mySide = p1HasMe ? "p1" : "p2";
        const halved = m.winner_side === "halve";
        const won = !halved && m.winner_side === mySide;

        if(!perTrip[m.trip_id]) perTrip[m.trip_id] = {w:0,l:0,h:0,pts:0};
        if(halved){ perTrip[m.trip_id].h++; perTrip[m.trip_id].pts+=0.5; totalH++; totalPts+=0.5; }
        else if(won){ perTrip[m.trip_id].w++; perTrip[m.trip_id].pts+=1; totalW++; totalPts+=1; }
        else { perTrip[m.trip_id].l++; totalL++; }
      });

      const tripBreakdown = Object.entries(perTrip).map(([tripId, rec]) => ({
        tripId,
        name: allTripsById[tripId]?.name || "Trip",
        date: allTripsById[tripId]?.start_date || null,
        record: `${rec.w}–${rec.l}–${rec.h}`,
        pts: rec.pts,
      })).sort((a,b) => (b.date||"").localeCompare(a.date||""));

      const totalPlayed = totalW + totalL + totalH;
      setLifetimeStats({
        trips: allTripIds.length,
        record: `${totalW}–${totalL}–${totalH}`,
        winPct: totalPlayed > 0 ? Math.round((totalW/totalPlayed)*100) : 0,
        totalPts,
        tripBreakdown,
      });
    } catch(e){
      console.warn("Failed to load lifetime stats:", e.message);
      setLifetimeStats({});
    }
  }, []);

  // Load lifetime stats whenever we have a logged-in user (covers fresh
  // sign-in, restored session, and session refresh — all paths that set
  // session end up triggering this since it watches the user id itself).
  useEffect(() => {
    if(session?.user?.id) loadLifetimeStats(session.user.id);
  }, [session?.user?.id, loadLifetimeStats]);

  // ── Realtime sync: live score updates appear on every connected phone ────────
  // Subscribes to Postgres changes on `matches` (status/score/thru/live_score)
  // and `hole_scores` (individual hole entries) for the active trip. When any
  // other device saves a score, this merges the change into local state so
  // everyone watching sees it update within ~1 second, no manual refresh needed.
  useEffect(() => {
    if(!activeTrip?.id) return;

    const channel = supabase
      .channel(`trip-${activeTrip.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `trip_id=eq.${activeTrip.id}` },
        (payload) => {
          const row = payload.new;
          if(!row?.id) return;
          setMatches(prev => {
            const exists = prev.find(m => m.id === row.id);
            if(!exists) return prev; // new match inserts are picked up via normal load flow
            // Merge remote fields without clobbering local-only fields (like
            // in-progress holeScores edits not yet saved by THIS device)
            return prev.map(m => m.id === row.id ? {
              ...m,
              status:       row.status      ?? m.status,
              thru:         row.thru        ?? m.thru,
              liveScore:    row.live_score  ?? m.liveScore,
              winnerSide:   row.winner_side ?? m.winnerSide,
              score:        row.score       ?? m.score,
              format:       row.format      ?? m.format,
              course_name:  row.course_name ?? m.course_name,
              tee_name:     row.tee_name    ?? m.tee_name,
              bankedScores: row.banked_scores ? (typeof row.banked_scores==="string"?JSON.parse(row.banked_scores):row.banked_scores) : m.bankedScores,
              holeScores: (() => {
                if(!row.score_data) return m.holeScores;
                try {
                  const parsed = typeof row.score_data==="string" ? JSON.parse(row.score_data) : row.score_data;
                  const merged = {...m.holeScores};
                  Object.entries(parsed||{}).forEach(([h, scores])=>{
                    // Fill in only keys not already present locally — never
                    // overwrite a score this device itself is mid-entering.
                    merged[h] = {...scores, ...(merged[h]||{})};
                  });
                  return merged;
                } catch(e){ return m.holeScores; }
              })(),
            } : m);
          });
        }
      )
      .on("postgres_changes",
        { event: "*", schema: "public", table: "hole_scores" },
        (payload) => {
          const row = payload.new;
          if(!row?.match_id) return;
          setMatches(prev => {
            const exists = prev.find(m => m.id === row.match_id);
            if(!exists) return prev;
            return prev.map(m => {
              if(m.id !== row.match_id) return m;
              // Find which player key this player_id corresponds to
              const tp = tripPlayers.find(p => p.id === row.player_id);
              const key = tp ? tp.name.toLowerCase() : row.player_id;
              const newHoleScores = {
                ...m.holeScores,
                [row.hole_number]: { ...(m.holeScores?.[row.hole_number]||{}), [key]: row.gross_score },
              };
              return { ...m, holeScores: newHoleScores };
            });
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeTrip?.id, tripPlayers]);


  // If no valid session is found, the login screen is always shown.
  useEffect(()=>{
    const restore = async () => {
      try {
        const stored = localStorage.getItem("matchup_session");
        if(stored){
          let s = JSON.parse(stored);
          // Validate token hasn't expired
          const exp = s.expires_at || s.user?.exp;
          const isExpired = exp && (exp * 1000) < Date.now();

          if(isExpired && s.refresh_token){
            // Access token expired but we have a refresh token — silently get
            // a new access token instead of forcing a fresh login. This is
            // the fix for getting logged out every ~hour even mid-session.
            try {
              const refreshed = await auth.refreshSession(s.refresh_token);
              if(refreshed.access_token){
                s = refreshed;
                try { localStorage.setItem("matchup_session", JSON.stringify(s)); } catch(e){}
              }
            } catch(e){ /* refresh failed — fall through */ }
          }

          const stillExpired = (s.expires_at||s.user?.exp) && ((s.expires_at||s.user?.exp) * 1000) < Date.now();
          if(!stillExpired && s.access_token && s.user?.id){
            setSession(s);
            try {
              // Find a trip this user is connected to — either one they organized,
              // OR one they joined as a player via trip_players (most common case
              // for non-organizer participants who joined with a trip code).
              let trip = null;
              const organized = await db.get("trips",
                `organizer_id=eq.${s.user.id}&status=eq.active&order=created_at.desc&limit=1`);
              if(organized.length > 0){
                trip = organized[0];
              } else {
                const memberships = await db.get("trip_players",
                  `user_id=eq.${s.user.id}&select=trip_id&order=created_at.desc&limit=1`);
                if(memberships.length > 0){
                  const joinedTrips = await db.get("trips",
                    `id=eq.${memberships[0].trip_id}&status=eq.active&limit=1`);
                  if(joinedTrips.length > 0) trip = joinedTrips[0];
                }
              }
              if(trip){
                await loadTrip(trip);
                setScreen("dashboard");
              } else {
                // Logged in but no active trip — go straight to trip setup
                setScreen("intent");
              }
            } catch(e){ setScreen("dashboard"); }
            setAppReady(true); return;
          } else {
            // Expired — clear it so they see login
            localStorage.removeItem("matchup_session");
          }
        }
      } catch(e){ localStorage.removeItem("matchup_session"); }
      setAppReady(true); // No valid session — show login
    };
    restore();
  }, [loadTrip]);

  const handleAuth = async ({ mode, session: s, trip }) => {
    if(s){
      setSession(s);
      try { localStorage.setItem("matchup_session", JSON.stringify(s)); } catch(e){}
    }
    let foundTrip = false;
    if(trip){
      await loadTrip(trip);
      foundTrip = true;
    } else if(s?.user?.id){
      try {
        const organized = await db.get("trips",
          `organizer_id=eq.${s.user.id}&status=eq.active&order=created_at.desc&limit=1`);
        if(organized.length > 0){
          await loadTrip(organized[0]);
          foundTrip = true;
        } else {
          const memberships = await db.get("trip_players",
            `user_id=eq.${s.user.id}&select=trip_id&order=created_at.desc&limit=1`);
          if(memberships.length > 0){
            const joinedTrips = await db.get("trips",
              `id=eq.${memberships[0].trip_id}&status=eq.active&limit=1`);
            if(joinedTrips.length > 0){
              await loadTrip(joinedTrips[0]);
              foundTrip = true;
            }
          }
        }
      } catch(e){}
    }
    // If no trip found, send them to setup instead of showing empty demo data
    setScreen(foundTrip ? "dashboard" : "intent");
  };

  const handleSignOut = useCallback(() => {
    localStorage.removeItem("matchup_session");
    setSession(null);
    setActiveTrip(null);
    setTripPlayers([]);
    setMatches([]);
    setScreen("login");
  }, []);

  const handleTripCreated = useCallback(async (trip) => {
    await loadTrip(trip);
    setScreen("creatematch");
  }, [loadTrip]);

  // Quick Match: silently creates a minimal shadow trip so all match/scoring
  // logic works unchanged, then drops the user straight into match creation.
  // The trip is named "Quick Match · [date]" and is invisible to the user —
  // they just land on the create-match screen as if no setup happened.

  const handleMatchCreated = useCallback((newMatch) => {
    setMatches(prev => {
      if(newMatch.status === "deleted"){
        return prev.filter(m => m.id !== newMatch.id);
      }
      const exists = prev.find(m => m.id === newMatch.id);
      if(exists){
        // Preserve live scoring data — never wipe holeScores or thru on edit
        return prev.map(m => m.id === newMatch.id ? {
          ...m,
          ...newMatch,
          // Always keep existing scores/progress intact
          holeScores: m.holeScores || newMatch.holeScores || {},
          thru:       m.thru       || newMatch.thru       || 0,
          liveScore:  m.liveScore  || newMatch.liveScore  || null,
          status:     m.status === "live" ? "live" : (newMatch.status || m.status),
        } : m);
      }
      return [...prev, newMatch];
    });
  }, []);

  const matchProps = { matches, ts, playerRecords, updateMatch, goMatch, tripPlayers, sideGames, activeTrip, userInitials };

  return(
    <div style={{fontFamily:"Georgia,serif",background:C.cream,minHeight:"100vh",display:"flex",justifyContent:"center",alignItems:"flex-start",padding:"20px 16px 40px"}}>
      <div style={{width:390,minHeight:844,background:C.white,borderRadius:44,boxShadow:"0 32px 80px rgba(27,67,50,.18)",overflow:"hidden",display:"flex",flexDirection:"column",position:"relative"}}>
        <div style={{background:C.forest,padding:"14px 24px 10px",display:"flex",justifyContent:"space-between",color:C.white,fontSize:12,fontFamily:"Arial,sans-serif",fontWeight:600}}>
          <span>9:41</span><span>●●●</span><span>100%</span>
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",overflowY:"auto"}}>
          {!appReady ? (
            // Splash while checking stored session
            <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,background:`linear-gradient(165deg,${C.forest},${C.turf})`}}>
              <div style={{fontSize:64}}>⛳</div>
              <div style={{fontSize:22,fontWeight:700,color:C.white}}>MatchUp Golf</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.6)",fontFamily:"Arial,sans-serif"}}>Loading…</div>
            </div>
          ) : tripLoading ? (
            <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
              <div style={{fontSize:36}}>⛳</div>
              <div style={{fontSize:16,fontWeight:700,color:C.forest}}>Loading Trip…</div>
              <div style={{fontSize:12,color:C.gray,fontFamily:"Arial,sans-serif"}}>Getting your data</div>
            </div>
          ) : (<>
            {screen==="login"       &&<LoginScreen        onAuth={handleAuth}/>}
            {screen==="dashboard"   &&<DashboardScreen    go={setScreen} activeTrip={activeTrip} tripPlayers={tripPlayers} {...matchProps}/>}
            {screen==="matches"     &&<MatchesScreen      go={setScreen} tripPlayers={tripPlayers} {...matchProps}/>}
            {screen==="live"        &&<LiveMatchScreen    go={setScreen} goBack={goBack} goMatch={goMatch} matchId={selectedMatchId} tripPlayers={tripPlayers} activeTrip={activeTrip} sideGames={sideGames}
              onAddSideGame={mId=>{setEditSideGame(null);setPrefillRound(mId);}}
              onEditSideGameFromLive={g=>{setEditSideGame(g);setPrefillRound(null);}}
              {...matchProps}/>}
            {screen==="board"       &&<LeaderboardScreen  go={setScreen} tripPlayers={tripPlayers} activeTrip={activeTrip} {...matchProps}/>}
            {screen==="sidegames"   &&<SideGamesScreen    go={setScreen} goBack={goBack}/>}
            {screen==="trip"        &&<TripScreen         go={setScreen} activeTrip={activeTrip} tripPlayers={tripPlayers} onGoMatch={m=>{setEditMatch(m||null);}} {...matchProps}/>}
            {screen==="creatematch" &&<CreateMatchScreen  go={setScreen} goBack={goBack} activeTrip={activeTrip} tripPlayers={tripPlayers} editMatch={editMatch} tripCourses={tripCourses} onMatchCreated={handleMatchCreated} onCourseAdded={c=>setTripCourses(prev=>[...prev,c])}/>}
            {screen==="coursesetup" &&<CourseSetupScreen  go={setScreen} goBack={goBack} activeTrip={activeTrip} onCourseAdded={c=>{setTripCourses(prev=>[...prev,c]);setScreen("creatematch");}}/>}
            {screen==="join"        &&<LoginScreen        onAuth={handleAuth} defaultMode="join"/>}
            {screen==="intent"      &&<NoTripScreen       onCreateTrip={()=>setScreen("setup")} onJoinTrip={()=>setScreen("join")}/>}
            {screen==="setup"       &&<TripSetupScreen    go={setScreen} session={session} onTripCreated={handleTripCreated}/>}
            {screen==="profile"     &&<ProfileScreen      go={setScreen} goBack={goBack} onSignOut={handleSignOut} session={session} tripPlayers={tripPlayers} activeTrip={activeTrip} lifetimeStats={lifetimeStats} {...matchProps}/>}
            {screen==="matchedit"   &&<MatchEditScreen    go={setScreen} goBack={goBack} matchId={selectedMatchId} {...matchProps}/>}
            {screen==="payouts"     &&<PayoutsScreen      go={setScreen} goBack={goBack} tripPlayers={tripPlayers} activeTrip={activeTrip} sideGames={sideGames} onEditGame={g=>setEditSideGame(g)} {...matchProps}/>}
            {screen==="sidegamesetup" &&<SideGameSetupScreen go={setScreen} goBack={goBack} activeTrip={activeTrip} tripPlayers={tripPlayers} matches={matches} editGame={editSideGame} prefillRound={prefillRound}
              onGameCreated={g=>{setSideGames(prev=>[...prev,g]);setPrefillRound(null);}}
              onGameUpdated={g=>{setSideGames(prev=>prev.map(sg=>sg.id===g.id?g:sg));setEditSideGame(null);}}
              onGameDeleted={id=>{setSideGames(prev=>prev.filter(sg=>sg.id!==id));setEditSideGame(null);}}/>}
          </>)}
        </div>
        {showNav&&!tripLoading&&appReady&&<BottomNav screen={screen} set={navigateTab} liveCount={matches.filter(m=>m.status==="live").length}/>}
      </div>
    </div>
  );
}

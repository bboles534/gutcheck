// Pure game logic — no DOM. Unit-tested in tests/core.test.mjs.
import { POOL, TYPES, VERDICTS } from "./content.js";

export const PER_AXIS = 4;
export const COUNT = PER_AXIS * 3; // 12 choices per day
export const TIME_LIMIT_MS = 3000;
export const EPOCH = Date.UTC(2026, 10, 26); // Set #1 = Nov 26, 2026

/** Seeded PRNG (mulberry32): same seed → same sequence on every device. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, r) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Day number in the user's local calendar (1 = launch day). */
export function dayNumber(date = new Date()) {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.max(1, Math.floor((utc - EPOCH) / 864e5) + 1);
}

export function dayLabel(day) {
  return new Date(EPOCH + (day - 1) * 864e5)
    .toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    .toUpperCase();
}

/** The 12 prompts for a given day. Deterministic, so everyone gets the same set. */
export function setFor(day) {
  const r = rng(day * 7919 + 13);
  const items = [];
  for (const ax of ["C", "S", "N"]) {
    const picks = shuffle(POOL[ax].map((_, i) => i), r).slice(0, PER_AXIS);
    for (const i of picks) {
      const [p1, p2] = POOL[ax][i];
      const flip = r() < 0.5;
      items.push({ ax, top: flip ? p2 : p1, bot: flip ? p1 : p2, topIsPole1: !flip });
    }
  }
  return shuffle(items, r);
}

// ---- Share-link encoding -------------------------------------------------
// Answers are 't' (top), 'b' (bottom) or 'x' (froze). 12 base-3 digits fit in
// < 531441, so a whole result packs into ~4 base36 chars. Each digit is shifted
// by a per-day key so answers aren't readable straight off the link.
const D = { t: 0, b: 1, x: 2 };
const C = ["t", "b", "x"];
const MAX = 3 ** COUNT;

function keyFor(day) {
  const r = rng(day * 104729 + 77);
  return Array.from({ length: COUNT }, () => Math.floor(r() * 3));
}

export function encode({ day, ans, avg = 0, name = "" }) {
  if (!/^[tbx]{12}$/.test(ans)) throw new Error("bad answers");
  const k = keyFor(day);
  let n = 0;
  for (let i = 0; i < COUNT; i++) n = n * 3 + ((D[ans[i]] + k[i]) % 3);
  const nm = encodeURIComponent(String(name).trim().slice(0, 18));
  return `v1.${day}.${n.toString(36)}.${Math.round(avg / 10).toString(36)}.${nm}`;
}

export function decode(str) {
  if (typeof str !== "string") return null;
  const p = str.replace(/^#/, "").split(".");
  if (p[0] !== "v1" || p.length < 5) return null;
  const day = Number(p[1]);
  let n = parseInt(p[2], 36);
  const avg = (parseInt(p[3], 36) || 0) * 10;
  if (!Number.isInteger(day) || day < 1 || day > 100000) return null;
  if (!/^[0-9a-z]+$/.test(p[2]) || !(n >= 0 && n < MAX)) return null;
  let name = "";
  try { name = decodeURIComponent(p.slice(4).join(".")); } catch { name = ""; }
  const k = keyFor(day);
  const digits = [];
  for (let i = COUNT - 1; i >= 0; i--) { digits[i] = n % 3; n = Math.floor(n / 3); }
  const ans = digits.map((v, i) => C[(v - k[i] + 3) % 3]).join("");
  return { day, ans, avg, name: name.trim().slice(0, 18) || "Someone" };
}

// ---- Scoring -------------------------------------------------------------
/** Personality archetype from the three axis tallies. */
export function archetype(day, ans) {
  const items = setFor(day);
  const score = { C: 0, S: 0, N: 0 };
  items.forEach((it, i) => {
    const a = ans[i];
    if (a === "x") return;
    const pole1 = a === "t" ? it.topIsPole1 : !it.topIsPole1;
    score[it.ax] += pole1 ? 1 : -1;
  });
  const key = (score.C >= 0 ? "C" : "X") + (score.S >= 0 ? "S" : "L") + (score.N >= 0 ? "N" : "W");
  const [name, line] = TYPES[key];
  return { key, name, line, score };
}

/** Percent of the 12 choices two people made the same way (both freezing counts). */
export function compare(a, b) {
  let same = 0;
  const rows = [];
  for (let i = 0; i < COUNT; i++) {
    const m = a[i] === b[i];
    if (m) same++;
    rows.push(m);
  }
  return { pct: Math.round((same / COUNT) * 100), same, rows };
}

export function verdict(pct) {
  return VERDICTS.find(([min]) => pct >= min)[1];
}

export function emojiStrip(ans) {
  return [...ans].map((a) => (a === "t" ? "🟧" : a === "b" ? "🟦" : "⬛")).join("");
}

export function matchStrip(rows) {
  return rows.map((m) => (m ? "🤝" : "⚡")).join("");
}

/** Clearly-labeled demo friend whose answers are seeded by day. */
export function demoAnswers(day, salt = 1) {
  const r = rng(day * 31 + salt * 977);
  return Array.from({ length: COUNT }, () => {
    const v = r();
    return v < 0.06 ? "x" : v < 0.53 ? "t" : "b";
  }).join("");
}

/** Consecutive days played on their own day, ending today (or yesterday). */
export function streak(plays, today) {
  let d = plays[today] ? today : today - 1;
  let s = 0;
  while (plays[d] && plays[d].own) { s++; d--; }
  return s;
}

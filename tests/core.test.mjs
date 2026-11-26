import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COUNT, setFor, encode, decode, compare, archetype, verdict, streak, dayNumber, demoAnswers,
} from "../js/core.js";
import { POOL } from "../js/content.js";

test("daily set is deterministic and balanced across axes", () => {
  const a = setFor(5), b = setFor(5);
  assert.deepEqual(a, b);
  assert.equal(a.length, COUNT);
  for (const ax of ["C", "S", "N"]) assert.equal(a.filter((i) => i.ax === ax).length, 4);
  assert.notDeepEqual(setFor(5), setFor(6));
});

test("no duplicate prompts inside a set, for a year of sets", () => {
  for (let d = 1; d <= 365; d++) {
    const tops = setFor(d).map((i) => i.top + i.bot);
    assert.equal(new Set(tops).size, COUNT, `day ${d}`);
  }
});

test("pool pairs are unique and well formed", () => {
  for (const ax of Object.keys(POOL)) {
    assert.ok(POOL[ax].length >= 16);
    for (const p of POOL[ax]) assert.equal(p.length, 2);
  }
});

test("encode/decode round-trips every answer pattern shape", () => {
  const samples = ["tttttttttttt", "bbbbbbbbbbbb", "xxxxxxxxxxxx", "tbxtbxtbxtbx", demoAnswers(9, 2)];
  for (const ans of samples) {
    const s = encode({ day: 42, ans, avg: 812, name: "Maya R." });
    const d = decode("#" + s);
    assert.equal(d.ans, ans);
    assert.equal(d.day, 42);
    assert.equal(d.avg, 810);
    assert.equal(d.name, "Maya R.");
  }
});

test("links don't expose raw answers and stay short", () => {
  const s = encode({ day: 3, ans: "tttttttttttt", name: "Al" });
  assert.ok(s.length < 24, s);
  assert.ok(!s.includes("tttt"));
});

test("decode rejects garbage", () => {
  for (const bad of ["", "#", "#hello", "#v1.0.abc.1.x", "#v1.5.zzzzzzzz.1.x", "#v2.1.1.1.x", null]) {
    assert.equal(decode(bad), null, String(bad));
  }
  assert.equal(decode("#v1.4.1.1.%E0%A4%A").name, "Someone"); // malformed URI name
});

test("compare scores matches as a percent", () => {
  assert.equal(compare("tttttttttttt", "tttttttttttt").pct, 100);
  assert.equal(compare("tttttttttttt", "bbbbbbbbbbbb").pct, 0);
  assert.equal(compare("ttttttbbbbbb", "tttttttttttt").pct, 50);
  assert.equal(compare("tttttttttttt", "tttttttttttt").rows.length, 12);
});

test("archetype is one of 8 and flips with opposite answers", () => {
  const day = 7, set = setFor(day);
  const pole1 = set.map((i) => (i.topIsPole1 ? "t" : "b")).join("");
  const pole2 = set.map((i) => (i.topIsPole1 ? "b" : "t")).join("");
  assert.equal(archetype(day, pole1).key, "CSN");
  assert.equal(archetype(day, pole2).key, "XLW");
});

test("verdict covers the full range", () => {
  for (let p = 0; p <= 100; p++) assert.equal(typeof verdict(p), "string");
});

test("streak counts consecutive own-day plays", () => {
  const plays = { 8: { own: true }, 9: { own: true }, 10: { own: true }, 6: { own: true } };
  assert.equal(streak(plays, 10), 3);
  assert.equal(streak(plays, 11), 3); // today not played yet still shows streak
  assert.equal(streak(plays, 12), 0);
  assert.equal(streak({ 10: { own: false } }, 10), 0);
});

test("day numbering starts at 1 on launch day", () => {
  assert.equal(dayNumber(new Date(2026, 10, 26, 9)), 1);
  assert.equal(dayNumber(new Date(2026, 10, 27, 0, 1)), 2);
  assert.equal(dayNumber(new Date(2020, 0, 1)), 1);
});

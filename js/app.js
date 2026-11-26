import {
  COUNT, TIME_LIMIT_MS, setFor, dayNumber, dayLabel, encode, decode, archetype,
  compare, verdict, emojiStrip, matchStrip, demoAnswers, streak,
} from "./core.js";
import { soloCard, matchCard } from "./card.js";

const app = document.getElementById("app");
const BASE = location.origin + location.pathname;
const SHORT = (location.host + location.pathname).replace(/\/$/, "");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- persistence (localStorage, fail-safe) ----------
const KEY = "gutcheck.v1";
const S = Object.assign({ name: "", plays: {}, matches: {} }, (() => {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
})());
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private mode */ } };

// ---------- helpers ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const buzz = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch { /* noop */ } };
const secs = (ms) => (ms / 1000).toFixed(2) + "s";
const avgOf = (ms) => { const v = ms.filter((x) => x < TIME_LIMIT_MS); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : TIME_LIMIT_MS; };
const today = () => dayNumber();
const myName = () => S.name || "You";
let toastT;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("on");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 2600);
}
function view(html) {
  stopTimers();
  app.innerHTML = `<div class="screen">${html}</div>`;
  window.scrollTo(0, 0);
  return app.firstElementChild;
}
let timers = [];
function stopTimers() { timers.forEach((t) => clearInterval(t)); timers = []; }

function countdownText() {
  const n = new Date(), m = new Date(n); m.setHours(24, 0, 0, 0);
  const s = Math.max(0, Math.floor((m - n) / 1000));
  return [s / 3600, (s % 3600) / 60, s % 60].map((v) => String(Math.floor(v)).padStart(2, "0")).join(":");
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch { ok = false; }
    ta.remove(); return ok;
  }
}
async function shareText(text) {
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    try { await navigator.share({ text }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  toast((await copy(text)) ? "Copied. Paste it in the chat." : "Couldn't copy — long-press to select.");
}
async function shareImage(blob, name) {
  const file = new File([blob], name, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && matchMedia("(pointer: coarse)").matches) {
    try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("Card saved.");
}
const linkFor = (day) => { const p = S.plays[day]; return BASE + "#" + encode({ day, ans: p.ans, avg: avgOf(p.ms), name: S.name }); };

// ---------- HOME ----------
function home() {
  const d = today(), played = S.plays[d], st = streak(S.plays, d);
  const board = Object.values(S.matches).sort((a, b) => b.pct - a.pct || b.at - a.at).slice(0, 8);
  const mq = "NEW SET AT MIDNIGHT ✦ 12 CHOICES ✦ 3 SECONDS EACH ✦ NO OVERTHINKING ✦ SEND IT TO THE CHAT ✦ ";
  const el = view(`
    <div class="marquee" aria-hidden="true"><div>${mq.repeat(4)}</div></div>
    <div class="wrap">
      <h1 class="logo" aria-label="Gut Check"><span class="g">Gut</span><span class="c">Check</span></h1>
      <p class="tag">12 choices. 3 seconds each.<br>How alike is your group chat, really?</p>
      <div class="meta"><span>Set <b>#${d}</b> · ${dayLabel(d)}</span><span>Streak <b>${st}</b>${st ? " 🔥" : ""}</span><span>Next <b data-cd>${countdownText()}</b></span></div>
      <div class="stack">
        ${played
          ? `<button class="btn" data-go="results">My result #${d} <span>→</span></button>
             <button class="btn alt sm" data-go="send">Send it to the chat <span>↗</span></button>`
          : `<button class="btn" data-go="play">Start #${d} <span>→</span></button>`}
        <button class="link" data-go="demo">Not sure? Watch a demo reveal between two bots</button>
      </div>
      <div class="section">
        <h2>How it works</h2>
        <ol class="how">
          <li><span>Tap fast. Top or bottom. You get 3 seconds before your gut "freezes."</span></li>
          <li><span>Get your type, then send your link to the group chat. Your answers stay hidden.</span></li>
          <li><span>When a friend plays from your link, your answers zip together. See who matches.</span></li>
        </ol>
      </div>
      <div class="section">
        <h2>Your people</h2>
        ${board.length
          ? `<ul class="board">${board.map((m) => `<li><span class="pct">${m.pct}%</span><span class="who">${esc(m.name)}${m.demo ? ' <span class="chip">demo</span>' : ""}<br><span class="d">#${m.day} · ${dayLabel(m.day)}</span></span><span class="bar-mini"><i style="width:${m.pct}%"></i></span></li>`).join("")}</ul>`
          : `<p class="empty">Nobody yet. Open a friend's link and they'll show up here, ranked by how alike your instincts are.</p>`}
      </div>
      <p class="foot">No accounts. Your results live on this device.</p>
    </div>`);
  el.querySelector("[data-cd]") && timers.push(setInterval(() => { const c = el.querySelector("[data-cd]"); if (c) c.textContent = countdownText(); }, 1000));
  el.querySelectorAll(".logo span").forEach((s) => s.addEventListener("click", () => { s.classList.remove("squish"); void s.offsetWidth; s.classList.add("squish"); buzz(10); }));
  const logo = el.querySelector(".logo");
  const tilt = (e) => {
    const x = (e.clientX / innerWidth - 0.5) * 2;
    logo.children[0].style.setProperty("--r", `${x * -3}deg`); logo.children[0].style.setProperty("--x", `${x * 10}px`);
    logo.children[1].style.setProperty("--r", `${x * 3}deg`); logo.children[1].style.setProperty("--x", `${x * -10}px`);
  };
  addEventListener("pointermove", tilt, { passive: true });
  el.addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]")?.dataset.go; if (!go) return;
    removeEventListener("pointermove", tilt);
    if (go === "play") play(d, () => results(d));
    if (go === "results") results(d);
    if (go === "send") sendSolo(d);
    if (go === "demo") reveal({ day: d, a: demoAnswers(d, 1), b: demoAnswers(d, 2), an: "Dani (bot)", bn: "Sam (bot)", demo: true });
  });
}

// ---------- PLAY ----------
function play(day, done) {
  const items = setFor(day);
  const ans = [], ms = [];
  let i = 0, t0 = 0, raf = 0, locked = true;
  stopTimers();
  app.innerHTML = `
    <div id="play" role="application" aria-label="Gut Check, set ${day}">
      <button class="door t" data-c="t"><span class="lbl">TOP · ↑</span><span class="txt"></span></button>
      <div class="seam"><span data-n>1/${COUNT}</span><span class="bar"><i></i></span><span data-s>3.0</span></div>
      <button class="door b" data-c="b"><span class="lbl">BOTTOM · ↓</span><span class="txt"></span></button>
    </div>
    <div class="count" aria-live="assertive"><span class="n">3</span><small>Gut only. No overthinking.</small></div>`;
  const root = document.getElementById("play");
  const doors = { t: root.querySelector(".door.t"), b: root.querySelector(".door.b") };
  const bar = root.querySelector(".bar"), fill = bar.firstElementChild;
  const nEl = root.querySelector("[data-n]"), sEl = root.querySelector("[data-s]");
  const size = (t) => { const L = t.length; return L <= 12 ? "min(15vw,11vh,120px)" : L <= 20 ? "min(11.5vw,8.5vh,100px)" : L <= 28 ? "min(9.2vw,6.8vh,84px)" : "min(8vw,5.8vh,72px)"; };

  function show() {
    const it = items[i];
    for (const k of ["t", "b"]) {
      const d = doors[k]; d.classList.remove("win", "lose");
      d.querySelector(".ms")?.remove();
      const tx = d.querySelector(".txt"); const text = k === "t" ? it.top : it.bot;
      tx.textContent = text; tx.style.fontSize = size(text);
      tx.classList.remove("in"); void tx.offsetWidth; tx.classList.add("in");
      d.setAttribute("aria-label", text);
    }
    nEl.textContent = `${i + 1}/${COUNT}`;
    t0 = performance.now(); locked = false;
    cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
  }
  function tick(now) {
    const left = Math.max(0, TIME_LIMIT_MS - (now - t0));
    fill.style.transform = `scaleX(${left / TIME_LIMIT_MS})`;
    bar.classList.toggle("hot", left < 1000);
    sEl.textContent = (left / 1000).toFixed(1);
    if (left <= 0) return choose("x");
    raf = requestAnimationFrame(tick);
  }
  function choose(c) {
    if (locked) return; locked = true;
    cancelAnimationFrame(raf);
    const t = Math.min(TIME_LIMIT_MS, Math.round(performance.now() - t0));
    ans.push(c); ms.push(c === "x" ? TIME_LIMIT_MS : t);
    if (c === "x") { doors.t.classList.add("lose"); doors.b.classList.add("lose"); sEl.textContent = "FROZE"; buzz([20, 40, 20]); }
    else {
      doors[c].classList.add("win"); doors[c === "t" ? "b" : "t"].classList.add("lose");
      const tag = document.createElement("span"); tag.className = "ms"; tag.textContent = secs(t); doors[c].appendChild(tag);
      buzz(12);
    }
    i++;
    setTimeout(() => (i < COUNT ? show() : finish()), reduced ? 120 : c === "x" ? 520 : 360);
  }
  function finish() {
    removeEventListener("keydown", key);
    const d = today();
    S.plays[day] = { ans: ans.join(""), ms, at: Date.now(), own: day === d };
    save();
    done();
  }
  function key(e) {
    if (e.key === "ArrowUp" || e.key === "1") { e.preventDefault(); choose("t"); }
    if (e.key === "ArrowDown" || e.key === "2") { e.preventDefault(); choose("b"); }
  }
  root.addEventListener("pointerdown", (e) => { const d = e.target.closest(".door"); if (d) { e.preventDefault(); choose(d.dataset.c); } });
  root.addEventListener("click", (e) => { const d = e.target.closest(".door"); if (d && e.detail === 0) choose(d.dataset.c); }); // keyboard Enter/Space
  addEventListener("keydown", key);

  // 3-2-1
  const cnt = app.querySelector(".count"), num = cnt.querySelector(".n");
  let n = 3;
  const step = () => {
    n--;
    if (n === 0) { cnt.remove(); show(); return; }
    num.textContent = n; num.classList.remove("n"); void num.offsetWidth; num.classList.add("n"); buzz(6);
    setTimeout(step, reduced ? 200 : 520);
  };
  setTimeout(step, reduced ? 200 : 520);
}

// ---------- RESULTS ----------
function results(day) {
  const p = S.plays[day]; if (!p) return home();
  const items = setFor(day), type = archetype(day, p.ans), avg = avgOf(p.ms);
  const froze = [...p.ans].filter((a) => a === "x").length, st = streak(S.plays, today());
  const el = view(`
    <div class="wrap">
      <span class="stamp">Gut Check #${day} · ${dayLabel(day)}</span>
      <p style="margin:18px 0 0;font-size:12px;letter-spacing:.12em;text-transform:uppercase">Your gut says you're</p>
      <h1 class="type">${esc(type.name)}</h1>
      <p class="desc">${esc(type.line)}</p>
      <div class="tiles">${items.map((it, i) => { const a = p.ans[i]; return `<div class="tile ${a}" style="animation-delay:${i * 45}ms">${a === "x" ? "Froze" : esc(a === "t" ? it.top : it.bot)}</div>`; }).join("")}</div>
      <div class="stats"><div><b>${secs(avg)}</b><span>avg gut speed</span></div><div><b>${froze}</b><span>froze</span></div><div><b>${st}</b><span>day streak</span></div></div>
      <label class="field"><span>Name on your link</span><input data-name maxlength="18" autocomplete="nickname" placeholder="Your name" value="${esc(S.name)}"></label>
      <div class="stack">
        <button class="btn" data-go="send">Send to the chat <span>↗</span></button>
        <div class="row"><button class="btn alt sm" data-go="card">Save card</button><button class="btn alt sm" data-go="demo">Demo match</button></div>
        <button class="link" data-go="home">← Home · next set in <span data-cd>${countdownText()}</span></button>
      </div>
    </div>`);
  timers.push(setInterval(() => { const c = el.querySelector("[data-cd]"); if (c) c.textContent = countdownText(); }, 1000));
  const input = el.querySelector("[data-name]");
  input.addEventListener("input", () => { S.name = input.value.trim().slice(0, 18); save(); });
  el.addEventListener("click", async (e) => {
    const go = e.target.closest("[data-go]")?.dataset.go; if (!go) return;
    if (go === "send") sendSolo(day);
    if (go === "home") home();
    if (go === "demo") reveal({ day, a: p.ans, b: demoAnswers(day, 3), an: myName(), bn: "Demo bot", demo: true });
    if (go === "card") shareImage(await soloCard({ label: `GUT CHECK #${day} · ${dayLabel(day)}`, type: type.name, line: type.line, items, ans: p.ans, avg: secs(avg), url: SHORT }), `gutcheck-${day}.png`);
  });
}

function sendSolo(day) {
  const p = S.plays[day]; if (!p) return;
  const type = archetype(day, p.ans);
  shareText(`GUT CHECK #${day}\nI'm "${type.name}" · ${secs(avgOf(p.ms))} avg\n${emojiStrip(p.ans)}\nCan your gut match mine? ${linkFor(day)}`);
}

// ---------- CHALLENGE INTRO ----------
function intro(c) {
  const el = view(`
    <div class="marquee" aria-hidden="true"><div>${"YOU'VE BEEN GUT CHECKED ✦ ".repeat(10)}</div></div>
    <div class="wrap">
      <span class="stamp">Gut Check #${c.day} · ${dayLabel(c.day)}</span>
      <h1 class="invite"><em>${esc(c.name)}</em> wants to know if your gut matches theirs.</h1>
      <p class="tag" style="font-size:24px">12 choices, 3 seconds each. Their answers stay hidden until you finish.</p>
      <label class="field"><span>Your name (so they know who matched)</span><input data-name maxlength="18" autocomplete="nickname" placeholder="Your name" value="${esc(S.name)}"></label>
      <div class="stack"><button class="btn" data-go="play">Play <span>→</span></button></div>
      <p class="foot">No signup. Takes about 40 seconds.</p>
    </div>`);
  const input = el.querySelector("[data-name]");
  input.addEventListener("input", () => { S.name = input.value.trim().slice(0, 18); save(); });
  el.querySelector("[data-go=play]").addEventListener("click", () => {
    play(c.day, () => reveal({ day: c.day, a: S.plays[c.day].ans, b: c.ans, an: myName(), bn: c.name, demo: false }));
  });
}

// ---------- REVEAL (signature zipper) ----------
function reveal({ day, a, b, an, bn, demo }) {
  const items = setFor(day), cmp = compare(a, b), v = verdict(cmp.pct);
  if (!demo || an !== "Dani (bot)") {
    S.matches[`${bn}|${day}`] = { name: bn, day, pct: cmp.pct, at: Date.now(), demo };
    save();
  }
  const txt = (it, x) => (x === "x" ? "Froze" : esc(x === "t" ? it.top : it.bot));
  const el = view(`
    <div class="wrap">
      <span class="stamp">Gut Check #${day} · ${dayLabel(day)}</span> ${demo ? '<span class="chip">Demo</span>' : ""}
      <h1 class="vs">${esc(an)} <span class="x">×</span> ${esc(bn)}</h1>
      <div class="zhead"><span>${esc(an)}</span><span>${esc(bn)}</span></div>
      <div class="zip">${items.map((it, i) => `<div class="zr" data-m="${cmp.rows[i] ? 1 : 0}"><div class="zt l ${a[i]}">${txt(it, a[i])}</div><div class="zt r ${b[i]}">${txt(it, b[i])}</div></div>`).join("")}</div>
      <div class="score" aria-label="${cmp.pct} percent"><span data-pct>0</span><sup>%</sup></div>
      <p class="verdict" data-v></p>
      <div class="after">
        <div class="stack">
          ${demo
            ? (S.plays[today()] ? `<button class="btn" data-go="send">Send mine to the chat <span>↗</span></button>` : `<button class="btn" data-go="play">Play #${today()} for real <span>→</span></button>`)
            : `<button class="btn" data-go="back">Send yours back <span>↗</span></button>`}
          <div class="row"><button class="btn alt sm" data-go="card">Save card</button><button class="btn alt sm" data-go="mine">My type</button></div>
          <button class="link" data-go="home">← Home</button>
        </div>
      </div>
    </div>`);
  const rows = [...el.querySelectorAll(".zr")];
  const base = reduced ? 0 : 250, stepMs = reduced ? 0 : 120;
  rows.forEach((row, i) => {
    const m = row.dataset.m === "1", [L, R] = row.children, delay = base + i * stepMs;
    const end = (dir) => (m ? "translateX(0) rotate(0)" : `translateX(${dir * 12}px) rotate(${dir * 2}deg)`);
    const opts = { duration: reduced ? 1 : 520, delay, easing: "cubic-bezier(.2,.9,.3,1)", fill: "forwards" };
    L.animate([{ transform: "translateX(-105%)", opacity: 0 }, { transform: "translateX(0)", opacity: 1, offset: 0.7 }, { transform: end(-1), opacity: 1 }], opts);
    R.animate([{ transform: "translateX(105%)", opacity: 0 }, { transform: "translateX(0)", opacity: 1, offset: 0.7 }, { transform: end(1), opacity: 1 }], opts);
    setTimeout(() => { row.classList.add(m ? "m" : "s"); buzz(m ? 14 : 4); }, delay + (reduced ? 0 : 380));
  });
  const total = base + rows.length * stepMs + (reduced ? 0 : 500);
  setTimeout(() => {
    const pEl = el.querySelector("[data-pct]"), t0 = performance.now(), dur = reduced ? 1 : 800;
    const run = (now) => { const k = Math.min(1, (now - t0) / dur); pEl.textContent = Math.round(cmp.pct * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(run); else { el.querySelector("[data-v]").textContent = v; el.querySelector(".after").classList.add("on"); buzz([10, 30, 10]); } };
    requestAnimationFrame(run);
  }, total);
  history.replaceState(null, "", BASE);
  el.addEventListener("click", async (e) => {
    const go = e.target.closest("[data-go]")?.dataset.go; if (!go) return;
    if (go === "home") home();
    if (go === "mine") S.plays[day] ? results(day) : play(day, () => results(day));
    if (go === "play") play(today(), () => results(today()));
    if (go === "send") sendSolo(today());
    if (go === "back") shareText(`GUT CHECK #${day}: ${an} × ${bn} = ${cmp.pct}%\n${matchStrip(cmp.rows)}\n"${v}"\nYour turn: ${linkFor(day)}`);
    if (go === "card") shareImage(await matchCard({ label: `GUT CHECK #${day} · ${dayLabel(day)}${demo ? " · DEMO" : ""}`, a: an, b: bn, pct: cmp.pct, verdict: v, rows: cmp.rows, url: SHORT }), `gutcheck-${day}-match.png`);
  });
}

// ---------- ROUTER ----------
function boot() {
  const c = location.hash.length > 1 ? decode(location.hash) : null;
  if (!c) { if (location.hash.length > 1) history.replaceState(null, "", BASE); return home(); }
  const mine = S.plays[c.day];
  if (mine) {
    if (mine.ans === c.ans && (!S.name || S.name === c.name)) { history.replaceState(null, "", BASE); toast("That's your own link. Send it to the chat."); return results(c.day); }
    return reveal({ day: c.day, a: mine.ans, b: c.ans, an: myName(), bn: c.name, demo: false });
  }
  intro(c);
}
addEventListener("hashchange", boot);
boot();

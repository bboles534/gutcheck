// Renders a 1080x1350 shareable PNG card on a canvas.
const W = 1080, H = 1350, PAD = 64;
const COL = { ink: "#121110", paper: "#f2ece1", t: "#ff5216", b: "#2747ff", x: "#8f8a80", acid: "#d7ff2e" };

function wrap(ctx, text, maxW) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

async function fonts() {
  try {
    await Promise.all([
      document.fonts.load("100px Anton"),
      document.fonts.load("italic 50px 'Instrument Serif'"),
      document.fonts.load("700 30px 'Space Mono'"),
    ]);
  } catch { /* fall back to system fonts */ }
}

function header(ctx, label) {
  ctx.fillStyle = COL.ink; ctx.fillRect(0, 0, W, 110);
  ctx.fillStyle = COL.acid; ctx.font = "700 30px 'Space Mono', monospace";
  ctx.textBaseline = "middle"; ctx.fillText(label, PAD, 56);
  ctx.textBaseline = "alphabetic";
}

function footer(ctx, url) {
  ctx.fillStyle = COL.ink; ctx.fillRect(0, H - 96, W, 96);
  ctx.fillStyle = COL.paper; ctx.font = "700 28px 'Space Mono', monospace";
  ctx.textBaseline = "middle"; ctx.fillText(url, PAD, H - 48);
  ctx.fillStyle = COL.t; ctx.fillRect(W - PAD - 72, H - 66, 72, 18);
  ctx.fillStyle = COL.b; ctx.fillRect(W - PAD - 72, H - 48, 72, 18);
  ctx.textBaseline = "alphabetic";
}

export async function soloCard({ label, type, line, items, ans, avg, url }) {
  await fonts();
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = COL.paper; ctx.fillRect(0, 0, W, H);
  header(ctx, label);
  ctx.fillStyle = COL.ink; ctx.font = "150px Anton, Impact, sans-serif";
  let y = 270;
  for (const l of wrap(ctx, type.toUpperCase(), W - PAD * 2)) { ctx.fillText(l, PAD, y); y += 142; }
  ctx.font = "italic 50px 'Instrument Serif', Georgia, serif";
  y += 4;
  for (const l of wrap(ctx, line, W - PAD * 2)) { ctx.fillText(l, PAD, y); y += 54; }
  // 3x4 tile grid
  const gap = 12, cols = 3, tw = (W - PAD * 2 - gap * (cols - 1)) / cols, th = 118;
  const top = Math.max(y + 24, H - 96 - 48 - (th * 4 + gap * 3) - 70);
  items.forEach((it, i) => {
    const a = ans[i];
    const x = PAD + (i % cols) * (tw + gap), yy = top + Math.floor(i / cols) * (th + gap);
    ctx.fillStyle = COL[a]; ctx.fillRect(x, yy, tw, th);
    ctx.fillStyle = "#fff"; ctx.font = "30px Anton, Impact, sans-serif";
    const txt = a === "x" ? "FROZE" : (a === "t" ? it.top : it.bot).toUpperCase();
    const ls = wrap(ctx, txt, tw - 28).slice(0, 3);
    ls.forEach((l, j) => ctx.fillText(l, x + 14, yy + th - 14 - (ls.length - 1 - j) * 32));
  });
  ctx.fillStyle = COL.ink; ctx.font = "700 30px 'Space Mono', monospace";
  ctx.fillText(`AVG ${avg}  ·  CAN YOUR GUT MATCH MINE?`, PAD, H - 96 - 34);
  footer(ctx, url);
  return new Promise((r) => c.toBlob(r, "image/png"));
}

export async function matchCard({ label, a, b, pct, verdict, rows, url }) {
  await fonts();
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = COL.paper; ctx.fillRect(0, 0, W, H);
  header(ctx, label);
  ctx.fillStyle = COL.ink; ctx.font = "110px Anton, Impact, sans-serif";
  let y = 250;
  for (const l of wrap(ctx, `${a} × ${b}`.toUpperCase(), W - PAD * 2).slice(0, 2)) { ctx.fillText(l, PAD, y); y += 108; }
  ctx.font = "460px Anton, Impact, sans-serif";
  ctx.fillStyle = COL.t; ctx.fillText(`${pct}`, PAD - 8, y + 390);
  const w = ctx.measureText(`${pct}`).width;
  ctx.fillStyle = COL.b; ctx.font = "170px Anton, Impact, sans-serif"; ctx.fillText("%", PAD + w, y + 210);
  ctx.fillStyle = COL.ink; ctx.font = "italic 60px 'Instrument Serif', Georgia, serif";
  let vy = y + 480;
  for (const l of wrap(ctx, verdict, W - PAD * 2)) { ctx.fillText(l, PAD, vy); vy += 62; }
  const gap = 10, cw = (W - PAD * 2 - gap * 11) / 12;
  rows.forEach((m, i) => {
    ctx.fillStyle = m ? COL.acid : COL.ink;
    ctx.fillRect(PAD + i * (cw + gap), H - 96 - 60 - 70, cw, 70);
  });
  footer(ctx, url);
  return new Promise((r) => c.toBlob(r, "image/png"));
}

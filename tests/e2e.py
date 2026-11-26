"""End-to-end test: two separate browser sessions (two "friends") on a phone viewport.

Usage:  python3 tests/e2e.py [base_url]
Default base_url starts a local static server on :8099.
"""
import re, subprocess, sys, time, os
from playwright.sync_api import sync_playwright, expect

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = sys.argv[1] if len(sys.argv) > 1 else None
SHOTS = os.environ.get("SHOTS", "")
server = None
if not BASE:
    server = subprocess.Popen([sys.executable, "-m", "http.server", "8099"], cwd=ROOT,
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    BASE = "http://localhost:8099/"

PHONE = dict(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)


def shot(page, name):
    if SHOTS:
        page.screenshot(path=os.path.join(SHOTS, name + ".png"))


def play_round(page, pattern):
    """Answer 12 doors. pattern chars: t/b = tap, x = let timer run out."""
    page.wait_for_selector(".count", state="detached", timeout=6000)
    for i, c in enumerate(pattern):
        expect(page.locator("[data-n]")).to_have_text(f"{i + 1}/12", timeout=5000)
        if i == 3:
            shot(page, "02-play")
        if c == "x":
            page.wait_for_timeout(3200)
        else:
            page.locator(f".door.{c}").dispatch_event("pointerdown")
            page.wait_for_timeout(420)


errors = []
try:
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # --- Friend A: fresh session, plays solo, grabs share link ---
        a = browser.new_context(**PHONE, permissions=["clipboard-read", "clipboard-write"])
        pa = a.new_page()
        pa.on("pageerror", lambda e: errors.append(f"A: {e}"))
        pa.goto(BASE)
        expect(pa.locator(".logo")).to_be_visible()
        shot(pa, "01-home")
        # demo reveal works before playing
        pa.get_by_text("Watch a demo reveal").click()
        expect(pa.locator(".chip", has_text="Demo")).to_be_visible()
        expect(pa.locator("[data-v]")).not_to_be_empty(timeout=6000)
        pa.get_by_text("← Home").click()

        pa.get_by_role("button", name=re.compile("Start #")).click()
        play_round(pa, "tbtbttbxtbbt")
        expect(pa.locator(".type")).to_be_visible()
        assert pa.locator(".tile").count() == 12
        assert pa.locator(".tile.x").count() == 1
        pa.fill("[data-name]", "Maya")
        shot(pa, "03-results")
        pa.get_by_role("button", name=re.compile("Send to the chat")).click()
        pa.wait_for_timeout(300)
        text = pa.evaluate("navigator.clipboard.readText()")
        assert "GUT CHECK #" in text and "#v1." in text, text
        link = re.search(r"(https?://\S+#v1\.\S+)", text).group(1)
        print("share text:\n" + text)

        # persistence: reload shows "My result"
        pa.reload()
        expect(pa.get_by_role("button", name=re.compile("My result"))).to_be_visible()

        # own link → recognized
        pa.goto(link)
        expect(pa.locator(".type")).to_be_visible()

        # --- Friend B: brand-new session opens A's link ---
        b = browser.new_context(**PHONE, permissions=["clipboard-read", "clipboard-write"])
        pb = b.new_page()
        pb.on("pageerror", lambda e: errors.append(f"B: {e}"))
        pb.goto(link)
        expect(pb.locator(".invite")).to_contain_text("Maya")
        shot(pb, "04-invite")
        pb.fill("[data-name]", "Jordan")
        pb.get_by_role("button", name=re.compile("Play")).click()
        play_round(pb, "tbtbttbbbbbb")
        expect(pb.locator(".vs")).to_contain_text("Jordan")
        expect(pb.locator(".vs")).to_contain_text("Maya")
        expect(pb.locator("[data-v]")).not_to_be_empty(timeout=6000)
        pct = int(pb.locator("[data-pct]").inner_text())
        # A: tbtbttbxtbbt  B: tbtbttbbbbbb → same at 0-6, 9, 10 → 9/12
        assert pct == 75, pct
        assert pb.locator(".zr.m").count() == 9
        shot(pb, "05-reveal")
        pb.get_by_role("button", name=re.compile("Send yours back")).click()
        pb.wait_for_timeout(300)
        back = pb.evaluate("navigator.clipboard.readText()")
        assert "75%" in back, back
        link_b = re.search(r"(https?://\S+#v1\.\S+)", back).group(1)
        pb.get_by_text("← Home").click()
        expect(pb.locator(".board")).to_contain_text("Maya")

        # --- A opens B's reply → instant reveal, no replay ---
        pa.goto(link_b)
        expect(pa.locator(".vs")).to_contain_text("Jordan")
        expect(pa.locator("[data-v]")).not_to_be_empty(timeout=6000)
        assert int(pa.locator("[data-pct]").inner_text()) == 75

        # garbage hash falls back to home
        pa.goto(BASE + "#v1.nope")
        expect(pa.locator(".logo")).to_be_visible()

        browser.close()
    assert not errors, errors
    print("E2E PASS")
finally:
    if server:
        server.terminate()

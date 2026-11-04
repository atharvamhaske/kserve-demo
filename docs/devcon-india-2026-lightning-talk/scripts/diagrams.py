"""Write slides 2 to 7 as Excalidraw scenes: the speaker intro and the diagrams.

The scenes follow the excalidraw-diagram-generator skill (github/awesome-copilot):
Excalifont (fontFamily 5) for every text element, arrows bound to the shapes they
connect, and the official Kubernetes icons and project logos embedded as image
elements. Each scene uses slide coordinates (1920x1080). An invisible frame fixes
the export bounds, so the rendered SVG drops straight onto the slide.

Usage (from the deck folder): python3 scripts/diagrams.py
Then render them with: node scripts/render_diagrams.js
"""

from __future__ import annotations

import base64
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "src" / "assets"
OUT = ROOT / "src" / "diagrams"

INK, VIO, SOFT, TXT, MUTED = "#5B21B6", "#7C3AED", "#C4B5FD", "#1E1B2E", "#5E5A75"
PAPER, TINT, CLUSTER = "#FFFFFF", "#EDE9FE", "#8B7FC0"
CHAR = 0.56  # average Excalifont glyph width, as a share of the font size


class Scene:
    def __init__(self, n: int):
        self.n, self.els, self.files, self.seed = n, [], {}, n * 1000
        # Invisible frame: fixes the exported SVG to the full 1920x1080 slide.
        self._base("rectangle", 0, 0, 1920, 1080, strokeColor="transparent", backgroundColor="transparent")

    # -- element factory -------------------------------------------------
    def _base(self, kind, x, y, w, h, **kw):
        self.seed += 1
        el = {
            "id": f"s{self.n}-{kind}-{len(self.els)}", "type": kind,
            "x": round(x, 1), "y": round(y, 1), "width": round(w, 1), "height": round(h, 1), "angle": 0,
            "strokeColor": INK, "backgroundColor": "transparent", "fillStyle": "solid",
            "strokeWidth": 2, "strokeStyle": "solid", "roughness": 1, "opacity": 100,
            "groupIds": [], "frameId": None, "roundness": None, "seed": self.seed,
            "version": 1, "versionNonce": self.seed * 7, "isDeleted": False,
            "boundElements": [], "updated": 1, "link": None, "locked": False,
        }
        el.update(kw)
        self.els.append(el)
        return el

    def rect(self, x, y, w, h, stroke=INK, fill=PAPER, sw=2, dashed=False, rounded=True):
        return self._base("rectangle", x, y, w, h, strokeColor=stroke, backgroundColor=fill, strokeWidth=sw,
                          strokeStyle="dashed" if dashed else "solid", roundness={"type": 3} if rounded else None)

    def ellipse(self, x, y, w, h, stroke=INK, fill=PAPER, sw=2):
        return self._base("ellipse", x, y, w, h, strokeColor=stroke, backgroundColor=fill, strokeWidth=sw)

    def text(self, x, y, w, txt, size=24, color=TXT, align="left", container=None):
        lines = txt.split("\n")
        el = self._base("text", x, y, w, len(lines) * size * 1.25, strokeColor=color,
                        text=txt, originalText=txt, fontSize=size, fontFamily=5, textAlign=align,
                        verticalAlign="middle" if container else "top",
                        containerId=container["id"] if container else None, autoResize=True, lineHeight=1.25)
        if container:
            container["boundElements"].append({"type": "text", "id": el["id"]})
        return el

    def center(self, cx, y, txt, size=24, color=TXT):
        w = max(len(l) for l in txt.split("\n")) * size * CHAR + 20
        return self.text(cx - w / 2, y, w, txt, size, color, "center")

    def label(self, box, txt, size=24, color=TXT):
        """Text bound to its container, centred in it."""
        lines = txt.count("\n") + 1
        h = lines * size * 1.25
        return self.text(box["x"] + 8, box["y"] + (box["height"] - h) / 2, box["width"] - 16, txt, size, color,
                         "center", container=box)

    def _path(self, kind, pts, stroke, sw, dashed, curved, **kw):
        x0, y0 = pts[0]
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        return self._base(kind, x0, y0, max(xs) - min(xs), max(ys) - min(ys), strokeColor=stroke, strokeWidth=sw,
                          strokeStyle="dashed" if dashed else "solid", roundness={"type": 2} if curved else None,
                          points=[[round(px - x0, 1), round(py - y0, 1)] for px, py in pts], **kw)

    def line(self, pts, stroke=INK, sw=2, dashed=False, curved=False, fill="transparent"):
        return self._path("line", pts, stroke, sw, dashed, curved, backgroundColor=fill,
                          startArrowhead=None, endArrowhead=None, polygon=fill != "transparent")

    def arrow(self, pts, start=None, end=None, stroke=INK, sw=2, dashed=False, curved=False):
        el = self._path("arrow", pts, stroke, sw, dashed, curved, startArrowhead=None, endArrowhead="arrow",
                        startBinding={"elementId": start["id"], "focus": 0, "gap": 6} if start else None,
                        endBinding={"elementId": end["id"], "focus": 0, "gap": 6} if end else None,
                        elbowed=False)
        for target in (start, end):
            if target is not None:
                target["boundElements"].append({"type": "arrow", "id": el["id"]})
        return el

    def image(self, rel, x, y, w, h):
        path = ASSETS / rel
        data = path.read_bytes()
        mime = {".svg": "image/svg+xml", ".png": "image/png"}[path.suffix]
        fid = hashlib.sha1(data).hexdigest()
        self.files[fid] = {"id": fid, "mimeType": mime, "created": 1,
                           "dataURL": f"data:{mime};base64," + base64.b64encode(data).decode()}
        return self._base("image", x, y, w, h, strokeColor="transparent", fileId=fid, status="saved",
                          scale=[1, 1], crop=None)

    def save(self):
        for el in self.els:
            if not el["boundElements"]:
                el["boundElements"] = None
        OUT.mkdir(parents=True, exist_ok=True)
        path = OUT / f"slide-{self.n:02d}.excalidraw"
        path.write_text(json.dumps({"type": "excalidraw", "version": 2, "source": "https://excalidraw.com",
                                    "elements": self.els, "appState": {"viewBackgroundColor": "#F4F2FF", "gridSize": 20},
                                    "files": self.files}, indent=1))
        print("wrote", path.relative_to(ROOT), len(self.els), "elements")

    # -- small shared pieces --------------------------------------------
    def badge(self, cx, cy, n):
        b = self.ellipse(cx - 24, cy - 24, 48, 48, stroke=INK, fill=VIO)
        self.label(b, str(n), 24, PAPER)

    def fork(self, cx, cy, k=1.0):
        """Model routing doodle: one request in, several model backends out."""
        P = lambda dx, dy: (cx + dx * k, cy + dy * k)
        self.line([P(-50, 0), P(-8, 0)], sw=2.5)
        self.arrow([P(-8, 0), P(46, -28)], sw=2.5)
        self.arrow([P(-8, 0), P(46, 28)], sw=2.5)
        self.arrow([P(-8, 0), P(46, 0)], stroke=SOFT, sw=2.5)
        d = 14 * max(k, .8)
        self.ellipse(cx - 8 * k - d / 2, cy - d / 2, d, d, fill=VIO)

    def underline(self, x1, x2, y):
        self.line([(x1, y), ((x1 + x2) / 2, y + 6), (x2, y - 2)], stroke=VIO, sw=4, curved=True)


# ---- the request path, shared by slides 3 and 4 -------------------------
PX, PY, PW, PH = [135, 480, 825, 1170, 1515], 480, 270, 200,
MID, LANE = PY + 100, 742
PC = [x + PW / 2 for x in PX]
GX = (PX[3] + PW + PX[4]) / 2  # the gap between the proxy and the Pod


def request_path(s: Scene, broken=False):
    hot = {2, 3} if broken else set()
    boxes = [s.rect(x, PY, PW, PH, stroke=VIO if i in hot else INK, sw=3.5 if i in hot else 2) for i, x in enumerate(PX)]
    for i, x in enumerate(PX):
        s.badge(x + 6, PY + 6, i + 1)

    s.image("k8s/user.svg", PC[0] - 40, PY + 22, 80, 80)
    s.image("k8s/svc.svg", PC[1] - 40, PY + 22, 80, 80)
    s.image("k8s/ing.svg", PC[2] - 40, PY + 22, 80, 80)
    s.fork(PC[3] - 4, PY + 62)
    s.image("logos/vllm.png", PX[4] + 26, PY + 36, 112, 32)
    s.center(PX[4] + 82, PY + 74, "GPU", 18, VIO)
    s.image("logos/ollama.png", PX[4] + 180, PY + 20, 40, 56)
    s.center(PX[4] + 200, PY + 74, "CPU", 18, VIO)
    s.image("k8s/pod.svg", PX[4] + PW - 36, PY - 26, 60, 60)

    labels = [("Client", "your app or SDK"), ("DNS + Service", "ClusterIP / LB"), ("Gateway", "HTTPRoute, timeouts"),
              ("Model proxy", "routes by model name"), ("Model Pod", "load, infer, stream")]
    for i, (a, b) in enumerate(labels):
        s.center(PC[i], PY + 112, a, 28)
        s.center(PC[i], PY + 152, b, 20, MUTED)

    for i in range(4):
        cold = broken and i == 3
        s.arrow([(PX[i] + PW + 6, MID), (PX[i + 1] - 6, MID)], boxes[i], boxes[i + 1],
                stroke=VIO if cold else INK, sw=3 if cold else 2, dashed=cold)
    return boxes


def whoami():
    """Slide 2, the speaker intro, after the speaker's own Excalidraw mock.

    Only the drawing lives in the scene (logo, underline, bullet dots, photo frame).
    The text is set in Poppins in slides.html, to match the title slide.
    """
    s = Scene(2)
    s.image("brand/devcon-viii-logo.png", 44, 24, 154, 70)
    s.line([(76, 316), (390, 321), (702, 310)], stroke=INK, sw=3, curved=True)
    for i in range(4):
        y = 382 + i * 130
        s.ellipse(91, y + 16, 22, 22, stroke=INK, fill=INK)
    # the photo in a double hand-drawn frame
    s.rect(1182, 182, 680, 766, stroke=MUTED, fill="transparent", sw=1.5)
    s.rect(1170, 170, 690, 770, stroke=TXT, fill=PAPER, sw=2.5)
    s.image("brand/speaker-cutout.png", 1274, 186, 482, 745)
    s.save()


def problem():
    s = Scene(3)
    app = s.rect(150, 560, 280, 220)
    s.image("k8s/user.svg", 250, 580, 80, 80)
    s.center(290, 676, "Your app", 28)
    s.center(290, 720, "POST /v1/chat/completions", 18, MUTED)

    k8s = s.rect(560, 470, 700, 440, stroke=CLUSTER, fill="transparent", dashed=True)
    s.image("logos/k8s.svg", 588, 494, 60, 60)
    s.text(662, 506, 400, "Kubernetes", 30)
    s.arrow([(436, 670), (554, 670)], app, k8s, sw=2.5)
    s.center(910, 560, "?", 190, VIO)
    s.center(910, 820, "DNS, gateway, proxy, autoscaler, Pod", 22, MUTED)

    for i, (code, desc) in enumerate([("404", "not found"), ("hang", "no reply"), ("504", "gateway timeout"),
                                      ("429", "too many requests")]):
        y = 470 + i * 114
        box = s.rect(1390, y, 420, 92, stroke=VIO, sw=2.5)
        s.text(1414, y + 24, 120, code, 38, VIO)
        s.text(1540, y + 30, 260, desc, 26)
        s.arrow([(1266, 690), (1322, 690 + (y + 46 - 690) * 0.6), (1384, y + 46)], k8s, box,
                stroke=VIO, curved=True)
    s.center(960, 944, "Teams debug the symptom because they never mapped the path.", 40, INK)
    s.save()


def path():
    s = Scene(4)
    boxes = request_path(s)
    s.image("k8s/hpa.svg", GX - 30, 380, 60, 60)
    s.center(GX, 440, "scale from zero", 20, VIO)
    s.line([(GX, 504), (GX, MID - 12)], stroke=VIO, dashed=True)

    s.arrow([(PC[4], PY + PH + 6), (PC[4], LANE), (PC[0], LANE), (PC[0], PY + PH + 6)], boxes[4], boxes[0],
            stroke=VIO, dashed=True)
    s.center(960, LANE + 10, "tokens stream back (SSE)", 22, INK)
    s.center(960, 808, "It's never one Pod.", 68, INK)
    s.underline(680, 1240, 902)
    s.save()


def breaks():
    s = Scene(5)
    boxes = request_path(s, broken=True)
    # the return stream, cut at the gateway
    s.line([(PC[4], PY + PH + 6), (PC[4], LANE), (PC[2] + 34, LANE)], stroke=VIO, dashed=True)
    s.arrow([(PC[2] - 34, LANE), (PC[0], LANE), (PC[0], PY + PH + 6)], end=boxes[0], stroke=VIO, dashed=True)
    for dx in (-10, 8):
        s.line([(PC[2] + dx - 6, LANE + 16), (PC[2] + dx + 6, LANE - 16)], stroke=VIO, sw=3)

    def note(cx, y, txt, to, up):
        s.center(cx, y, txt, 26, VIO)
        y0 = y + 40 if up else y - 6
        s.arrow([(cx, y0), to], stroke=VIO, sw=2)

    note(960, 396, "404 · wrong API path", (960, PY - 6), True)
    note(GX, 396, "hang · cold model wakes up", (GX, MID - 14), True)
    note(880, 800, "504 · timeout kills the stream", (950, LANE + 22), False)
    note(1400, 800, "429 · ignores token cost", (1305, PY + PH + 6), False)
    s.text(135, 806, 520, "Every one of these looks like", 30)
    s.text(135, 848, 520, '"the model is broken."', 34, INK)
    s.save()


def openeverest():
    s = Scene(6)
    Y, H = 470, 200
    M = Y + H / 2
    you = s.ellipse(112, M - 75, 164, 150)
    s.center(194, M - 44, "You", 32)
    s.center(194, M + 2, "UI · API\nkubectl", 20, MUTED)

    B = [(362, 230), (646, 238), (1000, 272), (1324, 190)]
    boxes = [s.rect(x, Y, w, H) for x, w in B]
    for x, _ in B:
        s.badge(x + 6, Y + 6, B.index((x, _)) + 1)
    cx = [x + w / 2 for x, w in B]

    s.image("logos/oe-icon-full-color-dark.svg", cx[0] - 40, Y + 18, 80, 80)
    s.center(cx[0], Y + 110, "Instance", 28)
    s.center(cx[0], Y + 150, "core.openeverest.io", 18, INK)

    pts = [(cx[1] + 34 * math.cos(math.radians(a)), Y + 60 + 34 * math.sin(math.radians(a))) for a in range(30, 331, 30)]
    s.arrow(pts, stroke=INK, sw=3, curved=True)
    s.image("logos/oe-icon-full-color-dark.svg", cx[1] - 20, Y + 40, 40, 40)
    s.center(cx[1], Y + 110, "provider-kserve", 27)
    s.center(cx[1], Y + 150, "reconciles", 20, MUTED)

    s.image("logos/kserve-logo.png", cx[2] - 38, Y + 16, 76, 76)
    s.center(cx[2], Y + 100, "LLMInferenceService", 25)
    s.center(cx[2], Y + 136, "or InferenceService", 19, MUTED)
    s.center(cx[2], Y + 162, "serving.kserve.io", 19, INK)

    gear = []
    for k in range(16):
        a, r = k / 16 * 2 * math.pi, 34 if k % 2 == 0 else 26
        gear += [(cx[3] + r * math.cos(a - .1), Y + 58 + r * math.sin(a - .1)),
                 (cx[3] + r * math.cos(a + .1), Y + 58 + r * math.sin(a + .1))]
    s.line(gear + [gear[0]], sw=2.5, fill=SOFT)
    s.ellipse(cx[3] - 11, Y + 47, 22, 22)
    s.center(cx[3], Y + 104, "KServe\ncontrollers", 26)

    RX, RW = 1566, 210
    s.rect(RX + 24, Y - 24, RW, H, stroke=SOFT)
    s.rect(RX + 12, Y - 12, RW, H, stroke=SOFT)
    res = s.rect(RX, Y, RW, H)
    for r, (ic, lb) in enumerate([("deploy", "Deployments"), ("hpa", "HPAs"), ("svc", "Services"), ("ing", "Routes")]):
        y = Y + 14 + r * 44
        s.image(f"k8s/{ic}.svg", RX + 14, y, 40, 40)
        s.text(RX + 62, y + 7, 140, lb, 21)

    s.arrow([(282, M), (B[0][0] - 6, M)], you, boxes[0])
    s.center(319, M - 36, "creates", 18, VIO)
    for i in range(3):
        s.arrow([(B[i][0] + B[i][1] + 6, M), (B[i + 1][0] - 6, M)], boxes[i], boxes[i + 1])
    s.center(942, M - 58, "reconciles\ninto", 18, VIO)
    s.arrow([(B[3][0] + B[3][1] + 6, M), (RX - 6, M)], boxes[3], res)

    lane = 734
    s.arrow([(cx[1], Y + H + 6), (cx[1], lane), (cx[0], lane), (cx[0], Y + H + 6)], boxes[1], boxes[0],
            stroke=VIO, dashed=True)
    chip = s.rect((cx[0] + cx[1]) / 2 - 120, lane - 21, 240, 42, stroke=VIO)
    s.label(chip, "status, endpoints", 20, INK)
    ready = s.rect(362, 778, 520, 50, stroke=INK, fill=TINT)
    s.line([(384, 803), (394, 814), (414, 790)], stroke=VIO, sw=4)
    s.text(428, 788, 440, "Ready · https://qwen-demo…/v1", 22)
    s.center(960, 850, "Declare intent. Get an endpoint back.", 58, INK)
    s.underline(1070, 1520, 930)
    s.save()


def stacks():
    s = Scene(7)
    top, hh, rh, L, R, COL = 376, 84, 90, 112, 1810, [480, 940, 1400]
    bottom = top + hh + rh * 4
    s.rect(L, top, R - L, bottom - top, fill=PAPER)
    s.line([(L + 6, top + hh), (R - 6, top + hh)], sw=2.5)
    for r in range(1, 4):
        s.line([(L + 14, top + hh + r * rh), (R - 14, top + hh + r * rh)], stroke=SOFT)
    for x in COL:
        s.line([(x, top + 10), (x, bottom - 10)], stroke=SOFT)

    s.image("logos/kserve-logo.png", 612, top + 16, 52, 52)
    s.text(676, top + 22, 220, "KServe", 32)
    s.center(1170, top + 22, "KubeAI", 32)
    s.image("logos/k8s.svg", 1482, top + 18, 48, 48)
    s.text(1540, top + 22, 260, "Hand-rolled", 32)

    rows = [
        ("ing", "Gateway", ["Envoy AI Gateway", "Ingress to KubeAI", "ingress-nginx"]),
        ("fork", "Model routing", ["InferencePool +\nendpoint picker", "proxy reads the\nmodel field", "one path per model"]),
        ("hpa", "Scale from zero", ["Knative or KEDA", "built in, to zero", "HPA, min 1 replica"]),
        ("pod", "Model Pod", ["vLLM runtime", "vLLM or Ollama", "vLLM Deployment"]),
    ]
    for r, (ic, hop, cells) in enumerate(rows):
        y = top + hh + r * rh
        if ic == "fork":
            s.fork(L + 49, y + rh / 2, 0.62)
        else:
            s.image(f"k8s/{ic}.svg", L + 22, y + 18, 54, 54)
        s.text(L + 96, y + 27, 270, hop, 27)
        for k, t in enumerate(cells):
            x0, x1 = COL[k], COL[k + 1] if k < 2 else R
            lines = t.count("\n") + 1
            s.center((x0 + x1) / 2, y + rh / 2 - lines * 24 * 1.25 / 2, t, 24)
    s.center(960, 862, "Map the path, not the brand.", 58, INK)
    s.save()


if __name__ == "__main__":
    for f in (whoami, problem, path, breaks, openeverest, stacks):
        f()

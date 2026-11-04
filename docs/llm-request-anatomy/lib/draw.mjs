// Drawing recipes shared by the three figures. Every function takes the kit
// (`k`) and the projection (`P`) and returns SVG strings, so the same code runs
// in the build (Node) and in the page (inlined, with `k` built from the kit's
// globals). Nothing here keeps state.

const TAU = Math.PI * 2;

const byDepth = (k, P, points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const centreOf = (plan, z = 0) => [plan.x + plan.w / 2, plan.y + plan.d / 2, z];

// A base plate on four feet, with a groove, corner screws, a ruler strip along
// the front and a label plate: the bench everything else stands on.
function basePlate(k, P, plan, { h = 12, footH = 5, strip = true, label = null } = {}) {
  const out = [`<path class="iso-halo" d="${k.haloOf(plan, -h - footH, h, P)}"/>`];
  for (const [x, y] of byDepth(k, P, k.corners(plan, 22))) {
    out.push(k.solidSvg(k.cylinder(x, y, 7, -h - footH, 1.6, P, 28), { tone: "lo" }));
    out.push(k.solidSvg(k.cylinder(x, y, 5.4, -h - footH + 1.6, footH - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(k.solidSvg(k.slabOf(plan, -h, h, P, 8, 1.6), { tone: "mid" }));
  out.push(k.lineSvg(k.planOutline(k.insetPlan(plan, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(plan, 10);
  out.push(k.lineSvg(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(k.dotsSvg(screws.map(([x, y]) => k.iso([x, y, 0], P)), { size: 0.5 }));
  if (strip) {
    const s = { x: plan.x + 18, y: plan.y + plan.d - 13, w: plan.w - 36, d: 7, r: 1 };
    out.push(k.solidSvg(k.slabOf(s, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
    const ticks = k.topTicks(s.x + 4, s.x + s.w - 4, 4, 5, s.y + 0.8, 0.6, [2, 3.6], P);
    out.push(k.lineSvg(ticks.minor, { tone: "lo" }), k.lineSvg(ticks.major, { tone: "mid" }));
    out.push(k.dotsSvg([k.iso([s.x + 2, s.y + 3.5, 0.6], P), k.iso([s.x + s.w - 2, s.y + 3.5, 0.6], P)], { size: 0.45 }));
  }
  if (label) out.push(labelPlate(k, P, label, 0));
  return out.join("");
}

// A small engraved label plate: three rule lines standing for printed text.
function labelPlate(k, P, plan, z) {
  const out = [];
  out.push(k.solidSvg(k.slabOf(plan, z, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(k.lineSvg(k.planOutline(k.insetPlan(plan, 1.6), z + 0.8, P, 4), { tone: "faint" }));
  const lines = [0.78, 0.5, 0.62];
  lines.forEach((share, index) => {
    const y = plan.y + 2.6 + index * ((plan.d - 5.2) / 2);
    out.push(k.lineSvg(k.lineOnTop([plan.x + 3, y], [plan.x + 3 + (plan.w - 6) * share, y], z + 0.8, P), { tone: "lo", free: true }));
  });
  out.push(k.dotsSvg([k.iso([plan.x + 1.6, plan.y + plan.d / 2, z + 0.8], P), k.iso([plan.x + plan.w - 1.6, plan.y + plan.d / 2, z + 0.8], P)], { size: 0.4 }));
  return out.join("");
}

// A box with a lid line, an inset top outline and corner screws: an equipment
// housing. `lit` raises it when the station is the one to watch.
function housing(k, P, plan, z, h, { tone = "mid", lid = 0.35, screws = true, steps = 4, bevel = 0.6, lit = false, inner = "" } = {}) {
  const out = [];
  const seam = h > 8 ? k.sideSeam(plan, z + h * lid, P, steps) : "";
  out.push(k.solidSvg(k.slabOf(plan, z, h, P, steps, bevel), { tone, lit, inner: (seam ? k.lineSvg(seam, { tone: "faint" }) : "") + inner }));
  out.push(k.lineSvg(k.planOutline(k.insetPlan(plan, 2.2), z + h, P, steps), { tone: "faint" }));
  if (screws) out.push(k.dotsSvg(k.corners(plan, 3.2).map(([x, y]) => k.iso([x, y, z + h], P)), { size: 0.42 }));
  return out.join("");
}

// A small indicator lamp: a bezel ring and a dome, lit or dark.
function lamp(k, P, x, y, z, { on = false, r = 2.2 } = {}) {
  const out = [];
  out.push(k.solidSvg(k.cylinder(x, y, r + 0.9, z, 0.9, P, 18), { tone: "lo", crease: "none" }));
  out.push(k.solidSvg(k.cylinder(x, y, r, z + 0.9, 1.6, P, 18), { tone: on ? "hi" : "mid", lit: on, crease: on ? "lo" : "faint" }));
  if (on) out.push(k.dotsSvg([k.iso([x, y, z + 2.5], P)], { size: 0.9, tone: "hi" }));
  return out.join("");
}

// A knurled knob with a pointer line on top.
function knob(k, P, x, y, z, r, h, { pointer = 0 } = {}) {
  const out = [];
  out.push(k.solidSvg(k.cylinder(x, y, r, z, h, P, 24), { tone: "mid" }));
  out.push(k.lineSvg(k.knurl(x, y, r, z, z + h, Math.round(r * 5), P), { tone: "lo" }));
  const a = pointer;
  out.push(k.lineSvg(k.lineOnTop([x, y], [x + Math.cos(a) * (r - 0.8), y + Math.sin(a) * (r - 0.8)], z + h, P), { tone: "hi", free: "start" }));
  out.push(k.dotsSvg([k.iso([x, y, z + h], P)], { size: 0.45, tone: "hi" }));
  return out.join("");
}

// A dial that reads a share of a range: a puck with a knurled bezel, ticks,
// a zero mark and a red-zone arc. The needle is drawn separately (`needle`).
const DIAL_FROM = -Math.PI * 0.75; // angle 0 points to -y; the sweep is 270° clockwise
const DIAL_SPAN = Math.PI * 1.5;
function dial(k, P, x, y, z, r, { ticks = 30, every = 5, h = 6, limitShare = null } = {}) {
  const top = z + h;
  const out = [];
  out.push(k.solidSvg(k.cylinder(x, y, r, z, h, P, 56, 0.6), { tone: "hi", crease: "lo" }));
  out.push(k.lineSvg(k.knurl(x, y, r, top - 2.4, top, 64, P, 0.3), { tone: "lo" }));
  out.push(k.lineSvg(k.sideArc(x, y, r, top - 2.4, P, 36), { tone: "faint" }));
  out.push(k.lineSvg(k.ring(x, y, r - 1.8, top, P, 56), { tone: "lo" }));
  const t = k.radialTicks(x, y, r - 2.6, ticks, every, top, [1.2, 2.6], P, DIAL_FROM, DIAL_SPAN);
  out.push(k.lineSvg(t.minor, { tone: "lo" }), k.lineSvg(t.major, { tone: "mid" }));
  if (limitShare !== null) {
    // the over-limit zone: a denser row of short ticks from the limit to the end of the sweep
    const from = DIAL_FROM + DIAL_SPAN * limitShare;
    const zone = k.radialTicks(x, y, r - 2.6, 10, 1, top, [1.6, 1.6], P, from, DIAL_SPAN * (1 - limitShare));
    out.push(k.lineSvg(zone.major, { tone: "hi" }));
  }
  out.push(k.lineSvg(k.ring(x, y, 1.5, top, P, 14), { tone: "mid" }));
  return out.join("");
}
function needle(k, P, x, y, top, r, share, { tone = "lit" } = {}) {
  const a = DIAL_FROM + DIAL_SPAN * Math.min(1.04, Math.max(0, share)) - Math.PI / 2;
  const tail = [x - Math.cos(a) * 3, y - Math.sin(a) * 3];
  const tip = [x + Math.cos(a) * (r - 3.6), y + Math.sin(a) * (r - 3.6)];
  return k.lineSvg(k.lineOnTop(tail, tip, top + 0.2, P), { tone, free: true }) + k.dotsSvg([k.iso([x, y, top + 0.2], P)], { size: 0.5, tone: "hi" });
}

// A counter window on a vertical face (facing +y): a recessed slot showing digits.
function counterWindow(k, P, x, y, z, w, h, text, { tone = "hi", size = 3.2 } = {}) {
  const out = [];
  const plane = k.sideMatrix([x, y], z, P, "left");
  const slot = k.pathOf(k.roundedPlan({ x: 0, y: -h, w, d: h, r: 1 }, 4).map(([u, v]) => [u, v]), true);
  out.push(`<g transform="${plane}"><path class="iso-fill" d="${slot}"/><path class="iso-line" data-tone="lo" d="${slot}"/></g>`);
  out.push(k.faceTextSvg(k.sideMatrix([x + w / 2, y], z + (h - size * 0.7) / 2, P, "left"), text, { size, tone, anchor: "middle" }));
  return out.join("");
}

// A sorted layer: items with depth keys, drawn back to front. Live items carry
// a name so the page can rebuild them.
function layerSvg(items) {
  return `<g data-layer>${[...items].sort((a, b) => a.key - b.key).map((item) => `<g data-k="${item.key.toFixed(2)}"${item.name ? ` data-live="${item.name}"` : ""}${item.station ? ` data-station="${item.station}"` : ""}>${item.svg}</g>`).join("")}</g>`;
}

// The screen box of a world box, for hover regions.
function screenBox(k, P, plan, z0, z1) {
  const pts = k.boxCorners(plan, z0, z1).map((p) => k.iso(p, P));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) => Math.round(v * 10) / 10);
}

// Lay labels out in bands that follow the bench: back-row labels sorted by
// their pin's x in staggered rows above the back edge, front labels (`below`)
// in rows under the front edge. Each label keeps its slot near its pin and is
// pushed sideways only as far as its row's neighbours need. The leader rises
// (or drops) from the pin to just beyond the bench edge, then runs straight to
// the label, so sorted leaders never cross.
function stripLabels(k, P, labels, edges, obstacles = [], { width, height, nameSize = 7.4, lineSize = 6.2, rows = 3, rowStep = 46, rowsBelow = 4, rowStepBelow = 24, gap = 16, gapX = 14 } = {}) {
  const yOn = (line, x) => {
    const [a, b] = line;
    const t = Math.min(1, Math.max(0, (x - a[0]) / (b[0] - a[0] || 1)));
    return a[1] + (b[1] - a[1]) * t;
  };
  const measure = (label) => {
    const [ax, ay] = k.iso(label.at, P);
    const w = ((label.n ? label.n.length + 3 : 0) + label.name.length) * nameSize * 0.72;
    const w2 = label.line.length * lineSize * 0.74;
    return { ...label, ax, ay, w: Math.max(w, w2) + 4, nameSize, lineSize };
  };
  const place = (group, below) => {
    const sorted = group.map(measure).sort((a, b) => a.ax - b.ax);
    const nRows = below ? Math.min(rowsBelow, sorted.length) : Math.min(rows, Math.max(1, Math.ceil(sorted.length / 3)));
    const stepHere = below ? rowStepBelow : rowStep;
    sorted.forEach((label, i) => { label.row = i % nRows; label.x = label.ax - 2; });
    for (let r = 0; r < nRows; r++) {
      const row = sorted.filter((l) => l.row === r);
      for (let i = 1; i < row.length; i++) row[i].x = Math.max(row[i].x, row[i - 1].x + row[i - 1].w + gapX);
      for (let i = row.length - 1; i >= 0; i--) {
        const limit = i === row.length - 1 ? width - 8 : row[i + 1].x - gapX;
        row[i].x = Math.min(row[i].x, limit - row[i].w);
      }
      for (let i = 0; i < row.length; i++) row[i].x = Math.max(8, row[i].x);
    }
    for (const label of sorted) {
      const x0 = label.x, x1 = label.x + label.w;
      // one straight band for the whole group, beyond the edge's extreme point, so a tilted bench can't stack rows
      const edgeAt = below ? Math.max(edges.front[0][1], edges.front[1][1]) : Math.min(edges.back[0][1], edges.back[1][1]);
      label.ly = below ? edgeAt + gap + nameSize + label.row * stepHere : edgeAt - gap - lineSize - 4 - label.row * stepHere;
      // clear any block that rises past the edge under this label's span
      for (const [id, ob] of obstacles) {
        if (ob[2] < x0 - 2 || ob[0] > x1 + 2) continue;
        if (below) label.ly = Math.max(label.ly, ob[3] + gap + nameSize + label.row * stepHere * 0.5);
        else label.ly = Math.min(label.ly, ob[1] - gap - lineSize - 4 - label.row * stepHere * 0.5);
      }
      label.ly = Math.max(nameSize + 4, Math.min(height - lineSize - 8, label.ly));
    }
    // resolve any pair still overlapping (an obstacle can push a label into another row)
    for (let pass = 0; pass < 12; pass++) {
      let moved = false;
      for (const a of sorted) for (const b of sorted) {
        if (a === b || a.x + a.w + 6 <= b.x || b.x + b.w + 6 <= a.x) continue;
        const aTop = a.ly - nameSize, aBot = a.ly + lineSize + 4, bTop = b.ly - nameSize, bBot = b.ly + lineSize + 4;
        if (aBot + 3 <= bTop || bBot + 3 <= aTop) continue;
        const mover = below ? (a.ly > b.ly ? a : b) : (a.ly < b.ly ? a : b);
        mover.ly += below ? (aBot > bBot ? aBot : bBot) - mover.ly + nameSize + 4 : -((aTop < bTop ? bTop : aTop) - mover.ly + lineSize + 8);
        moved = true;
      }
      if (!moved) break;
    }
    for (const label of sorted) {
      const x0 = label.x, x1 = label.x + label.w;
      label.box = [x0, label.ly - nameSize, x1, label.ly + lineSize + 4];
      const edge = below ? yOn(edges.front, label.ax) + 8 : yOn(edges.back, label.ax) - 8;
      const knee = below ? Math.max(edge, label.ay + 6) : Math.min(edge, label.ay - 6);
      label.leader = [[label.ax, label.ay], [label.ax, knee], [label.x + 1.5, below ? label.box[1] - 2 : label.box[3] + 1]];
    }
    return sorted;
  };
  return [...place(labels.filter((l) => !l.below), false), ...place(labels.filter((l) => l.below), true)];
}

export { stripLabels, TAU, byDepth, centreOf, basePlate, labelPlate, housing, lamp, knob, dial, needle, counterWindow, layerSvg, screenBox, DIAL_FROM, DIAL_SPAN };

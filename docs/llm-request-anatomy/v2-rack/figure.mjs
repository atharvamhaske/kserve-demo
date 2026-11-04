// Version 2: the rack. The platform is one 19-inch rack seen straight on, one
// unit per hop from the top down: the OpenEverest controller, the patch panel
// (DNS + LoadBalancer), the TLS unit, the key reader, the router, the token
// meter, the InferencePool selector, and at the bottom a 2U GPU server with
// two fans. The request is a bright bead: it leaves the laptop on the side
// table, runs along a patch cable into the panel, then down the front cable
// from unit to unit. A refused request is thrown out sideways into a bin
// (401 left, 429 right). Tokens come out of the server's tape slot and run
// along a floor groove back toward the laptop.

const WIDTH = 920;
const HEIGHT = 520;

const FLOOR = { x: -200, y: -70, w: 400, d: 150, r: 8 };
const FLOOR_H = 10;
const FOOT_H = 5;
const RACK = { x: -56, y: -44, w: 112, d: 88, r: 3 };
const FRONT = RACK.y + RACK.d; // the unit fronts
const CABLE_Y = FRONT + 3;    // the front cable and the bead ride just in front of the fronts
const POST = [{ x: RACK.x - 6, y: FRONT - 9, w: 6, d: 9, r: 1 }, { x: RACK.x + RACK.w, y: FRONT - 9, w: 6, d: 9, r: 1 }];
const UNIT_H = 16, GAP = 2;
// units bottom to top: z0 and height
const UNITS = { gpu: [0, 36], pick: [38, UNIT_H], meter: [56, UNIT_H], route: [74, UNIT_H], key: [92, UNIT_H], tls: [110, UNIT_H], dns: [128, UNIT_H], console: [146, UNIT_H] };
const RACK_TOP = 164;
const TABLE = { x: -176, y: -22, w: 62, d: 52, r: 3 };
const TABLE_H = 28;
const LAPTOP = { base: { x: -166, y: -12, w: 44, d: 30, r: 2 }, screen: { x: -166, y: -12, w: 44, d: 2.2, r: 0.8 }, screenH: 22 };
const BIN = { key: { x: -106, y: FRONT - 6, w: 40, d: 28, r: 2 }, meter: { x: 72, y: FRONT - 6, w: 40, d: 28, r: 2 } };
const TAPE_Y = FRONT + 24;
const CABLE_U = RACK.x + 12; // where the front cable runs (world x)
const PORT_Z = (id) => UNITS[id][0] + UNITS[id][1] / 2;

function layout(k) {
  return k.fitProjection(
    [...k.boxCorners(FLOOR, -FLOOR_H - FOOT_H, 0), [FLOOR.x - 190, FRONT, 0], [FLOOR.x + FLOOR.w + 40, FRONT, 0], [RACK.x - 8, RACK.y, RACK_TOP + 6], [RACK.x + RACK.w + 8, FRONT, RACK_TOP + 6], [TABLE.x, TABLE.y, TABLE_H + 32]],
    WIDTH,
    HEIGHT,
    { pad: 8, headroom: 8, azimuth: 70, elevation: 26 },
  );
}

const S = (k, paths, style) => k.solidSvg(paths, style);
const L = (k, d, style) => k.lineSvg(d, style);
const D = (k, pts, style) => k.dotsSvg(pts, style);
const at = (k, P, p) => k.iso(p, P);
const item = (k, P, svg, centre, bias = 0, more = {}) => ({ svg, key: k.depthOf(centre, P) + bias, ...more });

// --- drawing on a unit's front face: local u along x, v down -----------------
const face = (k, P, y = FRONT) => k.sideMatrix([0, y], 0, P, "left");
const rect = (u0, z0, w, h, r = 0.8) => `M${(u0 + r).toFixed(1)} ${(-z0 - h).toFixed(1)}h${(w - 2 * r).toFixed(1)}a${r} ${r} 0 0 1 ${r} ${r}v${(h - 2 * r).toFixed(1)}a${r} ${r} 0 0 1 -${r} ${r}h-${(w - 2 * r).toFixed(1)}a${r} ${r} 0 0 1 -${r} -${r}v-${(h - 2 * r).toFixed(1)}a${r} ${r} 0 0 1 ${r} -${r}Z`;
const onFace = (k, P, inner, y = FRONT) => `<g transform="${face(k, P, y)}">${inner}</g>`;
const faceLine = (d, tone = "lo", extra = "") => `<path class="iso-line" data-tone="${tone}" d="${d}"${extra}/>`;
const faceFill = (d, cls = "iso-fill") => `<path class="${cls}" d="${d}"/>`;
const lampOn = (u, z, r, on, tone = "lo") => `<circle class="rk-lamp" ${on ? "data-on" : ""} cx="${u.toFixed(1)}" cy="${(-z).toFixed(1)}" r="${r}"/>`;
const faceDots = (pts, size = 0.45, tone = "mid") => `<g class="iso-dots" data-tone="${tone}">${pts.map(([u, z]) => `<circle cx="${u.toFixed(1)}" cy="${(-z).toFixed(1)}" r="${size}"/>`).join("")}</g>`;

// A rack unit: the box, its front with handles, ears, screws and a label strip.
function unit(k, P, id, tone = "mid", details = "") {
  const [z0, h] = UNITS[id];
  const plan = { x: RACK.x, y: RACK.y, w: RACK.w, d: RACK.d, r: 1.2 };
  const out = [S(k, k.slabOf(plan, z0, h, P, 3, 0.5), { tone, crease: "lo" })];
  const f = [];
  // ears with screws at both ends, a handle each side, the label strip on the left
  for (const u of [RACK.x + 1.5, RACK.x + RACK.w - 7.5]) {
    f.push(faceLine(rect(u, z0 + 1.5, 6, h - 3, 0.6), "lo"));
    f.push(faceDots([[u + 3, z0 + 3.4], [u + 3, z0 + h - 3.4]], 0.5, "mid"));
  }
  f.push(faceLine(rect(RACK.x + 10, z0 + 3, 18, h - 6, 1.2), "faint"));
  [0.7, 0.45, 0.6].forEach((share, i) => f.push(faceLine(`M${(RACK.x + 12).toFixed(1)} ${(-(z0 + h - 5.4 - i * ((h - 10.8) / 2))).toFixed(1)}h${(14 * share).toFixed(1)}`, "lo", " data-free")));
  f.push(details);
  out.push(onFace(k, P, f.join("")));
  return out.join("");
}

// --- statics -----------------------------------------------------------------
function statics(k, P) {
  const items = [];
  const put = (svg, centre, bias = 0, more = {}) => items.push(item(k, P, svg, centre, bias, more));

  put(basePlate(k, P, FLOOR, { h: FLOOR_H, footH: FOOT_H, label: { x: 140, y: FLOOR.y + FLOOR.d - 34, w: 44, d: 10, r: 1.2 } }), [FLOOR.x, FLOOR.y, -FLOOR_H], -1000);
  // the tape groove along the front of the floor and the reel by the table
  const groove = { x: -140, y: TAPE_Y - 3, w: 190, d: 6, r: 1.5 };
  put(L(k, k.planOutline(groove, 0, P, 3), { tone: "faint" }) + S(k, k.slabOf(k.insetPlan(groove, 1), 0, 0.5, P, 3), { tone: "lo", crease: "none" }), [groove.x, groove.y, 0], -900);
  put(S(k, k.cylinder(-150, TAPE_Y, 8, 0, 2.6, P, 32), { tone: "lo" }) + S(k, k.cylinder(-150, TAPE_Y, 6.6, 2.6, 7, P, 32), { tone: "mid" }) + L(k, k.knurl(-150, TAPE_Y, 6.6, 2.6, 9.6, 26, P), { tone: "lo" }) + S(k, k.cylinder(-150, TAPE_Y, 8, 9.6, 1.2, P, 32), { tone: "mid" }), [-150, TAPE_Y, 5], 0, { station: "client" });

  // the side table and the laptop (client)
  put(housing(k, P, TABLE, 0, TABLE_H, { tone: "lo", lid: 0.85, screws: false }), [TABLE.x + 32, TABLE.y + 28, TABLE_H / 2], 0, { station: "client" });
  put(S(k, k.slabOf(LAPTOP.base, TABLE_H, 2.4, P, 3, 0.4), { tone: "mid" }) + D(k, k.dotGrid(LAPTOP.base.x + 6, LAPTOP.base.y + 10, 9, 3, 4, TABLE_H + 2.4, P), { size: 0.45, tone: "lo" }) + L(k, k.planOutline({ x: LAPTOP.base.x + 16, y: LAPTOP.base.y + 24, w: 16, d: 7, r: 1 }, TABLE_H + 2.4, P, 3), { tone: "faint" }), [LAPTOP.base.x + 24, LAPTOP.base.y + 17, TABLE_H + 1], 0, { station: "client" });
  put(S(k, k.slabOf(LAPTOP.screen, TABLE_H + 2.4, LAPTOP.screenH, P, 2, 0.4), { tone: "mid", crease: "lo" }), [LAPTOP.screen.x + 24, LAPTOP.screen.y + 1, TABLE_H + 16], 0, { station: "client" });

  // the rack: posts, top cap, the units
  for (const post of POST) put(S(k, k.slabOf(post, 0, RACK_TOP, P, 2, 0.4), { tone: "mid", crease: "faint" }) + D(k, [20, 60, 100, 140].map((z) => at(k, P, [post.x + 3, post.y + post.d, z])), { size: 0.4 }), [post.x + 3, post.y + 4, RACK_TOP / 2], 4);
  put(S(k, k.slabOf({ x: RACK.x - 6, y: RACK.y - 2, w: RACK.w + 12, d: RACK.d + 2, r: 2 }, RACK_TOP, 4, P, 3, 0.6), { tone: "mid" }) + L(k, k.planOutline({ x: RACK.x + 10, y: RACK.y + 10, w: RACK.w - 20, d: RACK.d - 24, r: 2 }, RACK_TOP + 4, P, 3), { tone: "faint" }) + D(k, k.dotGrid(RACK.x + 14, RACK.y + 14, 10, 3, 6, RACK_TOP + 4, P), { size: 0.45, tone: "lo" }), [0, 0, RACK_TOP + 2], 0);

  const z = (id) => UNITS[id][0];
  // console (OpenEverest): card slot, five lamp holes drawn live, a wheel bezel
  put(unit(k, P, "console", "mid", faceLine(rect(RACK.x + 34, z("console") + 5, 20, 3.4, 0.8), "lo") + faceLine(`M${(RACK.x + 86).toFixed(1)} ${(-(z("console") + 8)).toFixed(1)}a6 6 0 1 1 0.01 0`, "lo")), [0, FRONT, z("console") + 8], 0, { station: "console" });
  // patch panel (DNS + LB): eight ports, one in use
  put(unit(k, P, "dns", "mid", [0, 1, 2, 3, 4, 5, 6, 7].map((i) => faceLine(rect(RACK.x + 34 + i * 8, z("dns") + 5, 6, 6, 0.6), i === 1 ? "hi" : "lo")).join("")), [0, FRONT, z("dns") + 8], 0, { station: "dns" });
  // TLS: a certificate slot and a padlock outline
  put(unit(k, P, "tls", "mid", faceLine(rect(RACK.x + 34, z("tls") + 5, 24, 3.2, 0.8), "lo") + faceLine(rect(RACK.x + 66, z("tls") + 3, 8, 6, 1), "lo") + faceLine(`M${(RACK.x + 67.5).toFixed(1)} ${(-(z("tls") + 9)).toFixed(1)}v-1.5a2.5 2.5 0 0 1 5 0v1.5`, "lo")), [0, FRONT, z("tls") + 8], 0, { station: "tls" });
  // key reader: a key slot, two lamp holes (live), the 401 chute on the left ear
  put(unit(k, P, "key", "mid", faceLine(rect(RACK.x + 34, z("key") + 4, 3.2, 8, 0.6), "hi") + faceLine(rect(RACK.x + 40, z("key") + 5.5, 18, 5, 0.8), "faint")), [0, FRONT, z("key") + 8], 0, { station: "key" });
  // router: three route sockets, the first in use
  put(unit(k, P, "route", "mid", [0, 1, 2].map((i) => faceLine(`M${(RACK.x + 40 + i * 12).toFixed(1)} ${(-(z("route") + 8)).toFixed(1)}a3.2 3.2 0 1 1 0.01 0`, i === 0 ? "hi" : "faint")).join("") + faceLine(rect(RACK.x + 80, z("route") + 5, 16, 6, 0.8), "lo")), [0, FRONT, z("route") + 8], 0, { station: "route" });
  // meter: a bar gauge outline, a counter window, the 429 chute on the right ear
  put(unit(k, P, "meter", "mid", faceLine(rect(RACK.x + 34, z("meter") + 4.5, 40, 3.6, 0.6), "lo") + faceLine(rect(RACK.x + 34, z("meter") + 9.5, 40, 3, 0.6), "faint") + faceFill(rect(RACK.x + 80, z("meter") + 4, 18, 7, 0.8)) + faceLine(rect(RACK.x + 80, z("meter") + 4, 18, 7, 0.8), "lo")), [0, FRONT, z("meter") + 8], 0, { station: "meter" });
  // pool: three pod sockets, pod 1 live
  put(unit(k, P, "pick", "mid", [0, 1, 2].map((i) => faceLine(rect(RACK.x + 36 + i * 14, z("pick") + 4, 10, 8, 1), i === 0 ? "hi" : "faint")).join("") + faceDots([[RACK.x + 41, z("pick") + 8]], 0.7, "hi")), [0, FRONT, z("pick") + 8], 0, { station: "pick" });
  // the GPU server: two fan grilles, a progress bar, the tape slot, the model name
  const gz = z("gpu");
  put(unit(k, P, "gpu", "hi", faceLine(`M${(RACK.x + 44).toFixed(1)} ${(-(gz + 20)).toFixed(1)}a11 11 0 1 1 0.01 0`, "lo") + faceLine(`M${(RACK.x + 72).toFixed(1)} ${(-(gz + 20)).toFixed(1)}a11 11 0 1 1 0.01 0`, "lo") + faceLine(rect(RACK.x + 34, gz + 3, 60, 3, 0.5), "lo") + faceLine(rect(RACK.x + 88, gz + 14, 12, 14, 0.8), "faint")) + k.faceTextSvg(k.sideMatrix([RACK.x + 94, FRONT], gz + 30, P, "left"), "qwen3-0.6b", { size: 2.6, tone: "lo", anchor: "middle" }), [0, FRONT, gz + 18], 0, { station: "gpu" });

  // the 401 and 429 bins on the floor beside the rack
  for (const [id, plan] of Object.entries(BIN)) {
    put(S(k, k.slabOf(plan, 0, 12, P, 3, 0.5), { tone: "lo", crease: "faint" }) + L(k, k.planOutline(k.insetPlan(plan, 2.4), 12, P, 3), { tone: "faint" }), [plan.x + 20, plan.y + 14, 6], 0, { station: id });
  }

  // the patch cable from the laptop to the panel, and the front cable down the units
  const cable = patchCable();
  put(L(k, k.pathOf(cable.map((p) => at(k, P, p))), { tone: "mid" }) + D(k, [at(k, P, cable[0]), at(k, P, cable[cable.length - 1])], { size: 0.8, tone: "mid" }), [-100, CABLE_Y, 120], 30);
  put(L(k, k.segment([CABLE_U, CABLE_Y, PORT_Z("dns")], [CABLE_U, CABLE_Y, PORT_Z("gpu")], P), { tone: "mid" }) + D(k, Object.keys(UNITS).filter((id) => id !== "console").map((id) => at(k, P, [CABLE_U, CABLE_Y, PORT_Z(id)])), { size: 0.8, tone: "mid" }), [CABLE_U, CABLE_Y, 80], 30);
  return items;
}
function patchCable() {
  const port = [RACK.x + 1, CABLE_Y, PORT_Z("dns")];
  return [[LAPTOP.base.x + 48, LAPTOP.base.y + 17, TABLE_H + 1.2], [LAPTOP.base.x + 56, LAPTOP.base.y + 17, TABLE_H + 1.2], [LAPTOP.base.x + 56, CABLE_Y, TABLE_H + 1.2], [LAPTOP.base.x + 56, CABLE_Y, port[2]], port];
}

// --- the bead's position --------------------------------------------------
function along(points, share) {
  const lens = []; let total = 0;
  for (let i = 1; i < points.length; i++) { const d = Math.hypot(...points[i].map((v, j) => v - points[i - 1][j])); lens.push(d); total += d; }
  let s = share * total;
  for (let i = 0; i < lens.length; i++) {
    if (s <= lens[i] || i === lens.length - 1) { const t = lens[i] ? Math.min(1, s / lens[i]) : 1; return points[i].map((v, j) => v + (points[i + 1][j] - v) * t); }
    s -= lens[i];
  }
  return points[points.length - 1];
}
const SCREEN = [LAPTOP.screen.x + 24, LAPTOP.screen.y - 1, TABLE_H + 16];
const stationPoint = (id) => (id === "client" ? SCREEN : id === "gpu" ? [RACK.x + 22, CABLE_Y, PORT_Z("gpu")] : [CABLE_U, CABLE_Y, PORT_Z(id)]);
function beadPosition(pose) {
  if (!pose.visible) return null;
  if (pose.hop) {
    const s = pose.hop.share;
    if (pose.hop.from === "client") return along([SCREEN, [LAPTOP.base.x + 48, LAPTOP.base.y + 17, TABLE_H + 1.2], ...patchCable().slice(1), stationPoint("dns")], s);
    const a = stationPoint(pose.hop.from), b = stationPoint(pose.hop.to);
    return a.map((v, i) => v + (b[i] - v) * s);
  }
  if (pose.dropping) {
    const bin = BIN[pose.at];
    const s = pose.dropping.share;
    const from = stationPoint(pose.at), to = [bin.x + 20, bin.y + 14, 4];
    const arc = Math.sin(Math.PI * Math.min(1, s)) * 14;
    return [from[0] + (to[0] - from[0]) * s, from[1] + (to[1] - from[1]) * s, from[2] + (to[2] - from[2]) * s * s + arc];
  }
  return stationPoint(pose.at);
}

// --- live --------------------------------------------------------------------
function live(k, P, pose, extra = {}) {
  const items = [];
  const put = (name, svg, centre, bias = 0) => items.push({ name, svg, key: k.depthOf(centre, P) + bias });
  const act = pose.acting;
  const acting = (id) => (act && act.station === id ? act.share : null);
  const z = (id) => UNITS[id][0];
  const F = (inner) => onFace(k, P, inner);

  // the bead
  const b = beadPosition(pose);
  if (b) {
    const [x, y, zz] = b;
    put("bead", `<path class="iso-halo" d="${k.haloOf({ x: x - 4, y: y - 4, w: 8, d: 8, r: 4 }, zz - 2, 0.1, P)}" style="filter:blur(2px);opacity:.6"/>` + S(k, k.cylinder(x, y, 3, zz - 1.5, 3, P, 16), { tone: "hi", lit: true, crease: "lo" }) + (pose.key ? "" : L(k, k.ring(x, y, 4.2, zz + 1.6, P, 14), { tone: "lo", dashed: true })), [x, y + 2, zz + 2], 40);
  } else put("bead", "", SCREEN);

  // the laptop screen: a cursor line while sending, the answer growing as tokens arrive
  const sending = acting("client");
  const screenPlane = k.sideMatrix([LAPTOP.screen.x, LAPTOP.screen.y + LAPTOP.screen.d], TABLE_H + 2.4, P, "left");
  const lines = [];
  const n = pose.step.kind === "decode" || pose.step.kind === "done" ? pose.tokensOut : 0;
  for (let i = 0; i < 5; i++) {
    const len = Math.min(36, Math.max(0, (n - i * 18) * 2));
    if (len > 0) lines.push(`M6 ${(-(LAPTOP.screenH - 7 - i * 4)).toFixed(1)}h${len.toFixed(1)}`);
  }
  const cursor = sending !== null ? `M6 ${(-(LAPTOP.screenH - 7)).toFixed(1)}h${(Math.floor(sending * 8) * 4).toFixed(1)}` : "";
  put("screen", `<g transform="${screenPlane}"><path class="iso-line" data-tone="faint" d="${rect(2, 2, 44, LAPTOP.screenH - 4, 1)}"/>${lines.length ? `<path class="iso-line" data-tone="hi" d="${lines.join("")}" data-free/>` : ""}${cursor ? `<path class="iso-line" data-tone="lit" d="${cursor}" data-free style="stroke-width:1.2"/>` : ""}</g>`, [LAPTOP.screen.x + 24, LAPTOP.screen.y + 3, TABLE_H + 16], 2);

  // unit lamps
  const lamps = [];
  const prov = pose.provision, stage = prov ? prov.index : 5;
  [0, 1, 2, 3].forEach((i) => lamps.push(lampOn(RACK.x + 60 + i * 6, z("console") + 8, 1.4, stage > 3 || (stage === 3 && prov.share > i * 0.22))));
  lamps.push(lampOn(RACK.x + 60 + 4 * 6, z("console") + 8, 1.4, stage >= 5));
  lamps.push(lampOn(RACK.x + 100, z("dns") + 8, 1.6, acting("dns") !== null));
  const tls = acting("tls");
  lamps.push(lampOn(RACK.x + 86, z("tls") + 8, 1.6, tls !== null && pose.step.tls), lampOn(RACK.x + 100, z("tls") + 8, 1.6, tls !== null));
  const keyAct = acting("key");
  const accepted = keyAct !== null && pose.step.keyOk, rejected = keyAct !== null && pose.step.reject === "401";
  lamps.push(lampOn(RACK.x + 64, z("key") + 8, 1.8, accepted), lampOn(RACK.x + 72, z("key") + 8, 1.8, rejected));
  const routeAct = acting("route");
  lamps.push(lampOn(RACK.x + 40, z("route") + 8, 1.6, routeAct !== null));
  const meterAct = acting("meter"), over = meterAct !== null && pose.step.reject === "429";
  lamps.push(lampOn(RACK.x + 104, z("meter") + 8, 1.6, meterAct !== null && !over), lampOn(RACK.x + 104, z("meter") + 12.5, 1.2, over));
  const pickAct = acting("pick"), served = act && act.station === "gpu";
  lamps.push(lampOn(RACK.x + 41, z("pick") + 8, 2.2, pickAct !== null || served));
  [0, 1, 2, 3].forEach((i) => lamps.push(lampOn(RACK.x + 94 + i * 2.6, z("gpu") + 33, 0.8, served && (i < 2 || pose.step.kind === "decode"))));
  put("lamps", F(lamps.join("")), [0, FRONT, 80], 20);

  // the key reader's vane: a bar in the slot that turns a quarter when the key is read
  const turn = accepted ? smoothstep((keyAct - 0.25) / 0.6) : rejected ? Math.sin(Math.PI * keyAct) * 0.08 : 0;
  const u0 = RACK.x + 35.6, zk = z("key") + 8, len = 3.6;
  const a = turn * Math.PI / 2;
  put("vane", F(faceLine(`M${(u0 - Math.sin(a) * len).toFixed(1)} ${(-(zk + Math.cos(a) * len)).toFixed(1)}L${(u0 + Math.sin(a) * len).toFixed(1)} ${(-(zk - Math.cos(a) * len)).toFixed(1)}`, accepted ? "lit" : "hi", ' data-free style="stroke-width:1.1"')), [0, FRONT, zk], 21);

  // the meter: the bar fills to the hour's count, the counter window shows it
  const share = Math.min(1, pose.counter / PRESET.tokenLimitPerHour);
  put("meterBar", F((share > 0 ? faceFill(rect(RACK.x + 34.4, z("meter") + 4.9, Math.max(1.2, 39.2 * share), 2.8, 0.4), pose.counter >= PRESET.tokenLimitPerHour ? "rk-bar rk-bar-over" : "rk-bar") : "") + faceLine(`M${(RACK.x + 34 + 40).toFixed(1)} ${(-(z("meter") + 4.5)).toFixed(1)}v3.6`, "hi")) + k.faceTextSvg(k.sideMatrix([RACK.x + 89, FRONT], z("meter") + 5.6, P, "left"), String(pose.counter).padStart(3, "0"), { size: 3.4, tone: pose.counter >= PRESET.tokenLimitPerHour ? "lit" : "hi", anchor: "middle" }), [0, FRONT, z("meter") + 6], 21);

  // the GPU: fans spin while it works, the bar shows prefill then decode (or the weights loading)
  const fan = extra.fan || 0;
  const spokes = (cu, cz) => [0, 1, 2, 3, 4, 5, 6].map((i) => { const t = fan + i * Math.PI * 2 / 7; return `M${(cu + Math.cos(t) * 2.4).toFixed(1)} ${(-(cz + Math.sin(t) * 2.4)).toFixed(1)}L${(cu + Math.cos(t) * 9.6).toFixed(1)} ${(-(cz + Math.sin(t) * 9.6)).toFixed(1)}`; }).join("");
  put("fans", F(faceLine(spokes(RACK.x + 44, z("gpu") + 20), served ? "hi" : "lo", " data-free") + faceLine(spokes(RACK.x + 72, z("gpu") + 20), served ? "hi" : "lo", " data-free")), [0, FRONT, z("gpu") + 20], 21);
  const progress = prov && prov.index === 4 ? prov.share : pose.step.kind === "decode" ? pose.u : pose.step.kind === "done" ? 1 : pose.step.prefill ? pose.u * 0.25 : 0;
  put("bar", F(progress > 0 ? faceFill(rect(RACK.x + 34.4, z("gpu") + 3.4, Math.max(1, 59.2 * progress), 2.2, 0.3), prov ? "rk-bar rk-bar-load" : "rk-bar") : ""), [0, FRONT, z("gpu") + 4], 21);

  // the tape: ticks pushed out of the slot into the floor groove, toward the reel
  const pitch = 3.6, start = RACK.x + 94, end = -138;
  const ticks = [], nOut = n;
  for (let i = 0; i < nOut; i++) { const x = start - (nOut - i) * pitch; if (x < end) break; ticks.push(k.lineOnTop([x, TAPE_Y - 1.8], [x, TAPE_Y + 1.8], 0.6, P)); }
  put("tape", (nOut ? L(k, k.lineOnTop([Math.max(end, start - nOut * pitch), TAPE_Y], [start, TAPE_Y], 0.5, P), { tone: "hi" }) : "") + (ticks.length ? L(k, ticks.join(""), { tone: "lit" }) : ""), [-40, TAPE_Y, 1], -300);
  const reelA = (nOut * 0.35) % (Math.PI * 2);
  const reel = k.radialTicks(-150, TAPE_Y, 5.6, 6, 1, 10.8, [4.6, 4.6], P, reelA, Math.PI * 2);
  put("reel", L(k, reel.major, { tone: nOut > 0 && pose.step.kind === "decode" ? "hi" : "mid", free: true }), [-150, TAPE_Y, 11], 1);

  // the console: the Instance card slides into its slot, the wheel turns while the controllers reconcile
  const cardIn = prov && prov.index === 0 ? smoothstep(prov.share) : 1;
  put("card", F(faceFill(rect(RACK.x + 36, z("console") + 5.6 + (1 - cardIn) * 9, 16, 2 + (1 - cardIn) * 6, 0.4)) + faceLine(rect(RACK.x + 36, z("console") + 5.6 + (1 - cardIn) * 9, 16, 2 + (1 - cardIn) * 6, 0.4), stage === 0 ? "lit" : "hi")), [0, FRONT, z("console") + 8], 22);
  const wheelA = prov && (prov.index === 1 || prov.index === 2) ? (prov.index - 1 + prov.share) * Math.PI * 1.5 : 0;
  const wu = RACK.x + 86, wz = z("console") + 8;
  put("wheel", F([0, 1, 2, 3].map((i) => { const t = wheelA + i * Math.PI / 2; return faceLine(`M${(wu + Math.cos(t) * 1.4).toFixed(1)} ${(-(wz + Math.sin(t) * 1.4)).toFixed(1)}L${(wu + Math.cos(t) * 5).toFixed(1)} ${(-(wz + Math.sin(t) * 5)).toFixed(1)}`, stage === 1 || stage === 2 ? "hi" : "mid", " data-free"); }).join("")), [0, FRONT, wz], 22);
  return items;
}

// --- labels: two columns beside the rack -------------------------------------
const LABELS = [
  { id: "console", n: "09", name: "OPENEVEREST", line: "Instance → provider-kserve → KServe", at: [RACK.x + RACK.w + 6, FRONT - 4, UNITS.console[0] + 8], side: "right" },
  { id: "dns", n: "02", name: "LOAD BALANCER", line: "nip.io DNS → Envoy proxy :443", at: [RACK.x + RACK.w + 6, FRONT - 4, UNITS.dns[0] + 8], side: "right" },
  { id: "tls", n: "03", name: "ENVOY GATEWAY", line: "TLS · cert-manager certificate", at: [RACK.x + RACK.w + 6, FRONT - 4, UNITS.tls[0] + 8], side: "right" },
  { id: "key", n: "04", name: "API KEY CHECK", line: "SecurityPolicy · key of chat-app", at: [RACK.x + RACK.w + 6, FRONT - 4, UNITS.key[0] + 8], side: "right" },
  { id: "route", n: "05", name: "AGENT ROUTER", line: "AI Gateway · routes by model name", at: [RACK.x + RACK.w + 6, FRONT - 4, UNITS.route[0] + 8], side: "right" },
  { id: "meter", n: "06", name: "TOKEN METER", line: "300 tokens / key / hour · Valkey", at: [RACK.x + RACK.w + 6, FRONT - 4, UNITS.meter[0] + 8], side: "right" },
  { id: "pick", n: "07", name: "INFERENCEPOOL", line: "KServe picks a vLLM pod · 1 of 1", at: [RACK.x + RACK.w + 6, FRONT - 4, UNITS.pick[0] + 8], side: "right" },
  { id: "gpu", n: "08", name: "VLLM POD · GPU", line: "Qwen3 0.6B open weights · 1 GPU", at: [RACK.x + RACK.w + 6, FRONT - 4, UNITS.gpu[0] + 18], side: "right" },
  { id: "client", n: "01", name: "CLIENT", line: "POST /v1/chat/completions", at: [LAPTOP.screen.x, LAPTOP.screen.y, TABLE_H + 16], side: "left" },
  { id: "bin401", n: "", name: "401 BIN", line: "wrong key · no model is reached", at: [BIN.key.x + 2, BIN.key.y + 24, 11], side: "left" },
  { id: "bin429", n: "", name: "429 BIN", line: "the hour's 300 tokens are spent", at: [BIN.meter.x + 38, BIN.meter.y + 24, 11], side: "right" },
  { id: "tape", n: "", name: "TAPE", line: "SSE stream back · one tick per token", at: [-134, TAPE_Y, 1], side: "left" },
  { id: "k8s", n: "", name: "KUBERNETES", line: "the whole floor is one cluster", at: [FLOOR.x + 10, FLOOR.y + FLOOR.d - 6, 0], side: "left" },
];

function labelsSvg(k, P) {
  const out = [];
  const nameSize = 7.4, lineSize = 6.2, step = 24;
  for (const side of ["left", "right"]) {
    const group = LABELS.filter((l) => l.side === side).map((l) => { const [ax, ay] = k.iso(l.at, P); return { ...l, ax, ay }; }).sort((a, b) => a.ay - b.ay);
    const colX = side === "right" ? k.iso([RACK.x + RACK.w + 50, FRONT, 0], P)[0] : k.iso([FLOOR.x - 12, FRONT, 0], P)[0];
    let y = 20;
    for (const l of group) { l.ly = Math.max(y, l.ay + 3); y = l.ly + step; }
    // keep the column inside the card: push up from the bottom if it overflows
    const over = group.length ? group[group.length - 1].ly + lineSize + 8 - HEIGHT : 0;
    if (over > 0) for (let i = group.length - 1; i >= 0; i--) { group[i].ly -= over; if (i < group.length - 1) group[i].ly = Math.min(group[i].ly, group[i + 1].ly - step); }
    for (const l of group) {
      const anchor = side === "right" ? "start" : "end";
      const tx = colX;
      const kneeX = side === "right" ? tx - 6 : tx + 6;
      out.push(k.lineSvg(k.pathOf([[l.ax, l.ay], [side === "right" ? l.ax + 8 : l.ax - 8, l.ay], [kneeX, l.ly - 2]]), { tone: "lo", free: "end" }));
      out.push(k.dotsSvg([[l.ax, l.ay]], { size: 1.1, tone: "hi" }));
      const wide = Math.max(((l.n ? l.n.length + 3 : 0) + l.name.length) * nameSize * 0.72, l.line.length * lineSize * 0.74) + 4;
      const box = anchor === "start" ? [tx, l.ly - nameSize, tx + wide, l.ly + lineSize + 4] : [tx - wide, l.ly - nameSize, tx, l.ly + lineSize + 4];
      out.push(`<text class="iso-label" data-id="${l.id}" data-box="${box.map((v) => v.toFixed(1)).join(",")}" x="${tx.toFixed(1)}" y="${l.ly.toFixed(1)}" text-anchor="${anchor}"><tspan class="iso-label-name">${l.n ? l.n + " · " : ""}${l.name}</tspan><tspan class="iso-label-line" x="${tx.toFixed(1)}" dy="${(lineSize + 1.6).toFixed(1)}">${l.line}</tspan></text>`);
    }
  }
  return `<g data-labels>${out.join("")}</g>`;
}

const STATION_PLANS = Object.fromEntries(Object.entries(UNITS).map(([id, [z0, h]]) => [id, [RACK, z0, z0 + h]]));
STATION_PLANS.client = [TABLE, 0, TABLE_H + 32];
STATION_PLANS.bin401 = [BIN.key, 0, 12];
STATION_PLANS.bin429 = [BIN.meter, 0, 12];

const CSS = `
.rk-lamp{fill:var(--anatomy-shade-1);stroke:var(--anatomy-lo);stroke-width:.5}
.rk-lamp[data-on]{fill:var(--anatomy-lit);stroke:var(--anatomy-lit)}
.rk-bar{fill:var(--anatomy-hi);stroke:none}
.rk-bar-over{fill:var(--anatomy-lit)}
.rk-bar-load{fill:var(--anatomy-mid)}
`;

const CARD = {
  fig: "Fig 2",
  title: "What happens to an LLM request",
  page: "What happens to an LLM request · the rack",
  label: "A server rack seen from the front, one unit per hop from the top down: controller, patch panel, TLS, key reader, router, token meter, pool selector, and a 2U GPU server with two fans at the bottom. A bright bead, one chat completion, runs from a laptop on a side table along a patch cable into the panel and down the front cable, unit by unit. A refused request is thrown into a bin beside the rack. Tokens come out of the server's slot as ticks on a tape toward the laptop.",
  keys: [
    { mark: "lit", label: "The request: one POST /v1/chat/completions, as a bead on the front cable" },
    { mark: "raised", label: "One rack unit per hop, in the order the request meets them" },
    { mark: "edge", label: "The stream back: one tick on the floor tape per token" },
  ],
  caption: `The same request as Fig 1, as a rack. Each unit is one hop; a wrong key is thrown out at the key reader (401) and the meter throws out the request that would pass ${PRESET.tokenLimitPerHour} tokens in the hour (429). The GPU server at the bottom runs Qwen3 0.6B on one GPU with a ${PRESET.maxModelLen}-token context; each request is a ${REQUEST.promptTokens}-token prompt and a ${REQUEST.completionTokens}-token answer.`,
};

export { WIDTH, HEIGHT, STATION_PLANS, LABELS, CARD, CSS, layout, statics, live, labelsSvg };

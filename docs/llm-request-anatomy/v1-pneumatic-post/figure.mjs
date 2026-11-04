// Version 1: the sorting line. One chat completion is a capsule on a rail bed
// that runs the length of a bench, past the machines that handle it in the
// order the real request meets them: the terminal (client), the resolver box
// (DNS + LoadBalancer), the airlock portal (TLS), the turnstile with its key
// reader and 401 chute, the carousel (model routing), the token meter with its
// dial and 429 gate, the selector arm (the endpoint picker) and the GPU arch
// where vLLM decodes. Tokens stream back on a tape to a reel at the terminal.
// At the back, the OpenEverest console that built the line.
//
// `layout(k)` returns the projection and constants. `statics(k, P)` builds
// every part that never moves. `live(k, P, pose, extra)` rebuilds the parts
// that move, as named items with depth keys, for the build's first frame and
// for every frame in the page.

const WIDTH = 920;
const HEIGHT = 450;

const PLATE = { x: -300, y: -94, w: 600, d: 178, r: 10 };
const PLATE_H = 12;
const FOOT_H = 5;
const BED_Z = 12; // the plate top
const BED_TOP = 14;
const WALL_TOP = 17;
const TRACK = { from: -270, to: 212 };
const TAPE_Y = 60;

// Station x positions along the bed (the model's station ids).
const SX = { client: -226, dns: -184, tls: -124, key: -62, route: 8, meter: 82, pick: 146, gpu: 218 };
const BIN = { key: { x: -82, y: 18, w: 40, d: 26, r: 2 }, meter: { x: 62, y: 18, w: 40, d: 26, r: 2 } };
const GPU = { back: { x: 194, y: -42, w: 76, d: 32, r: 4 }, front: { x: 194, y: 10, w: 76, d: 32, r: 4 }, lintel: { x: 194, y: -42, w: 76, d: 84, r: 4 }, pillars: [{ x: 194, y: 10, w: 12, d: 32, r: 2 }, { x: 258, y: 10, w: 12, d: 32, r: 2 }], sill: { x: 206, y: 28, w: 52, d: 14, r: 2 } };
const CONSOLE = { x: -300, y: -90, w: 54, d: 38, r: 3 };
const CAPSULE = { x: -13, y: -5, w: 26, d: 10, r: 5 };
const CAPSULE_H = 8;

function layout(k) {
  const P = k.fitProjection(
    [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [CONSOLE.x + 10, CONSOLE.y + 10, 50], [GPU.lintel.x + 40, GPU.lintel.y + 40, 54]],
    WIDTH,
    HEIGHT - 72,
<<<<<<< HEAD
    { pad: 10, headroom: 128, azimuth: 62, elevation: 34 },
=======
    { pad: 10, headroom: 128, azimuth: 78, elevation: 36 },
>>>>>>> origin/main
  );
  return P;
}

// --- helpers -----------------------------------------------------------------
const S = (k, paths, style) => k.solidSvg(paths, style);
const L = (k, d, style) => k.lineSvg(d, style);
const D = (k, points, style) => k.dotsSvg(points, style);
const at = (k, P, p) => k.iso(p, P);
const key = (k, P, p) => k.depthOf(p, P);
const item = (k, P, svg, centre, bias = 0, more = {}) => ({ svg, key: key(k, P, centre) + bias, ...more });

// --- static parts ------------------------------------------------------------
function statics(k, P) {
  const items = [];
  const put = (svg, centre, bias = 0, more = {}) => items.push(item(k, P, svg, centre, bias, more));

  // the bench: drawn first, as its own item far back
  put(basePlate(k, P, PLATE, { h: PLATE_H, footH: FOOT_H, label: { x: 150, y: PLATE.y + PLATE.d - 36, w: 44, d: 10, r: 1.2 } }), [PLATE.x, PLATE.y, -PLATE_H], -1000);

  // the tape groove along the front, and the reel at the terminal end
  const groove = { x: SX.client - 6, y: TAPE_Y - 4, w: GPU.front.x + 48 - (SX.client - 6), d: 8, r: 2 };
  put(L(k, k.planOutline(groove, BED_Z, P, 3), { tone: "faint" }) + S(k, k.slabOf(k.insetPlan(groove, 1.2), BED_Z, 0.6, P, 3), { tone: "lo", crease: "none" }), [groove.x, groove.y, BED_Z], -900);
  put(S(k, k.cylinder(SX.client - 6, TAPE_Y, 9, BED_Z, 3, P, 36), { tone: "lo" }) + S(k, k.cylinder(SX.client - 6, TAPE_Y, 7.4, BED_Z + 3, 8, P, 36), { tone: "mid" }) + L(k, k.knurl(SX.client - 6, TAPE_Y, 7.4, BED_Z + 3, BED_Z + 11, 30, P), { tone: "lo" }) + S(k, k.cylinder(SX.client - 6, TAPE_Y, 9, BED_Z + 11, 1.2, P, 36), { tone: "mid" }) + S(k, k.cylinder(SX.client - 6, TAPE_Y, 1.6, BED_Z + 12.2, 3, P, 14), { tone: "hi" }), [SX.client - 6, TAPE_Y, BED_Z + 6], 0, { station: "client" });

  // the rail bed in segments, so a moving capsule sorts against each locally
  const SEG = 36;
  for (let x = TRACK.from; x < TRACK.to; x += SEG) {
    const w = Math.min(SEG, TRACK.to - x);
    const onTable = x + w / 2 > SX.route - 30 && x + w / 2 < SX.route + 30;
    put(S(k, k.slabOf({ x, y: -8, w: w + 0.4, d: 16, r: 0.6 }, BED_Z, BED_TOP - BED_Z, P, 2), { tone: "lo", crease: "faint" }), [x + w / 2, 0, BED_Z], -6);
    if (onTable) continue;
    const isGate = (x <= SX.key && x + w > SX.key) || (x <= SX.meter && x + w > SX.meter);
    put(S(k, k.slabOf({ x, y: -10.4, w: w + 0.4, d: 2.4, r: 0.5 }, BED_Z, WALL_TOP - BED_Z, P, 2), { tone: "mid", crease: "faint" }), [x + w / 2, -9.2, BED_Z + 4], -3);
    if (!isGate) put(S(k, k.slabOf({ x, y: 8, w: w + 0.4, d: 2.4, r: 0.5 }, BED_Z, WALL_TOP - BED_Z, P, 2), { tone: "mid", crease: "faint" }), [x + w / 2, 9.2, BED_Z + 4], 3);
  }
  // end stops of the bed
  put(S(k, k.slabOf({ x: TRACK.from - 4, y: -11, w: 4, d: 22, r: 1 }, BED_Z, 10, P, 3, 0.4), { tone: "mid" }), [TRACK.from - 2, 0, BED_Z + 5], 0);

  // --- the terminal (client): a desk unit behind the bed with a slot and a keyboard plate
  const term = { x: SX.client - 24, y: -44, w: 48, d: 30, r: 3 };
  put(housing(k, P, term, BED_Z, 18, { tone: "mid" }) + S(k, k.slabOf({ x: term.x + 4, y: term.y + 4, w: 40, d: 12, r: 1.2 }, BED_Z + 18, 2.4, P, 3, 0.4), { tone: "hi", crease: "lo" }) + S(k, k.slabOf({ x: term.x + 4, y: term.y + 19, w: 40, d: 8, r: 1 }, BED_Z + 18, 1.2, P, 3), { tone: "lo", crease: "none" }) + L(k, k.lineOnTop([term.x + 8, term.y + 23], [term.x + 36, term.y + 23], BED_Z + 19.2, P), { tone: "lo", free: true }), [term.x + 24, term.y + 15, BED_Z + 9], 0, { station: "client" });
  // the slot where the capsule is loaded, on the terminal's front face
  put(L(k, k.pathOf([[SX.client - 8, -14, BED_Z + 6], [SX.client + 8, -14, BED_Z + 6], [SX.client + 8, -14, BED_Z + 13], [SX.client - 8, -14, BED_Z + 13]].map((p) => at(k, P, p)), true), { tone: "lo" }), [SX.client, -14, BED_Z + 9], 0.5, { station: "client" });

  // --- the resolver (DNS + LoadBalancer): a box with a lamp and a coil antenna
  const dns = { x: SX.dns - 16, y: -38, w: 32, d: 22, r: 2.4 };
  put(housing(k, P, dns, BED_Z, 14, { tone: "mid" }) + S(k, k.cylinder(SX.dns + 8, -30, 1.4, BED_Z + 14, 14, P, 12), { tone: "mid", crease: "none" }) + S(k, k.cylinder(SX.dns + 8, -30, 2.6, BED_Z + 28, 1.6, P, 14), { tone: "hi" }), [SX.dns, -27, BED_Z + 7], 0, { station: "dns" });

  // --- the airlock portal (TLS): two posts, a lintel, a certificate box behind
  const postBack = { x: SX.tls - 4, y: -16, w: 8, d: 6, r: 1 };
  const postFront = { x: SX.tls - 4, y: 10, w: 8, d: 6, r: 1 };
  put(S(k, k.slabOf(postBack, BED_Z, 24, P, 3, 0.4), { tone: "mid" }), [SX.tls, -13, BED_Z + 12], 0, { station: "tls" });
  put(S(k, k.slabOf(postFront, BED_Z, 24, P, 3, 0.4), { tone: "mid" }), [SX.tls, 13, BED_Z + 12], 0, { station: "tls" });
  put(S(k, k.slabOf({ x: SX.tls - 5, y: -17, w: 10, d: 34, r: 1.2 }, BED_Z + 24, 6, P, 3, 0.5), { tone: "mid" }) + D(k, [at(k, P, [SX.tls, -13, BED_Z + 30]), at(k, P, [SX.tls, 13, BED_Z + 30])], { size: 0.45 }), [SX.tls, 0, BED_Z + 27], 0, { station: "tls" });
  const cert = { x: SX.tls - 14, y: -42, w: 28, d: 18, r: 2 };
  put(housing(k, P, cert, BED_Z, 11, { tone: "mid" }), [SX.tls, -33, BED_Z + 5], 0, { station: "tls" });

  // --- the turnstile (API key): a reader box behind, a post over the bed, the 401 bin in front
  const reader = { x: SX.key - 18, y: -44, w: 36, d: 22, r: 2.4 };
  put(housing(k, P, reader, BED_Z, 16, { tone: "mid" }) + L(k, k.planOutline({ x: SX.key - 11, y: -40, w: 22, d: 6, r: 1 }, BED_Z + 16, P, 3), { tone: "lo" }), [SX.key, -33, BED_Z + 8], 0, { station: "key" });
  put(S(k, k.cylinder(SX.key, -13, 4, BED_Z, 3, P, 20), { tone: "lo" }) + S(k, k.cylinder(SX.key, -13, 2.4, BED_Z + 3, 24, P, 16), { tone: "mid", crease: "none" }) + L(k, [BED_Z + 10, BED_Z + 18].map((z) => k.sideArc(SX.key, -13, 2.4, z, P, 12)).join(""), { tone: "faint" }), [SX.key, -13, BED_Z + 12], 0, { station: "key" });
  put(trough(k, P, BIN.key, BED_Z, 12).back, [BIN.key.x + 20, BIN.key.y + 4, BED_Z + 6], -2, { station: "key" });
  put(trough(k, P, BIN.key, BED_Z, 12).front, [BIN.key.x + 20, BIN.key.y + BIN.key.d, BED_Z + 6], 2, { station: "key" });

  // --- the carousel (route): a turntable set into the bed, a route box behind
  put(S(k, k.cylinder(SX.route, 0, 31, BED_Z - 0.2, 0.2, P, 72), { tone: "lo", crease: "none" }) + S(k, k.cylinder(SX.route, 0, 29, BED_Z, BED_TOP - BED_Z, P, 72, 0.5), { tone: "mid", crease: "faint" }) + L(k, k.ring(SX.route, 0, 26.6, BED_TOP, P, 72), { tone: "faint" }), [SX.route, 0, BED_Z], -8, { station: "route" });
  const routeBox = { x: SX.route - 20, y: -46, w: 40, d: 18, r: 2.4 };
  put(housing(k, P, routeBox, BED_Z, 12, { tone: "mid" }), [SX.route, -37, BED_Z + 6], 0, { station: "route" });
  // three outlet stubs on the carousel rim: +x is the live route, the two others are capped spares
  for (const [dx, dy, tone] of [[0, -27, "lo"], [0, 27, "lo"]]) {
    put(S(k, k.slabOf({ x: SX.route + dx - 5, y: dy - 3, w: 10, d: 6, r: 1 }, BED_Z, 5, P, 3), { tone }) + L(k, k.planOutline({ x: SX.route + dx - 3.4, y: dy - 1.6, w: 6.8, d: 3.2, r: 0.8 }, BED_Z + 5, P, 3), { tone: "faint" }), [SX.route + dx, dy, BED_Z + 2], 1, { station: "route" });
  }

  // --- the meter: a box with the dial on top and a counter window on its front; the 429 bin in front
  const meterBox = { x: SX.meter - 22, y: -48, w: 44, d: 28, r: 2.6 };
  put(housing(k, P, meterBox, BED_Z, 16, { tone: "mid" }) + dial(k, P, SX.meter, -34, BED_Z + 16, 13, { ticks: 30, every: 5, h: 5, limitShare: 1 }), [SX.meter, -34, BED_Z + 8], 0, { station: "meter" });
  put(trough(k, P, BIN.meter, BED_Z, 12).back, [BIN.meter.x + 20, BIN.meter.y + 4, BED_Z + 6], -2, { station: "meter" });
  put(trough(k, P, BIN.meter, BED_Z, 12).front, [BIN.meter.x + 20, BIN.meter.y + BIN.meter.d, BED_Z + 6], 2, { station: "meter" });

  // --- the selector (endpoint picker): a post with a pivot behind the bed, three bay marks it can point at
  put(S(k, k.cylinder(SX.pick, -16, 5, BED_Z, 3, P, 24), { tone: "lo" }) + S(k, k.cylinder(SX.pick, -16, 3, BED_Z + 3, 20, P, 18), { tone: "mid", crease: "none" }) + S(k, k.cylinder(SX.pick, -16, 4.2, BED_Z + 23, 2, P, 20), { tone: "mid" }), [SX.pick, -16, BED_Z + 10], 0, { station: "pick" });
  // the pool plate behind: three sockets, one live
  const pool = { x: SX.pick - 20, y: -48, w: 40, d: 18, r: 2 };
  put(housing(k, P, pool, BED_Z, 6, { tone: "mid", screws: true }) + [0, 1, 2].map((i) => L(k, k.ring(pool.x + 8 + i * 12, pool.y + 9, 3.2, BED_Z + 6, P, 16), { tone: i === 0 ? "hi" : "faint" })).join("") + D(k, [at(k, P, [pool.x + 8, pool.y + 9, BED_Z + 6])], { size: 0.6, tone: "hi" }), [SX.pick, -39, BED_Z + 3], 0, { station: "pick" });

  // --- the GPU arch (vLLM pod): a back block, a front block, a lintel with fins, a fan on top
  put(S(k, k.slabOf(GPU.back, BED_Z, 26, P, 4, 0.7), { tone: "hi", crease: "lo", inner: L(k, k.sideSeam(GPU.back, BED_Z + 8, P, 4), { tone: "faint" }) }), [GPU.back.x + 38, GPU.back.y + 16, BED_Z + 13], -6, { station: "gpu" });
  put(S(k, k.slabOf(GPU.lintel, BED_Z + 26, 12, P, 4, 0.7), { tone: "hi", crease: "lo" }) + finsOn(k, P, { x: GPU.lintel.x + 4, y: GPU.lintel.y + 6, w: 16, d: GPU.lintel.d - 12, r: 1 }, BED_Z + 38, 5, 5) + finsOn(k, P, { x: GPU.lintel.x + GPU.lintel.w - 20, y: GPU.lintel.y + 6, w: 16, d: GPU.lintel.d - 12, r: 1 }, BED_Z + 38, 5, 5) + fanRing(k, P, GPU.lintel.x + 38, 0, BED_Z + 38), [GPU.lintel.x + 38, 0, BED_Z + 32], 4, { station: "gpu" });
  for (const pillar of GPU.pillars) put(S(k, k.slabOf(pillar, BED_Z, 26, P, 3, 0.5), { tone: "hi", crease: "lo", inner: L(k, k.sideSeam(pillar, BED_Z + 8, P, 3), { tone: "faint" }) }), [pillar.x + 6, pillar.y + 16, BED_Z + 13], 0, { station: "gpu" });
  put(S(k, k.slabOf(GPU.sill, BED_Z, 4, P, 3, 0.5), { tone: "hi", crease: "lo" }) + k.faceTextSvg(k.sideMatrix([GPU.sill.x + 26, GPU.sill.y + GPU.sill.d], BED_Z + 0.8, P, "left"), "qwen3-0.6b", { size: 2.6, tone: "lo", anchor: "middle" }), [GPU.sill.x + 26, GPU.sill.y + 7, BED_Z + 2], 0, { station: "gpu" });
  // the mouth where the tape leaves the front block, and the tape's first guide roller
  put(S(k, k.cylinder(GPU.front.x + 12, GPU.front.y + GPU.front.d + 8, 2.4, BED_Z, 6, P, 14), { tone: "mid" }), [GPU.front.x + 12, GPU.front.y + GPU.front.d + 8, BED_Z + 3], 0, { station: "gpu" });

  // --- the OpenEverest console at the back: a cabinet with a card slot, a reconciler wheel and four lamps
  put(housing(k, P, CONSOLE, BED_Z, 34, { tone: "mid", lid: 0.7 }) + L(k, k.planOutline({ x: CONSOLE.x + 6, y: CONSOLE.y + 6, w: 22, d: 4, r: 0.8 }, BED_Z + 34, P, 3), { tone: "lo" }) + labelPlate(k, P, { x: CONSOLE.x + 36, y: CONSOLE.y + 5, w: 26, d: 7, r: 1 }, BED_Z + 34), [CONSOLE.x + 34, CONSOLE.y + 20, BED_Z + 17], 0, { station: "console" });
  // cables from the console: one to the key reader (the SecurityPolicy), one to the GPU bay (the workload)
  const cableZ = BED_Z + 0.6;
  put(L(k, k.pathOf([[CONSOLE.x + 60, CONSOLE.y + 30, cableZ], [CONSOLE.x + 60, -72, cableZ], [SX.key - 6, -72, cableZ], [SX.key - 6, -44, cableZ]].map((p) => at(k, P, p))), { tone: "lo" }) + D(k, [at(k, P, [CONSOLE.x + 60, CONSOLE.y + 30, cableZ]), at(k, P, [SX.key - 6, -44, cableZ])], { size: 0.7, tone: "mid" }), [SX.key - 40, -72, cableZ], -500);
  put(L(k, k.pathOf([[CONSOLE.x + 64, CONSOLE.y + 34, cableZ], [CONSOLE.x + 64, -78, cableZ], [GPU.back.x + 20, -78, cableZ], [GPU.back.x + 20, GPU.back.y, cableZ]].map((p) => at(k, P, p))), { tone: "lo" }) + D(k, [at(k, P, [CONSOLE.x + 64, CONSOLE.y + 34, cableZ]), at(k, P, [GPU.back.x + 20, GPU.back.y, cableZ])], { size: 0.7, tone: "mid" }), [SX.route, -78, cableZ], -500);

  return items;
}

// A heat-sink: thin fins standing on a block's top, along x.
function finsOn(k, P, plan, z, count, h) {
  const out = [];
  const gap = (plan.w - 2) / (count - 1);
  for (let i = 0; i < count; i++) {
    out.push(k.solidSvg(k.slabOf({ x: plan.x + 1 + i * gap - 1, y: plan.y, w: 2, d: plan.d, r: 0.4 }, z, h, P, 2), { tone: "mid", crease: "faint" }));
  }
  return out.join("");
}
// A fan housing on a top: a ring, a hub and the spokes are drawn live.
function fanRing(k, P, x, y, z) {
  return k.solidSvg(k.cylinder(x, y, 14, z, 2, P, 48), { tone: "mid" }) + k.lineSvg(k.ring(x, y, 11.6, z + 2, P, 48), { tone: "lo" }) + k.dotsSvg([0, 1, 2, 3].map((i) => k.iso([x + Math.cos(i * Math.PI / 2 + Math.PI / 4) * 12.8, y + Math.sin(i * Math.PI / 2 + Math.PI / 4) * 12.8, z + 2], P)), { size: 0.45 });
}
// An open bin: floor, back wall and far side wall first; front wall and near side wall after.
function trough(k, P, plan, z, h) {
  const t = 2;
  const back = [
    k.solidSvg(k.slabOf(plan, z, 1.6, P, 3), { tone: "lo", crease: "none" }),
    k.solidSvg(k.slabOf({ x: plan.x, y: plan.y, w: plan.w, d: t, r: 0.6 }, z, h, P, 2), { tone: "mid", crease: "faint" }),
    k.solidSvg(k.slabOf({ x: plan.x, y: plan.y, w: t, d: plan.d, r: 0.6 }, z, h, P, 2), { tone: "mid", crease: "faint" }),
  ].join("");
  const front = [
    k.solidSvg(k.slabOf({ x: plan.x + plan.w - t, y: plan.y, w: t, d: plan.d, r: 0.6 }, z, h, P, 2), { tone: "mid", crease: "faint" }),
    k.solidSvg(k.slabOf({ x: plan.x, y: plan.y + plan.d - t, w: plan.w, d: t, r: 0.6 }, z, h, P, 2), { tone: "mid", crease: "faint" }),
    k.dotsSvg([k.iso([plan.x + 4, plan.y + plan.d - 1, z + h], P), k.iso([plan.x + plan.w - 4, plan.y + plan.d - 1, z + h], P)], { size: 0.42 }),
  ].join("");
  return { back, front };
}

// --- live parts --------------------------------------------------------------
function capsulePosition(pose) {
  // the capsule's world centre, or null when there is no request on the line
  if (!pose.visible) return null;
  const z = BED_TOP;
  if (pose.hop) {
    const a = SX[pose.hop.from], b = pose.hop.to === "gpu" ? GPU.lintel.x + 38 : SX[pose.hop.to];
    return [a + (b - a) * pose.hop.share, 0, z];
  }
  if (pose.dropping) {
    const bin = BIN[pose.at];
    const s = pose.dropping.share;
    const x = SX[pose.at], y0 = 0, y1 = bin.y + bin.d / 2;
    const lift = Math.sin(Math.PI * Math.min(1, s * 1.2)) * 10;
    return [x, y0 + (y1 - y0) * s, s < 0.7 ? z + lift : Math.max(BED_Z + 1.6, z - 2 - (s - 0.7) * 12)];
  }
  if (pose.at === "gpu") return [GPU.lintel.x + 38, 0, z];
  return [SX[pose.at], 0, z];
}

function live(k, P, pose, extra = {}) {
  const items = [];
  const put = (name, svg, centre, bias = 0) => items.push({ name, svg, key: k.depthOf(centre, P) + bias });
  const act = pose.acting;
  const acting = (id) => (act && act.station === id ? act.share : null);
  const pulse = (s) => Math.sin(Math.PI * s); // 0 → 1 → 0 over an act

  // the request capsule: a pill with a band and its key tag
  const c = capsulePosition(pose);
  if (c) {
    const [x, y, z] = c;
    const plan = { x: CAPSULE.x + x, y: CAPSULE.y + y, w: CAPSULE.w, d: CAPSULE.d, r: CAPSULE.r };
    const badKey = !pose.key;
    const svg = [
      `<path class="iso-halo" d="${k.haloOf(k.insetPlan(plan, 1), z - 0.2, 0.1, P)}" style="filter:blur(2.5px);opacity:.5"/>`,
      k.solidSvg(k.slabOf(plan, z, CAPSULE_H, P, 6, 0.6), { tone: "hi", lit: true, crease: "lo" }),
      k.lineSvg(k.sideSeam(plan, z + CAPSULE_H * 0.45, P, 6), { tone: "faint" }),
      k.solidSvg(k.slabOf({ x: x - 3.4, y: y - 2.2, w: 6.8, d: 4.4, r: 1 }, z + CAPSULE_H, 1.4, P, 3), { tone: badKey ? "lo" : "hi", crease: badKey ? "faint" : "lo" }),
      badKey ? k.lineSvg(k.planOutline({ x: x - 3.4, y: y - 2.2, w: 6.8, d: 4.4, r: 1 }, z + CAPSULE_H + 1.4, P, 3), { tone: "lo", dashed: true }) : "",
    ].join("");
    put("capsule", svg, [x, y, z + 3], 0.5);
  } else put("capsule", "", [SX.client, 0, BED_TOP]);

  // the terminal: its keys light while the client is sending, and a cursor blinks
  const sending = acting("client");
  const term = { x: SX.client - 24, y: -44 };
  const keys = k.dotGrid(term.x + 7, term.y + 6.5, 9, 3, 4, BED_Z + 20.4, P);
  const lit = sending === null ? [] : keys.filter((_, i) => i < Math.floor(sending * 27));
  put("keys", k.dotsSvg(keys, { size: 0.5, tone: "lo" }) + (lit.length ? k.dotsSvg(lit, { size: 0.6, tone: "hi" }) : ""), [term.x + 24, term.y + 10, BED_Z + 21], 1);
  // the reel: spokes that turn one notch per token as the stream arrives
  const reelA = (pose.tokensOut * 0.35) % (Math.PI * 2);
  const reel = k.radialTicks(SX.client - 6, TAPE_Y, 6.4, 6, 1, BED_Z + 12.2, [5.2, 5.2], P, reelA, Math.PI * 2);
  put("reel", k.lineSvg(reel.major, { tone: pose.tokensOut > 0 && pose.step.kind === "decode" ? "hi" : "mid", free: true }), [SX.client - 6, TAPE_Y, BED_Z + 13], 1);

  // the resolver lamp
  put("dnsLamp", lamp(k, P, SX.dns - 6, -30, BED_Z + 14, { on: acting("dns") !== null }), [SX.dns - 6, -30, BED_Z + 15], 1);

  // the airlock doors: two slabs that drop from the lintel while TLS is negotiated
  const tls = acting("tls");
  const drop = tls === null ? 0 : pulse(tls) * 9;
  for (const [side, y, bias] of [["doorBack", -4.5, -0.5], ["doorFront", 4.5, 0.5]]) {
    const plan = { x: SX.tls - 2.2, y: y - 3.8, w: 4.4, d: 7.6, r: 0.6 };
    put(side, k.solidSvg(k.slabOf(plan, BED_Z + 24 - drop, 9, P, 2, 0.3), { tone: tls === null ? "mid" : "hi", lit: tls !== null, crease: "faint" }), [SX.tls, y, BED_Z + 24 - drop + 4], bias);
  }
  put("certLamp", lamp(k, P, SX.tls, -33, BED_Z + 11, { on: tls !== null && pose.step.tls }), [SX.tls, -33, BED_Z + 12], 1);

  // the turnstile: four vanes on the post over the bed, turning a quarter when a key is accepted
  const keyAct = acting("key");
  const accepted = keyAct !== null && pose.step.keyOk;
  const rejected = keyAct !== null && pose.step.reject === "401";
  const turn = accepted ? smoothstep((keyAct - 0.25) / 0.6) * (Math.PI / 2) : rejected ? Math.sin(Math.PI * keyAct) * 0.08 : 0;
  const vanes = [0, 1, 2, 3].map((i) => {
    const a = turn + i * (Math.PI / 2) + Math.PI / 2;
    const ring = [[0, -1.2], [14, -1.2], [14, 1.2], [0, 1.2]].map(([u, v]) => [SX.key + Math.cos(a) * u - Math.sin(a) * v, -13 + Math.sin(a) * u + Math.cos(a) * v]);
    return k.solidSvg(k.extrude(ring, BED_Z + 25, 2.6, P), { tone: keyAct === null ? "mid" : "hi", lit: accepted, crease: "faint" });
  });
  put("vanes", vanes.join("") + k.solidSvg(k.cylinder(SX.key, -13, 3.2, BED_Z + 27.6, 1.6, P, 16), { tone: "mid" }), [SX.key, -13, BED_Z + 26], 1.5);
  put("keyLamp", lamp(k, P, SX.key - 11, -31, BED_Z + 16, { on: accepted }) + lamp(k, P, SX.key + 11, -31, BED_Z + 16, { on: rejected }), [SX.key, -31, BED_Z + 17], 1);
  // the 401 gate in the front wall drops when a request is refused
  const gateDown = (id) => (pose.dropping && pose.at === id ? 1 : rejected && id === "key" ? smoothstep((keyAct - 0.5) / 0.4) : 0);
  const wallAt = (id, name, down) => {
    const x0 = Math.floor((SX[id] - TRACK.from) / 36) * 36 + TRACK.from;
    const plan = { x: x0, y: 8, w: 36.4, d: 2.4, r: 0.5 };
    const h = (WALL_TOP - BED_Z) * (1 - down) + 0.6;
    put(name, k.solidSvg(k.slabOf(plan, BED_Z, h, P, 2), { tone: "mid", crease: "faint" }), [x0 + 18, 8.2, BED_Z + h / 2], 3);
  };
  wallAt("key", "gate401", gateDown("key"));

  // the carousel ring: the outlet marks and 36 ticks turn to put the matched route in line
  const routeAct = acting("route");
  const spin = routeAct === null ? 0 : (1 - smoothstep(routeAct / 0.8)) * (Math.PI / 2);
  const ticks = k.radialTicks(SX.route, 0, 26, 36, 9, BED_TOP, [1.4, 3], P, spin, Math.PI * 2);
  const marks = [0, 1, 2].map((i) => {
    const a = spin + i * (Math.PI * 2 / 3) + Math.PI / 2; // mark 0 points to +x when spin is 0
    const [mx, my] = [SX.route + Math.cos(a) * 21, Math.sin(a) * 21];
    return k.solidSvg(k.slabOf({ x: mx - 2.4, y: my - 2.4, w: 4.8, d: 4.8, r: 1.2 }, BED_TOP, 1.6, P, 3), { tone: i === 0 ? "hi" : "mid", lit: i === 0 && routeAct !== null, crease: "faint" });
  });
  put("carousel", k.lineSvg(ticks.minor, { tone: "lo" }) + k.lineSvg(ticks.major, { tone: "mid" }) + marks.join(""), [SX.route, 0, BED_TOP], -4);
  put("routeLamp", lamp(k, P, SX.route - 10, -37, BED_Z + 12, { on: routeAct !== null }) + lamp(k, P, SX.route + 10, -37, BED_Z + 12, { on: false }), [SX.route, -37, BED_Z + 13], 1);

  // the meter: needle at the hour's count, digits in the window, the 429 gate
  const share = pose.counter / PRESET.tokenLimitPerHour;
  put("needle", needle(k, P, SX.meter, -34, BED_Z + 21, 13, share), [SX.meter, -34, BED_Z + 22], 2);
  put("counter", counterWindow(k, P, SX.meter - 9, -20, BED_Z + 13, 18, 5.6, String(pose.counter).padStart(3, "0"), { tone: pose.counter >= PRESET.tokenLimitPerHour ? "lit" : "hi" }), [SX.meter, -20, BED_Z + 10], 1.5);
  const meterAct = acting("meter");
  const over = meterAct !== null && pose.step.reject === "429";
  wallAt("meter", "gate429", pose.dropping && pose.at === "meter" ? 1 : over ? smoothstep((meterAct - 0.5) / 0.4) : 0);
  put("meterLamp", lamp(k, P, SX.meter - 16, -24, BED_Z + 16, { on: meterAct !== null && !over }) + lamp(k, P, SX.meter + 16, -24, BED_Z + 16, { on: over }), [SX.meter, -24, BED_Z + 17], 1);

  // the selector arm: swings from its rest to point at pod 1 and holds while the request is served
  const pickAct = acting("pick");
  const served = act && act.station === "gpu";
  const armShare = pickAct !== null ? smoothstep(pickAct / 0.7) : served ? 1 : 0;
  const armA = -Math.PI * 0.42 + armShare * (Math.PI * 0.42 + Math.PI * 0.5); // rest points back-left; picked points at +y (over the bed)
  const tip = [SX.pick + Math.cos(armA) * 18, -16 + Math.sin(armA) * 18];
  put("arm", k.lineSvg(k.lineOnTop([SX.pick, -16], tip, BED_Z + 25.2, P), { tone: armShare > 0.9 ? "lit" : "hi", free: "end" }) + k.dotsSvg([k.iso([SX.pick, -16, BED_Z + 25.2], P)], { size: 0.7, tone: "hi" }) + k.solidSvg(k.cylinder(tip[0], tip[1], 1.4, BED_Z + 24.4, 1.6, P, 10), { tone: "hi" }), [tip[0], tip[1], BED_Z + 25], 2);

  // the GPU: fan spokes spin while vLLM works; a progress bar on the front shows prefill then decode
  const fan = extra.fan || 0;
  const spokes = k.radialTicks(GPU.lintel.x + 38, 0, 11, 7, 1, BED_Z + 40.2, [8.5, 8.5], P, fan, Math.PI * 2);
  put("fan", k.lineSvg(spokes.major, { tone: served ? "hi" : "mid", free: true }) + k.solidSvg(k.cylinder(GPU.lintel.x + 38, 0, 2.2, BED_Z + 40, 1.2, P, 12), { tone: "hi" }), [GPU.lintel.x + 38, 0, BED_Z + 41], 6);
  const progress = pose.step.kind === "decode" ? pose.u : pose.step.kind === "done" ? 1 : pose.step.prefill ? pose.u * 0.25 : 0;
  const barPlane = k.sideMatrix([GPU.lintel.x + 10, GPU.lintel.y + GPU.lintel.d], BED_Z + 30, P, "left");
  const bar = `<g transform="${barPlane}"><path class="iso-line" data-tone="lo" d="M0 0H56V-3H0Z"/>${progress > 0 ? `<path class="iso-line" data-tone="lit" d="M0.8 -1.5H${(0.8 + 54.4 * progress).toFixed(1)}" style="stroke-width:1.6"/>` : ""}</g>`;
  put("bar", bar, [GPU.lintel.x + 38, GPU.lintel.y + GPU.lintel.d, BED_Z + 31], 6);

  // the tape: one tick per token, pushed along the groove from the GPU mouth toward the reel
  const n = pose.step.kind === "done" || pose.step.kind === "decode" ? pose.tokensOut : 0;
  const pitch = 4.2;
  const start = GPU.front.x + 8, end = SX.client + 6;
  const ticksOut = [];
  for (let i = 0; i < n; i++) {
    const x = start - (n - i) * pitch;
    if (x < end) break;
    ticksOut.push(k.lineOnTop([x, TAPE_Y - 2.2], [x, TAPE_Y + 2.2], BED_Z + 0.8, P));
  }
  const tapeLine = n > 0 ? k.lineOnTop([Math.max(end, start - n * pitch), TAPE_Y], [start, TAPE_Y], BED_Z + 0.7, P) : "";
  put("tape", (tapeLine ? k.lineSvg(tapeLine, { tone: "hi" }) : "") + (ticksOut.length ? k.lineSvg(ticksOut.join(""), { tone: "lit" }) : ""), [SX.route, TAPE_Y, BED_Z + 1], -300);

  // the console: the Instance card slides into its slot, the reconciler wheel turns, four lamps light in order
  const prov = pose.provision;
  const stage = prov ? prov.index : 5;
  const cardIn = prov && prov.index === 0 ? smoothstep(prov.share) : 1;
  const card = { x: CONSOLE.x + 8, y: CONSOLE.y + 7 - (1 - cardIn) * 10, w: 18, d: 2.4, r: 0.5 };
  put("card", k.solidSvg(k.slabOf(card, BED_Z + 34, 7 + (1 - cardIn) * 6, P, 2, 0.3), { tone: "hi", lit: stage === 0, crease: "lo" }), [card.x + 9, card.y + 1.2, BED_Z + 38], 2);
  const wheelA = prov && (prov.index === 1 || prov.index === 2) ? (prov.index - 1 + prov.share) * Math.PI * 1.5 : 0;
  const wheel = k.radialTicks(CONSOLE.x + 50, CONSOLE.y + 26, 7.2, 12, 3, BED_Z + 36.6, [1.4, 3], P, wheelA, Math.PI * 2);
  put("wheel", k.solidSvg(k.cylinder(CONSOLE.x + 50, CONSOLE.y + 26, 8.5, BED_Z + 34, 2.4, P, 28), { tone: stage === 1 || stage === 2 ? "hi" : "mid", lit: stage === 1 || stage === 2 }) + k.lineSvg(wheel.minor, { tone: "lo" }) + k.lineSvg(wheel.major, { tone: "mid" }) + k.dotsSvg([k.iso([CONSOLE.x + 50, CONSOLE.y + 26, BED_Z + 36.4], P)], { size: 0.5, tone: "hi" }), [CONSOLE.x + 50, CONSOLE.y + 26, BED_Z + 36], 2);
  const lamps = [0, 1, 2, 3].map((i) => lamp(k, P, CONSOLE.x + 10 + i * 7, CONSOLE.y + 27, BED_Z + 34, { on: stage > 3 || (stage === 3 && prov.share > i * 0.22) }));
  put("consoleLamps", lamps.join("") + lamp(k, P, CONSOLE.x + 10 + 4 * 7, CONSOLE.y + 27, BED_Z + 34, { on: stage >= 5 }), [CONSOLE.x + 24, CONSOLE.y + 27, BED_Z + 35], 2);
  // while weights load, the GPU's front bar fills slowly as a loading bar
  if (prov && prov.index === 4) {
    const load = `<g transform="${barPlane}"><path class="iso-line" data-tone="lo" d="M0 0H56V-3H0Z"/><path class="iso-line" data-tone="hi" d="M0.8 -1.5H${(0.8 + 54.4 * prov.share).toFixed(1)}" style="stroke-width:1.6"/></g>`;
    items[items.findIndex((it) => it.name === "bar")].svg = load;
  }
  return items;
}

// Every block, named, with one line on what it is. Drawn flat over the figure:
// a pin on the part, a vertical leader, the name and the line. `row` staggers
// neighbours so the labels never collide; `below` hangs a label under the front.
const LABELS = [
  { id: "console", n: "09", name: "OPENEVEREST", line: "Instance → provider-kserve → KServe", at: [CONSOLE.x + CONSOLE.w - 8, CONSOLE.y + 4, BED_Z + 34] },
  { id: "client", n: "01", name: "CLIENT", line: "POST /v1/chat/completions", at: [SX.client + 18, -42, BED_Z + 18] },
  { id: "dns", n: "02", name: "LOAD BALANCER", line: "nip.io DNS → Envoy proxy :443", at: [SX.dns, -36, BED_Z + 14] },
  { id: "tls", n: "03", name: "ENVOY GATEWAY", line: "TLS · cert-manager certificate", at: [SX.tls, -40, BED_Z + 11] },
  { id: "key", n: "04", name: "API KEY CHECK", line: "SecurityPolicy · key of chat-app", at: [SX.key, -42, BED_Z + 16] },
  { id: "route", n: "05", name: "AGENT ROUTER", line: "AI Gateway · routes by model name", at: [SX.route, -44, BED_Z + 12] },
  { id: "meter", n: "06", name: "TOKEN METER", line: "300 tokens / key / hour · Valkey", at: [SX.meter, -46, BED_Z + 16] },
  { id: "pick", n: "07", name: "INFERENCEPOOL", line: "KServe picks a vLLM pod · 1 of 1", at: [SX.pick, -46, BED_Z + 6] },
  { id: "gpu", n: "08", name: "VLLM POD · GPU", line: "Qwen3 0.6B open weights · 1 GPU", at: [GPU.lintel.x + 38, GPU.lintel.y + 2, BED_Z + 38] },
  { id: "bin401", n: "", name: "401 BIN", line: "wrong key · no model is reached", at: [BIN.key.x + 20, BIN.key.y + 25, BED_Z + 12], below: true },
  { id: "bin429", n: "", name: "429 BIN", line: "the hour's 300 tokens are spent", at: [BIN.meter.x + 20, BIN.meter.y + 25, BED_Z + 12], below: true },
  { id: "tape", n: "", name: "TAPE", line: "SSE stream back · one tick per token", at: [SX.client + 30, TAPE_Y + 3, BED_Z + 0.8], below: true },
  { id: "k8s", n: "", name: "KUBERNETES", line: "the whole bench is one cluster", at: [PLATE.x + 24, PLATE.y + PLATE.d - 4, 0], below: true },
];

function labelsSvg(k, P) {
  const edges = {
    back: [k.iso([PLATE.x, PLATE.y, 0], P), k.iso([PLATE.x + PLATE.w, PLATE.y, 0], P)],
    front: [k.iso([PLATE.x, PLATE.y + PLATE.d, -PLATE_H - FOOT_H], P), k.iso([PLATE.x + PLATE.w, PLATE.y + PLATE.d, -PLATE_H - FOOT_H], P)],
  };
  const out = [];
  const obstacles = Object.entries(STATION_PLANS).map(([id, [plan, z0, z1]]) => [id, screenBox(k, P, plan, z0, z1)]);
<<<<<<< HEAD
  for (const label of stripLabels(k, P, LABELS, edges, obstacles, { width: WIDTH, height: HEIGHT, rowStep: 36, rowsBelow: 2, rowStepBelow: 28 })) {
    const { ax, ay, x, ly, leader } = label;
    out.push(k.lineSvg(k.pathOf(leader), { tone: "lo", free: "end" }));
    out.push(k.dotsSvg([[ax, ay]], { size: 1.1, tone: "hi" }));
    out.push(`<text class="iso-label" data-id="${label.id}" data-box="${label.box.map((v) => v.toFixed(1)).join(",")}" x="${x.toFixed(1)}" y="${ly.toFixed(1)}"><tspan class="iso-label-name">${label.n ? label.n + " · " : ""}${label.name}</tspan><tspan class="iso-label-line" x="${x.toFixed(1)}" dy="${(label.lineSize + 1.6).toFixed(1)}">${label.line}</tspan></text>`);
=======
  for (const label of stripLabels(k, P, LABELS, edges, obstacles, { width: WIDTH, height: HEIGHT, rowStep: 44, rowsBelow: 2, rowStepBelow: 26 })) {
    const { ax, ay, x, ly, leader } = label;
    out.push(k.lineSvg(k.pathOf(leader), { tone: "lo", free: "end" }));
    out.push(k.dotsSvg([[ax, ay]], { size: 1.1, tone: "hi" }));
    out.push(`<text class="iso-label" data-id="${label.id}" x="${x.toFixed(1)}" y="${ly.toFixed(1)}"><tspan class="iso-label-name">${label.n ? label.n + " · " : ""}${label.name}</tspan><tspan class="iso-label-line" x="${x.toFixed(1)}" dy="${(label.lineSize + 1.6).toFixed(1)}">${label.line}</tspan></text>`);
>>>>>>> origin/main
  }
  return `<g data-labels>${out.join("")}</g>`;
}

const STATION_PLANS = {
  client: [{ x: SX.client - 24, y: -44, w: 48, d: 30 }, BED_Z, BED_Z + 22],
  dns: [{ x: SX.dns - 16, y: -38, w: 32, d: 22 }, BED_Z, BED_Z + 30],
  tls: [{ x: SX.tls - 14, y: -42, w: 28, d: 60 }, BED_Z, BED_Z + 30],
  key: [{ x: SX.key - 18, y: -44, w: 36, d: 90 }, BED_Z, BED_Z + 30],
  route: [{ x: SX.route - 31, y: -46, w: 62, d: 78 }, BED_Z, BED_Z + 14],
  meter: [{ x: SX.meter - 22, y: -48, w: 44, d: 94 }, BED_Z, BED_Z + 24],
  pick: [{ x: SX.pick - 20, y: -48, w: 40, d: 44 }, BED_Z, BED_Z + 28],
  gpu: [GPU.lintel, BED_Z, BED_Z + 46],
  console: [CONSOLE, BED_Z, BED_Z + 44],
};

const CARD = {
  fig: "Fig 1",
  title: "What happens to an LLM request",
  page: "What happens to an LLM request · the sorting line",
  label: "A sorting line on a bench. A capsule, one chat completion, rides a rail bed past a terminal, a resolver box, an airlock portal, a key turnstile with a 401 bin, a carousel, a token meter with a dial and a 429 bin, and a selector arm, into a GPU arch with fins and a fan. Tokens come back as ticks on a tape along the front. A console at the back built the line.",
  keys: [
    { mark: "lit", label: "The request: one POST /v1/chat/completions, as a capsule on the line" },
    { mark: "raised", label: "The hops: DNS, TLS, API key, route, meter, endpoint picker, vLLM on the GPU" },
    { mark: "edge", label: "The stream back: one tick on the tape per token" },
  ],
  caption: `Every chat completion to the workshop endpoint crosses these machines in this order. The key turnstile and the token meter can refuse it: a wrong key stops at 401, and after ${PRESET.tokenLimitPerHour} tokens in an hour the meter closes with 429. The GPU runs Qwen3 0.6B on one GPU, one replica, a ${PRESET.maxModelLen}-token context; each request here is a ${REQUEST.promptTokens}-token prompt and a ${REQUEST.completionTokens}-token answer.`,
};

export { WIDTH, HEIGHT, PLATE, SX, STATION_PLANS, LABELS, CARD, layout, statics, live, labelsSvg };

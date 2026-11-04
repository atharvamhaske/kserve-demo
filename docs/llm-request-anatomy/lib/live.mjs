// The page runtime, inlined after the kit, the model, the recipes and the
// figure. Expects these globals from the build: P (the projection), FIG
// (the figure module's `live` function), STATION_BOXES (hover regions),
// and the DOM built by the build script.
//
// One loop: advance the tour clock, ask the model for the pose, rebuild the
// live parts, re-sort the layer when depth order changed, write the readout.

const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const layer = svg.querySelector("[data-layer]");
const readout = document.querySelector("[data-readout]");
const phaseLive = document.querySelector("[data-phase-live]");
const storyNow = document.querySelector("[data-story-now]");
const storyWhat = document.querySelector("[data-story-what]");
const storyWatch = document.querySelector("[data-story-watch]");
const still = matchMedia("(prefers-reduced-motion: reduce)");

const nodes = [...layer.children].map((el) => ({ el, key: Number(el.dataset.k), name: el.dataset.live || null, svg: null }));
const byName = Object.fromEntries(nodes.filter((n) => n.name).map((n) => [n.name, n]));
let order = nodes.map((n) => n.el);

let clock = 0, touring = !still.matches, visible = false, frame = 0, last = 0, held = false, idleTimer = 0;
let hovered = null, lastPhase = "", lastFocus = null, fanSpin = 0;
const extra = { fan: 0, hovered: null };

function resort() {
  const sorted = [...nodes].sort((a, b) => a.key - b.key).map((n) => n.el);
  if (sorted.every((el, i) => el === order[i])) return;
  const frag = document.createDocumentFragment();
  sorted.forEach((el) => frag.appendChild(el));
  layer.appendChild(frag);
  order = sorted;
}

function draw(pose, dt) {
  extra.fan = fanSpin;
  extra.hovered = hovered;
  const items = FIG.live(k, P, pose, extra);
  for (const item of items) {
    const node = byName[item.name];
    if (!node) continue;
    if (node.svg !== item.svg) { node.el.innerHTML = item.svg; node.svg = item.svg; }
    if (node.key !== item.key) { node.key = item.key; node.el.dataset.k = item.key.toFixed(2); }
  }
  resort();
  const text = hovered ? STATION_TEXT[hovered] : pose.readout;
  if (readout.textContent !== text) readout.textContent = text;
  const phase = hovered ? "" : pose.step.kind + (pose.step.station || "") + (pose.request ?? "");
  if (phase !== lastPhase) { lastPhase = phase; if (!hovered) { stage.setAttribute("aria-valuetext", pose.readout); if (phaseLive) phaseLive.textContent = pose.readout; } }
  // highlight the machine the request is at (or the one under the pointer), and its label
  const focus = hovered || focusOf(pose.step);
  if (focus !== lastFocus) {
    lastFocus = focus;
    svg.querySelectorAll("[data-station]").forEach((el) => { if (el.dataset.station === focus) el.setAttribute("data-on", ""); else el.removeAttribute("data-on"); });
    svg.querySelectorAll(".iso-label").forEach((el) => { const mine = el.dataset.id === focus || (focus === "key" && el.dataset.id === "bin401" && pose.step.reject) || (focus === "meter" && el.dataset.id === "bin429" && pose.step.reject); if (mine) el.setAttribute("data-on", ""); else el.removeAttribute("data-on"); });
  }
  // the story under the card follows the step
  const story = hovered ? [STATION_TEXT[hovered].split(" · ")[0], STATION_TEXT[hovered], ""] : storyOf(pose.step);
  if (storyNow && storyNow.textContent !== story[0]) { storyNow.textContent = story[0]; storyWhat.textContent = story[1]; storyWatch.textContent = story[2]; }
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring && !held) clock += dt;
  const pose = poseAt(clock);
  const spinning = pose.acting && pose.acting.station === "gpu";
  if (spinning && !calm) fanSpin += dt * (pose.step.kind === "decode" ? 9 : 5);
  draw(pose, dt);
  frame = visible && (touring || held) ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const show = () => { draw(poseAt(clock), 0); };

new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);

// Interaction: hover holds the tour and names the hop under the pointer;
// arrows step through the lifecycle; Space pauses; Home restarts.
const toViewBox = (event) => {
  const box = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  return [((event.clientX - box.left) / box.width) * vb.width, ((event.clientY - box.top) / box.height) * vb.height];
};
const stationAt = ([x, y]) => {
  let best = null, bestArea = Infinity;
  for (const [id, [x0, y0, x1, y1]] of Object.entries(STATION_BOXES)) {
    if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    const area = (x1 - x0) * (y1 - y0);
    if (area < bestArea) { best = id; bestArea = area; }
  }
  return best;
};
const resumeLater = () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => { held = false; hovered = null; touring = !still.matches; run(); }, 3600); };
stage.addEventListener("pointermove", (event) => {
  const id = stationAt(toViewBox(event));
  if (id !== hovered) { hovered = id; held = !!id; show(); }
  if (id) resumeLater(); else { clearTimeout(idleTimer); held = false; run(); }
});
stage.addEventListener("pointerleave", () => { hovered = null; held = false; clearTimeout(idleTimer); show(); run(); });
stage.addEventListener("keydown", (event) => {
  const i = BOUNDARIES.findIndex((at, index) => clock >= at && (index === BOUNDARIES.length - 1 || clock < BOUNDARIES[index + 1]));
  let handled = true;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") clock = BOUNDARIES[(i + 1) % BOUNDARIES.length] + 0.001;
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") clock = BOUNDARIES[(i - 1 + BOUNDARIES.length) % BOUNDARIES.length] + 0.001;
  else if (event.key === "Home") clock = 0;
  else if (event.key === "End") clock = BOUNDARIES[BOUNDARIES.length - 1] + 0.001;
  else if (event.key === " " || event.key === "Enter") { touring = !touring; if (touring) run(); }
  else if (event.key === "Escape") { hovered = null; held = false; touring = !still.matches; }
  else handled = false;
  if (!handled) return;
  event.preventDefault();
  if (event.key !== " " && event.key !== "Enter") { held = false; touring = false; show(); resumeLater(); }
});

if (still.matches) touring = false;
show();
// Hooks for the recorder: step the clock by hand.
window.__anatomy = { seek: (t) => { clock = t; show(); }, step: (dt) => { clock += dt; const pose = poseAt(clock); if (pose.acting && pose.acting.station === "gpu") fanSpin += dt * (pose.step.kind === "decode" ? 9 : 5); draw(pose, dt); }, total: TIMELINE.total, hold: () => { touring = false; held = false; clearTimeout(idleTimer); } };

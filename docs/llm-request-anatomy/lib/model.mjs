// The truth the figures move to: one chat completion through the workshop
// platform, in the order the request really takes, with the real names and
// numbers from docs/open-source-hub-workshop and provider-kserve.
//
// Pure: no DOM, no kit. The build uses it for the first frame, the page for
// every frame, and the recorder for the GIF. Every readout string comes from
// here, so the card can only say what the model says.

// The workshop preset: manifests/instancepreset-qwen-demo-gateway.yaml
const PRESET = {
  instance: "qwen-demo",
  preset: "kserve-qwen-demo-gateway",
  model: "qwen3-0.6b",
  modelURI: "hf://Qwen/Qwen3-0.6B",
  replicas: 1,
  gpus: 1,
  maxModelLen: 2048,
  maxNumSeqs: 1,
  tokenLimitPerHour: 300,
  apiKeyUser: "chat-app",
  host: "<ip-with-dashes>.nip.io",
};

// One request: a 32-token prompt and a 96-token answer, 128 tokens on the
// hourly counter. Decode is slowed to 24 tokens a second so the stream reads.
const REQUEST = { promptTokens: 32, completionTokens: 96, decodePerSecond: 16 };

// The hops, in the order the request crosses them (open-source-hub-workshop/README.md,
// "Component flow"). `station` is the machine part each version builds for it.
const STATIONS = [
  { id: "client", name: "Client", does: "POST /v1/chat/completions · Bearer key · model qwen3-0.6b" },
  { id: "dns", name: "DNS + LoadBalancer", does: "nip.io resolves to the Gateway's LoadBalancer · :443" },
  { id: "tls", name: "Envoy Gateway · TLS", does: "HTTPS terminated with the cert-manager certificate" },
  { id: "key", name: "Envoy Gateway · API key", does: "SecurityPolicy checks the key from InstanceUser chat-app" },
  { id: "route", name: "Envoy AI Gateway · route", does: "reads model, sets x-ai-eg-model, matches the AIGatewayRoute" },
  { id: "meter", name: "Envoy AI Gateway · meter", does: "counts tokens · 300 per key per hour, counters in Valkey" },
  { id: "pick", name: "KServe InferencePool", does: "the endpoint picker chooses a healthy vLLM pod · 1 of 1" },
  { id: "gpu", name: "vLLM on the GPU", does: "Qwen3 0.6B · prefill, then one token at a time · max 2048" },
];
const STATION_INDEX = Object.fromEntries(STATIONS.map((station, index) => [station.id, index]));

// What built the line, before any request (provider-kserve README):
// Instance -> provider-kserve -> LLMInferenceService -> KServe controllers -> objects.
const PROVISION = [
  { id: "instance", label: "Instance qwen-demo", readout: "Instance qwen-demo · from preset " + PRESET.preset },
  { id: "provider", label: "provider-kserve", readout: "provider-kserve reconciles the Instance" },
  { id: "llmisvc", label: "LLMInferenceService", readout: "LLMInferenceService · serving.kserve.io" },
  { id: "objects", label: "Deployment · HPA · Service · Route", readout: "KServe controllers · Deployment, HPA, Service, Route" },
  { id: "weights", label: "weights", readout: "vLLM pulls " + PRESET.modelURI + " onto the GPU" },
  { id: "ready", label: "Ready", readout: "Instance Ready · endpoint written back · 1 of 1 pods" },
];

// The requests the idle tour plays, in order. `key` false sends a bad key.
const TOUR = [
  { key: true, note: "a chat completion" },
  { key: false, note: "the same call with a wrong key" },
  { key: true, note: "a second completion" },
  { key: true, note: "a third, the hour's counter past 256" },
  { key: true, note: "a fourth, refused: 384 of 300 tokens used" },
];

const HOLD = 0.9; // seconds the request rests at a station before the hop acts
const HOP = 1.05;  // seconds to travel between stations

// Build the timeline once: a list of steps with absolute start times.
function timelineOf() {
  const steps = [];
  let t = 0;
  const push = (step) => { step.at = t; t += step.dur; steps.push(step); return step; };

  PROVISION.forEach((stage, index) => push({ kind: "provision", stage: stage.id, index, dur: index === 4 ? 2.8 : 1.6, readout: stage.readout }));
  push({ kind: "idle", dur: 1.2, readout: "ready · waiting for a request" });

  let used = 0; // tokens on the hour's counter
  TOUR.forEach((request, r) => {
    const base = { request: r, key: request.key };
    const travel = (from, to, readout) => push({ ...base, kind: "travel", from, to, dur: HOP, readout });
    const act = (station, dur, readout, extra = {}) => push({ ...base, kind: "act", station, dur, readout, ...extra });

    act("client", HOLD, `POST /v1/chat/completions · ${REQUEST.promptTokens}-token prompt · model ${PRESET.model}`);
    travel("client", "dns", "request leaves the client");
    act("dns", HOLD, `${PRESET.host} → LoadBalancer :443`);
    travel("dns", "tls", "into the Envoy proxy");
    act("tls", 1.4, "TLS · certificate from cert-manager · HTTPS only", { tls: true });
    travel("tls", "key", "to the SecurityPolicy");
    if (!request.key) {
      act("key", 1.3, "401 · key not accepted by the SecurityPolicy", { reject: "401" });
      push({ ...base, kind: "reject", station: "key", code: "401", dur: 1.8, readout: "401 Unauthorized · the request never reaches a model" });
      return;
    }
    act("key", 1.3, `API key ${PRESET.apiKeyUser} · role invoke · accepted`, { keyOk: true });
    travel("key", "route", "to the AI Gateway");
    act("route", 1.4, `model ${PRESET.model} · x-ai-eg-model · AIGatewayRoute matched`, { route: true });
    travel("route", "meter", "to the token meter");
    if (used >= PRESET.tokenLimitPerHour) {
      act("meter", 1.3, `429 · ${used} of ${PRESET.tokenLimitPerHour} tokens this hour`, { reject: "429", used });
      push({ ...base, kind: "reject", station: "meter", code: "429", dur: 1.8, readout: `429 Too Many Requests · quota resets with the hour`, used });
      return;
    }
    act("meter", 1.3, `tokens this hour ${used} of ${PRESET.tokenLimitPerHour} · allowed`, { meter: true, used });
    travel("meter", "pick", "to the InferencePool");
    act("pick", 1.2, `InferencePool · endpoint picker → pod 1 of ${PRESET.replicas}`, { pick: true });
    travel("pick", "gpu", "into the vLLM pod");
    const prefill = 1.4;
    act("gpu", prefill, `prefill · ${REQUEST.promptTokens} tokens · max ${PRESET.maxModelLen}`, { prefill: true, used });
    const decodeDur = REQUEST.completionTokens / REQUEST.decodePerSecond;
    push({ ...base, kind: "decode", station: "gpu", dur: decodeDur, used, readout: null });
    used += REQUEST.promptTokens + REQUEST.completionTokens;
    push({ ...base, kind: "done", station: "gpu", dur: 2.2, used, readout: `data: [DONE] · ${REQUEST.promptTokens + REQUEST.completionTokens} tokens · ${used} of ${PRESET.tokenLimitPerHour} this hour` });
  });
  push({ kind: "reset", dur: 2.4, readout: "a new hour · the token counter returns to 0" });
  return { steps, total: t };
}

const TIMELINE = timelineOf();

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smoothstep = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };

// The state of the whole machine at time `t` (seconds, wrapping round the loop).
function poseAt(time) {
  const t = ((time % TIMELINE.total) + TIMELINE.total) % TIMELINE.total;
  let step = TIMELINE.steps[0];
  for (const candidate of TIMELINE.steps) if (candidate.at <= t) step = candidate;
  const u = clamp01((t - step.at) / step.dur);

  // Where the request is: a station id, a hop {from, to, share}, or nowhere.
  let at = null, hop = null, dropping = null, visible = false;
  let tokensOut = 0, used = step.used ?? 0, phase = step.kind;
  if (step.kind === "travel") { hop = { from: step.from, to: step.to, share: smoothstep(u) }; visible = true; }
  else if (step.kind === "act" || step.kind === "decode" || step.kind === "done") { at = step.station; visible = true; }
  else if (step.kind === "reject") { at = step.station; dropping = { code: step.code, share: smoothstep(u) }; visible = u < 0.92; }
  if (step.kind === "decode") tokensOut = Math.min(REQUEST.completionTokens, Math.floor(u * REQUEST.completionTokens));
  if (step.kind === "done") { tokensOut = REQUEST.completionTokens; }
  if (step.kind === "decode") used = step.used + REQUEST.promptTokens + tokensOut;
  if (step.kind === "done") used = step.used;
  // the counter on the dial: prompt tokens land at the meter, output tokens as they decode
  const counter = step.kind === "decode" || step.kind === "done" ? used : step.kind === "act" && step.station === "gpu" ? step.used + REQUEST.promptTokens : step.used ?? (step.kind === "reset" ? Math.round((1 - smoothstep(u)) * lastUsed()) : 0);

  const readout = step.kind === "decode" ? `decode · ${tokensOut} of ${REQUEST.completionTokens} tokens · ${REQUEST.decodePerSecond} tok/s` : step.readout;
  const provision = step.kind === "provision" ? { index: step.index, share: u } : step.kind === "idle" ? { index: PROVISION.length - 1, share: 1 } : null;
  return {
    t, step, u, phase, at, hop, dropping, visible, tokensOut, counter, readout,
    provisioned: step.kind !== "provision",
    provision,
    key: step.key !== false,
    request: step.request ?? -1,
    // station activity 0..1, for the parts that act
    acting: step.kind === "act" || step.kind === "decode" || step.kind === "done" ? { station: step.station, share: u, step } : null,
  };
}

function lastUsed() {
  let used = 0;
  for (const step of TIMELINE.steps) if (step.used !== undefined) used = Math.max(used, step.used);
  return used;
}

// What the card says under the figure at each step: the hop by name, what it
// does (from the workshop and provider-kserve docs) and what to watch move.
const STORY = {
  provision: [
    ["00 · OpenEverest · Instance", `You create Instance ${PRESET.instance} from the ${PRESET.preset} preset: Qwen3 0.6B, one GPU, one replica, Envoy AI Gateway access and ${PRESET.tokenLimitPerHour} tokens per key per hour.`, "The Instance card goes into the console slot."],
    ["00 · provider-kserve reconciles", "provider-kserve watches Instances whose providerRef is provider-kserve and translates this one into KServe resources. It never manages Pods itself.", "The reconciler wheel turns."],
    ["00 · LLMInferenceService", "The provider writes an LLMInferenceService (serving.kserve.io). From here KServe's own controllers do the work.", "The wheel keeps turning."],
    ["00 · KServe creates the objects", "KServe Standard mode creates a Deployment, an HPA, a Service and the route for the model. Envoy AI Gateway gets an AIGatewayRoute for qwen3-0.6b.", "Four lamps light, one per object."],
    ["00 · vLLM loads the weights", `The pod pulls ${PRESET.modelURI} and vLLM loads it onto the GPU with a ${PRESET.maxModelLen}-token context and 20% of GPU memory.`, "The bar on the GPU fills as the weights load."],
    ["00 · Ready", `provider-kserve writes the phase and the endpoint back onto the Instance: Ready, https://${PRESET.host}/v1. The UI shows the URL and the API-key dialog.`, "The Ready lamp lights. The line is open."],
  ],
  idle: ["Ready", "The platform waits. Nothing runs until a client calls the endpoint.", ""],
  client: ["01 · Client", `Your app sends POST /v1/chat/completions with Authorization: Bearer <key> and model: ${PRESET.model}. The body is a ${REQUEST.promptTokens}-token prompt. Any OpenAI client works unchanged.`, "The capsule is loaded at the terminal."],
  dns: ["02 · DNS + LoadBalancer", `${PRESET.host} resolves to the Gateway's LoadBalancer IP. Port 443 is the only listener for models; port 80 answers ACME challenges and nothing else.`, "The resolver lamp lights."],
  tls: ["03 · Envoy Gateway · TLS", "Envoy terminates HTTPS with the certificate cert-manager issued for the Gateway. API keys are accepted only over TLS. Inside the cluster the request continues as plain HTTP.", "The airlock doors drop and lift."],
  key: ["04 · API key check", `A SecurityPolicy on the Gateway checks the Bearer key. The key came from InstanceUser ${PRESET.apiKeyUser} (the User Management plugin), is stored in a Secret, and allows only this model (role invoke).`, "The turnstile turns a quarter."],
  key401: ["04 · 401 Unauthorized", "The key is unknown or belongs to another model. Envoy answers 401 before the request reaches any model, so a bad key costs no GPU time.", "The gate drops and the capsule falls into the 401 bin."],
  route: ["05 · Agent Router (Envoy AI Gateway)", `The AI Gateway reads the OpenAI model field, sets x-ai-eg-model: ${PRESET.model} and matches the AIGatewayRoute for that model. Other models on the same endpoint have their own routes.`, "The carousel turns to put the matching route in line."],
  meter: ["06 · Token meter", `The Gateway meters tokens per key and per model (gen_ai_client_token_usage) and checks the hourly limit, ${PRESET.tokenLimitPerHour} tokens per key, with counters in Valkey. Without Valkey the limit is not enforced.`, "The dial shows this hour's count so far."],
  meter429: ["06 · 429 Too Many Requests", `This key has already spent more than its ${PRESET.tokenLimitPerHour} tokens this hour, so the Gateway refuses the request before it reaches vLLM. The counter resets with the hour.`, "The gate drops and the capsule falls into the 429 bin."],
  pick: ["07 · KServe InferencePool", `The route's backend is a KServe InferencePool. Its endpoint picker chooses a healthy vLLM pod; here there is one replica, so pod 1 of ${PRESET.replicas}.`, "The selector arm swings to pod 1."],
  prefill: ["08 · vLLM · prefill", `vLLM reads the whole ${REQUEST.promptTokens}-token prompt in one pass on the GPU and fills the KV cache. Then it generates.`, "The fan spins up and the bar starts."],
  decode: ["08 · vLLM · decode", "One token per forward pass over all 0.6B parameters, streamed back as SSE data: chunks through the same Gateway. The client reads them as they arrive.", "Ticks run along the tape toward the client."],
  done: ["08 · data: [DONE]", `${REQUEST.completionTokens} tokens generated. The Gateway adds ${REQUEST.promptTokens + REQUEST.completionTokens} tokens (prompt + completion) to this key's hourly counter and to the metrics.`, `The dial moves up by ${REQUEST.promptTokens + REQUEST.completionTokens}.`],
  reset: ["A new hour", `The quota is per key per hour. When the hour rolls over the counter returns to 0 and ${PRESET.apiKeyUser} can call again.`, "The dial winds back to zero."],
};
function storyOf(step) {
  if (step.kind === "provision") return STORY.provision[step.index];
  if (step.kind === "idle") return STORY.idle;
  if (step.kind === "reset") return STORY.reset;
  if (step.kind === "travel") { const next = storyOf({ kind: "act", station: step.to, key: step.key }); return ["→ " + next[0], next[1], next[2]]; }
  if (step.kind === "decode") return STORY.decode;
  if (step.kind === "done") return STORY.done;
  if (step.kind === "reject") return step.code === "401" ? STORY.key401 : STORY.meter429;
  if (step.station === "key") return step.reject ? STORY.key401 : STORY.key;
  if (step.station === "meter") return step.reject ? STORY.meter429 : STORY.meter;
  if (step.station === "gpu") return STORY.prefill;
  return STORY[step.station];
}
// Which station is "on" during a step, for the highlight.
function focusOf(step) {
  if (step.kind === "provision" || step.kind === "idle") return "console";
  if (step.kind === "reset") return "meter";
  if (step.kind === "travel") return step.to;
  return step.station;
}

// The step boundaries, for stepping through with the keyboard.
const BOUNDARIES = TIMELINE.steps.map((step) => step.at);

export { PRESET, REQUEST, STATIONS, STATION_INDEX, PROVISION, TOUR, TIMELINE, BOUNDARIES, STORY, poseAt, storyOf, focusOf, smoothstep, clamp01 };

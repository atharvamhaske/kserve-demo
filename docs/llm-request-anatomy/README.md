# What happens to an LLM request

Animated isometric figures of one chat completion crossing the workshop platform: DNS and the LoadBalancer, Envoy Gateway with TLS and the API-key SecurityPolicy, Envoy AI Gateway (Agent Router) routing by model name, the token meter, KServe's InferencePool and endpoint picker, and vLLM on the GPU. Each figure also shows how the line was built, from the Instance to the KServe objects, and what a wrong key (401) and a spent quota (429) look like.

The figures are built with the [Anatomy](https://github.com/wheresryan22/anatomy) skill's kit (MIT, vendored in `kit/`): real machines drawn as solids in painter's order, one lit part the reader should watch, a card with a live readout, calm time-based motion, keyboard and pointer control, and reduced-motion support.

## The three versions

| Figure | Object | Page |
|---|---|---|
| Fig 1 · the sorting line | A rail bed on a bench. The request is a capsule that rides past a terminal, a resolver, an airlock (TLS), a key turnstile with a 401 bin, a carousel (the router), a token meter with a dial and a 429 bin, and a selector arm, into a GPU arch. Tokens come back as ticks on a tape. | `export/v1-pneumatic-post.html` |
| Fig 2 · the rack | A 19-inch rack seen from the front, one unit per hop from the top down, a laptop on a side table, a 2U GPU server with two fans at the bottom. The request is a bead on the front cable. | `export/v2-rack.html` |
| Fig 3 · the plan view | Fig 1 from above, for slides and small screens. Generated from Fig 1's source with a top-down camera. | `export/v3-plan.html` |

Every page has a dark and a light build (`-light.html`) and a dark/light switch at the top. Each loops through one run: the platform coming up (Instance, provider-kserve, LLMInferenceService, the KServe objects, the weights loading, Ready), then four requests: a completion, the same call with a wrong key (401), two more completions, and a fourth refused with 429 once the hour's 300 tokens are spent, then a new hour. The panel under the card changes at every step and names the hop, what it does and what to watch.

Hover a machine to read what it is; the arrow keys step through the lifecycle; Space pauses; Home restarts; Escape resumes the tour.

## Exports

`export/` holds, per figure:

- `<name>.html` and `<name>-light.html`, the standalone pages (no network needed; the kit is inlined).
- `<name>.mp4`, `<name>.webm` and `<name>.gif`, the whole loop recorded frame by frame, and `<name>.png`, a poster frame.
- `index.html`, a gallery of all figures with their recordings.
- `artifact/<name>.html`, the page as a claude.ai artifact body.

## Run it

```bash
cd docs/llm-request-anatomy
npm run build     # the six pages and the gallery
npm run serve     # http://localhost:4173/ (PORT=… or --port to change)
```

`npm run record` re-records the MP4, WebM, GIF and poster for every figure (needs Playwright and ffmpeg; about 5 minutes per figure). `npm run check` runs the kit's line-end check on every page. `node scripts/capture.mjs export/v1-pneumatic-post.html --out shot.png --wait 30000` takes a still at a moment of the tour.

## How it is built

- `lib/model.mjs` is the truth: the workshop preset (`manifests/instancepreset-qwen-demo-gateway.yaml`), the hop order from the workshop README's component flow and provider-kserve's `ai-gateway-setup.md`, the timeline of the tour, and the story the card tells at each step. Everything on screen is computed from it, in the build and in the page.
- `lib/draw.mjs` holds the shared recipes (base plate, housings, lamps, dials, label layout) and `lib/live.mjs` the page runtime (one loop, depth re-sorting, hover, keys, reduced motion).
- `v1-pneumatic-post/figure.mjs` and `v2-rack/figure.mjs` describe the machines: `layout` (camera), `statics` (parts that never move), `live` (parts rebuilt each frame), the labels and the card. `v3-plan/build.mjs` generates its figure from Fig 1.
- `scripts/build-figure.mjs` builds a figure folder into a page; `scripts/record.mjs` drives the page's clock by hand through Playwright and encodes the frames with ffmpeg; `scripts/artifact.mjs` turns a page into an artifact body; `scripts/capture.mjs`, `drive.mjs` and `lines.mjs` are the kit's own checks.

Numbers in the figures that come from the docs: Qwen3 0.6B from `hf://Qwen/Qwen3-0.6B`, one GPU, one replica, a 2048-token context, 20% of GPU memory, 300 tokens per key per hour with counters in Valkey, the API key of InstanceUser `chat-app` with role `invoke`, HTTPS only on port 443 with port 80 for ACME. The request itself (a 32-token prompt, a 96-token answer at 16 tokens per second) is an example sized to be watchable.

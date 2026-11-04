# What Actually Happens When You Send an LLM Request to Kubernetes?

This is a 5-minute lightning talk deck. It is seven 16:9 slides with hand-drawn diagrams.

DevCon India VIII / FOSSASIA OTS 2026, Mumbai. Thursday 5 Nov 2026, 16:05 IST, OTS Main Stage, CLS Lightning Talk. Speaker: Atharva Mhaske.

## Exports

| File | Use |
|---|---|
| `export/llm-request-to-kubernetes.pptx` | Present from PowerPoint, Keynote or Google Slides. Speaker notes and timings are on every slide. |
| `export/llm-request-to-kubernetes.pdf` | Backup for the stage laptop. Text is vector, so it stays sharp on big screens. |
| `export/png/slide-01.png` … `slide-07.png` | One 3840×2160 image per slide. |
| `export/excalidraw/slide-02.excalidraw` … `slide-07.excalidraw` | The diagram shapes and text, editable at excalidraw.com. Logos and icons are not included. |

## Slides

| # | Time | Slide | Takeaway |
|---|---|---|---|
| 1 | 0:00–0:15 | Title, the official title slide, unchanged | |
| 2 | 0:15–0:55 | The problem: `/v1/chat/completions` goes into a cluster nobody can see into | 404, hang, 504, 429 |
| 3 | 0:55–1:50 | The path: Client, DNS + Service, Gateway, Model proxy, scale from 0, vLLM (GPU) or Ollama (CPU) Pod, tokens streamed back | It's never one Pod. |
| 4 | 1:50–2:50 | Where it breaks: each failure marked on the same path | Every one looks like "the model is broken." |
| 5 | 2:50–3:55 | How OpenEverest solved it: Instance, provider-kserve, LLMInferenceService / InferenceService, KServe controllers, with status written back | Declare intent. Get an endpoint back. |
| 6 | 3:55–4:40 | Same hops, any stack: KServe, KubeAI and hand-rolled | Map the path, not the brand. |
| 7 | 4:40–5:00 | Thank you, with the speaker-page QR code, handle and Gateway of India sketch | |

## Style

- Background: a lavender-white gradient from `#F4F2FF` to `#E9E6FB`, with a faint halftone in one corner.
- Colours: violet `#7C3AED`, deep `#5B21B6`, soft `#C4B5FD`, text `#1E1B2E`.
- Font: Poppins only. Headlines are 60 px Bold and body text is at least 20 px on a 1920×1080 canvas.
- Diagrams use [rough.js](https://roughjs.com), the sketch engine behind Excalidraw. They follow the [hand-drawn-diagrams](https://github.com/nexu-io/open-design/tree/main/skills/hand-drawn-diagrams) skill rules: one idea per diagram, 1–5 word labels, and arrows attached to the boxes they connect. Each scene passes the skill's `validate_excalidraw.py` with 0 errors.
- Every content slide has the DevCon VIII logo top-left, `MUMBAI, INDIA · 5 NOV 2026` top-right, and the FOSSASIA, OTS and OpenEverest logos bottom-left.

## Assets

- `src/assets/brand/`: the title slide, plus the DevCon VIII logo, FOSSASIA + OTS logos and speaker photo cut from it with `scripts/prep_brand_assets.py`. Also the speaker-page QR code.
- `src/assets/k8s/`: the official Kubernetes icons from [kubernetes/community](https://github.com/kubernetes/community/tree/master/icons).
- `src/assets/logos/`: the Kubernetes, KServe, vLLM, Ollama, FOSSASIA and OpenEverest (brand kit) logos.
- `src/assets/fonts/`: Poppins, under the SIL Open Font License (`OFL.txt`).

To use the official Gateway of India artwork on slide 7, save it as `src/assets/brand/devcon-8-india-bg.png` and rebuild. The build uses that file in place of the hand-drawn sketch.

## Rebuild

```bash
cd docs/devcon-india-2026-lightning-talk
python3 scripts/prep_brand_assets.py   # only if the title slide changes
node scripts/build.js                  # PNG, PDF and Excalidraw sources (needs Playwright)
python3 scripts/make_pptx.py           # PPTX with speaker notes (needs python-pptx)
```

The slide source is `src/slides.html`. You can open it directly in a browser.

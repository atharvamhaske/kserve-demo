# What actually happens when you send an LLM request to Kubernetes?

This is the deck for a 5-minute lightning talk at DevCon India VIII / FOSSASIA OTS 2026 in Mumbai. The talk is on Thursday 5 Nov 2026 at 16:05 IST on the OTS Main Stage, in the CLS lightning talk track. The speaker is Atharva Mhaske.

## Exports

| File | Use |
|---|---|
| `export/llm-request-to-kubernetes.pptx` | Present from PowerPoint, Keynote or Google Slides. Each slide has speaker notes with its time slot. |
| `export/llm-request-to-kubernetes.pdf` | Backup for the stage laptop. The text is vector, so it stays sharp on a large screen. |
| `export/png/slide-01.png` to `slide-07.png` | One 3840x2160 image per slide. |
| `export/excalidraw/slide-01.excalidraw` to `slide-07.excalidraw` | The diagram shapes and text, which you can edit at excalidraw.com. They don't include logos or icons. |

To open the deck in Google Slides, upload the PPTX to Google Drive and choose Open with Google Slides.

## Slides

| # | Time | Slide | Takeaway |
|---|---|---|---|
| 1 | 0:00-0:15 | Title, name, "Engineer at Cld9.ai" | |
| 2 | 0:15-0:55 | Your app calls `/v1/chat/completions`, the cluster hides DNS, gateway, proxy, autoscaler and Pod, and you get a 404, a hang, a 504 or a 429 | |
| 3 | 0:55-1:50 | Client, DNS + Service, Gateway, Model proxy, scale from zero, then a vLLM (GPU) or Ollama (CPU) Pod streams tokens back | It's never one Pod. |
| 4 | 1:50-2:50 | The same path with each failure marked on its hop | |
| 5 | 2:50-3:55 | The provider-kserve flow. You create an Instance. provider-kserve reconciles it into an LLMInferenceService or InferenceService. The KServe controllers create Deployments, HPAs, Services and Routes. provider-kserve writes the status and endpoint back to the Instance. | Declare intent. Get an endpoint back. |
| 6 | 3:55-4:40 | KServe, KubeAI and a hand-rolled stack on the same four hops | Map the path, not the brand. |
| 7 | 4:40-5:00 | Thank you, with the speaker bio, GitHub handle and photo in front of a Gateway of India sketch | |

## Style

- The background is the DevCon lavender gradient, from `#F4F2FF` to `#E9E6FB`. The only accent colour is violet `#7C3AED`, with `#5B21B6` and `#C4B5FD` as darker and lighter shades. Text is `#1E1B2E`.
- Body text and diagram labels use Inter. Headings, kickers, status codes and API names use Geist Mono. Both fonts follow the `atharva-design` skill.
- The diagrams are drawn with [rough.js](https://roughjs.com), the sketch library that Excalidraw uses. They follow the [hand-drawn-diagrams](https://github.com/nexu-io/open-design/tree/main/skills/hand-drawn-diagrams) rules, which ask for one idea per diagram, labels of 1 to 5 words and arrows attached to the boxes they connect. Every scene passes the skill's `validate_excalidraw.py` with 0 errors.
- The slide text follows the `unslop` skill. It uses straight quotes, has no em dashes and puts sentence case on every heading.
- Every slide has the DevCon VIII logo top-left, `MUMBAI, INDIA · 5 NOV 2026` top-right and the FOSSASIA, OTS and OpenEverest logos bottom-left.

## Assets

- `src/assets/brand/` holds the official title slide. `scripts/prep_brand_assets.py` cuts the DevCon VIII logo, the FOSSASIA and OTS logos and the DevCon diamond artwork out of it, with transparent backgrounds. The folder also holds `speaker-cutout.png` and `speaker-face.png`. Both come from the event photo, with the background removed by [rembg](https://github.com/danielgatis/rembg) using the `u2net_human_seg` model.
- `src/assets/k8s/` holds the official Kubernetes icons from [kubernetes/community](https://github.com/kubernetes/community/tree/master/icons).
- `src/assets/logos/` holds the Kubernetes, KServe, vLLM, Ollama, FOSSASIA and OpenEverest logos. The OpenEverest logo comes from its brand kit.
- `src/assets/fonts/` holds Inter and Geist Mono, both under the SIL Open Font License.

To use the official Gateway of India artwork on slide 7, save it as `src/assets/brand/devcon-8-india-bg.png` and rebuild. The build then uses it in place of the sketch.

## Rebuild

```bash
cd docs/devcon-india-2026-lightning-talk
python3 scripts/prep_brand_assets.py   # only if the title slide changes
node scripts/build.js                  # PNG, PDF and Excalidraw files (needs Playwright)
python3 scripts/make_pptx.py           # PPTX with speaker notes (needs python-pptx)
```

The slide source is `src/slides.html`, which you can also open in a browser.

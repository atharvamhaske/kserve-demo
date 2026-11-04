# What actually happens when you send an LLM request to Kubernetes?

This is the deck for a 5-minute lightning talk at DevCon India VIII / FOSSASIA OTS 2026 in Mumbai. The talk is on Thursday 5 Nov 2026 at 16:15 IST on the OTS Main Stage, in the CLS lightning talk track. The speaker is Atharva Mhaske.

## Exports

| File | Use |
|---|---|
| `export/llm-request-to-kubernetes.pptx` | Present from PowerPoint, Keynote or Google Slides. Each slide has speaker notes with its time slot. |
| `export/llm-request-to-kubernetes.pdf` | Backup for the stage laptop. The text is vector, so it stays sharp on a large screen. |
| `export/png/slide-01.png` to `slide-07.png` | One 3840x2160 image per slide. |
| `export/excalidraw/slide-02.excalidraw` to `slide-06.excalidraw` | The diagrams as Excalidraw scenes, with the icons and logos embedded. Open them at excalidraw.com to edit. |

To open the deck in Google Slides, upload the PPTX to Google Drive and choose Open with Google Slides.

## Slides

| # | Time | Slide | Takeaway |
|---|---|---|---|
| 1 | 0:00-0:15 | Title, speaker photo, name and "Engineer at Cld9.ai" | |
| 2 | 0:15-0:55 | The problem from the talk abstract. Where did this request go? Your app calls `/v1/chat/completions`, the cluster hides DNS, gateway, proxy, autoscaler and Pod, and a 404, a hang, a 504 or a 429 comes back. | Teams debug the symptom because they never mapped the path. |
| 3 | 0:55-1:50 | Client, DNS + Service, Gateway, Model proxy, scale from zero, then a vLLM (GPU) or Ollama (CPU) Pod streams tokens back | It's never one Pod. |
| 4 | 1:50-2:50 | The same path with each failure marked on its hop | |
| 5 | 2:50-3:55 | The provider-kserve flow. You create an Instance. provider-kserve reconciles it into an LLMInferenceService or InferenceService. The KServe controllers create Deployments, HPAs, Services and Routes. provider-kserve writes the status and endpoint back to the Instance. | Declare intent. Get an endpoint back. |
| 6 | 3:55-4:40 | KServe, KubeAI and a hand-rolled stack on the same four hops | Map the path, not the brand. |
| 7 | 4:40-5:00 | Thank you and an invitation to connect, with the speaker bio, GitHub handle and photo | |

## Style

- The background is the DevCon lavender gradient, from `#F4F2FF` to `#E9E6FB`. The only accent colour is violet `#7C3AED`, with `#5B21B6` and `#C4B5FD` as darker and lighter shades. Text is `#1E1B2E`.
- Headings, kickers and the page chrome use Geist Mono, and body text uses Inter, following the `atharva-design` skill. The diagrams and takeaways use Excalifont.
- The diagrams on slides 2 to 6 are real Excalidraw scenes. They follow the [excalidraw-diagram-generator](https://github.com/github/awesome-copilot/tree/main/skills/excalidraw-diagram-generator) skill, so every text element uses Excalifont and every arrow is bound to the shapes it connects. They also follow the [hand-drawn-diagrams](https://github.com/nexu-io/open-design/tree/main/skills/hand-drawn-diagrams) rules of one idea per diagram and labels of 1 to 5 words. `scripts/diagrams.py` writes the scenes and `scripts/render_diagrams.js` renders them to SVG with Excalidraw's own `exportToSvg`, so the slides match excalidraw.com exactly. Every scene passes the hand-drawn-diagrams `validate_excalidraw.py` with 0 errors.
- The slide text follows the `unslop` skill. It uses straight quotes, has no em dashes and puts sentence case on every heading.
- The title slide has the DevCon VIII logo top-left and `MUMBAI, INDIA · 5 NOV 2026` top-right. The other slides leave that space to the content. Every slide has the FOSSASIA, OTS and OpenEverest logos bottom-left.

## Assets

- `src/assets/brand/` holds the official title slide. `scripts/prep_brand_assets.py` cuts the DevCon VIII logo, the FOSSASIA and OTS logos the DevCon diamond artwork and the round speaker photo out of it, with transparent backgrounds. The folder also holds `speaker-cutout.png` for slide 7. It is the speaker's mirror selfie, flipped so the T-shirt text reads correctly, with the background removed by [rembg](https://github.com/danielgatis/rembg). The `u2net_human_seg` model finds the person and `isnet-general-use` keeps the phone.
- `src/assets/k8s/` holds the official Kubernetes icons from [kubernetes/community](https://github.com/kubernetes/community/tree/master/icons).
- `src/assets/logos/` holds the Kubernetes, KServe, vLLM, Ollama, FOSSASIA and OpenEverest logos. The OpenEverest logo comes from its brand kit.
- `src/assets/fonts/` holds Inter and Geist Mono, both under the SIL Open Font License.

## Rebuild

```bash
cd docs/devcon-india-2026-lightning-talk
npm install                            # Excalidraw, React and esbuild, for the diagram renderer
python3 scripts/prep_brand_assets.py   # only if the title slide changes
python3 scripts/diagrams.py            # write the Excalidraw scenes
node scripts/render_diagrams.js        # render them to SVG with Excalidraw (needs Playwright)
node scripts/build.js                  # PNG and PDF
python3 scripts/make_pptx.py           # PPTX with speaker notes (needs python-pptx)
```

`npm run build` runs the last four steps.

The slide source is `src/slides.html`, which you can also open in a browser.

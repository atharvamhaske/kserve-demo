"""Build the 16:9 PPTX from the rendered slide PNGs, with speaker notes.

Usage (from the deck folder, after `node scripts/build.js`):
    python3 scripts/make_pptx.py
"""

from pathlib import Path

from pptx import Presentation
from pptx.util import Emu

ROOT = Path(__file__).resolve().parents[1]
PNG = ROOT / "export" / "png"
OUT = ROOT / "export" / "llm-request-to-kubernetes.pptx"

# Talk track: 5 minutes total. Timings match the plan agreed for the session.
NOTES = [
    "0:00-0:15 · Title\n"
    "Hi, I'm Atharva, an engineer at Cld9.ai. I work on provider-kserve at OpenEverest. "
    "In the next five minutes I'll follow one LLM request through a Kubernetes cluster.",

    "0:15-0:55 · The problem\n"
    "Your app calls /v1/chat/completions. It looks like one HTTP call. "
    "Inside the cluster it passes DNS, a gateway, a proxy, an autoscaler and a Pod. "
    "Platform teams can't see that path, so a 404, a hang, a 504 or a 429 arrives and nobody can say which hop sent it.",

    "0:55-1:50 · The path\n"
    "The client sends an OpenAI-style request. DNS and a Service turn the name into an IP. "
    "The gateway applies TLS, auth, the HTTPRoute and its timeouts. "
    "The model proxy reads the model name and picks a backend. "
    "If no replica is running, the autoscaler starts one first. "
    "A vLLM Pod on a GPU, or an Ollama Pod on a CPU, loads the model, runs inference and streams tokens back as SSE chunks. "
    "It's never one Pod.",

    "1:50-2:50 · Where it breaks\n"
    "A 404 means the client and the gateway disagree on the path, for example a missing /v1 prefix. "
    "A hang means the model is cold, so the request waits for an image pull, a weights download and a GPU load. "
    "A 504 means the gateway's idle timeout closed a long streaming answer. "
    "A 429 means the rate limit counts requests, so one huge prompt costs the same as a tiny one. "
    "Each of these looks like the model is broken.",

    "2:50-3:55 · How OpenEverest solved it\n"
    "You create a model as an Instance in core.openeverest.io, from the UI, the API or kubectl. "
    "provider-kserve reconciles it into a KServe LLMInferenceService or InferenceService. "
    "The KServe controllers create the Deployments, HPAs, Services and Routes. "
    "provider-kserve writes the status and the endpoint back to the Instance, so you get a ready URL. "
    "Declare intent. Get an endpoint back.",

    "3:55-4:40 · Same hops, any stack\n"
    "KServe, KubeAI and a hand-rolled stack all have the same four hops. "
    "Each one has a gateway, model routing, scale from zero and a model Pod. "
    "Only the component names change. Map the path, not the brand.",

    "4:40-5:00 · Thank you\n"
    "I'm Atharva Mhaske, AI and Infra Engineer at Cld9.ai, a former GSoC 2026 mentee and an OpenTelemetry member. "
    "I'm github.com/atharvamhaske. Thank you.",
]


def main() -> None:
    prs = Presentation()
    prs.slide_width, prs.slide_height = Emu(12192000), Emu(6858000)  # 13.333 x 7.5 in
    blank = prs.slide_layouts[6]
    pngs = sorted(PNG.glob("slide-*.png"))
    assert len(pngs) == len(NOTES), f"expected {len(NOTES)} PNGs, found {len(pngs)}"
    for png, note in zip(pngs, NOTES):
        slide = prs.slides.add_slide(blank)
        slide.shapes.add_picture(str(png), 0, 0, prs.slide_width, prs.slide_height)
        slide.notes_slide.notes_text_frame.text = note
    prs.core_properties.title = "What Actually Happens When You Send an LLM Request to Kubernetes?"
    prs.core_properties.author = "Atharva Mhaske"
    prs.save(OUT)
    print("wrote", OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()

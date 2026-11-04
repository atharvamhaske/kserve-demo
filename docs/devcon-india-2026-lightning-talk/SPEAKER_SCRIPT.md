# Speaker script: What Actually Happens When You Send an LLM Request to Kubernetes?

Atharva Mhaske · DevCon India VIII / FOSSASIA OTS 2026 · Mumbai · 5 Nov 2026, 16:05 IST · CLS lightning talk (5:00)

Pace: about 140 words per minute. Times below assume that pace. Lines marked **Hook**, **Punchline** and **Callback** are spoken slowly, with a short pause before them.

---

## Slide 1: Title (0:00–0:18)

*Words: 33 · Estimated speaking time: ~14 s at 140 wpm*

**Do:** Walk to center. Wait one beat. Deliver the hook slowly, one sentence at a time.

**Say:**
> **Hook:** One line of code. Five hops. Four ways to fail. And platform teams can't see any of them.
> Hi, I'm Atharva.
> Today we follow one LLM request into Kubernetes.
> *(pause)* **Punchline:** No magic. Just hops.

---

## Slide 2: Who am I (0:18–0:45)

*Words: 54 · Estimated speaking time: ~23 s at 140 wpm*

**Do:** Click once before each bullet (4 clicks total).

**Say:**
> A little about me.
> *(click)* I'm an AI and Infra Engineer at Cld9.ai.
> *(click)* I was a Google Summer of Code 2026 mentee.
> *(click)* I'm a member of the OpenTelemetry project.
> *(click)* And I love FOSS. I contribute to multiple open source projects under the CNCF, the Cloud Native Computing Foundation.
> *(pause)* **Punchline:** So today, let's open one more box.

---

## Slide 3: The problem (0:45–1:24)

*Words: 82 · Estimated speaking time: ~35 s at 140 wpm*

**Do:** Point at "Your app", then sweep your hand across the dashed box. Point at the red 404, hang, 502 and 429 notes.

**Say:**
> Your app calls slash v1, slash chat, slash completions.
> It looks like one simple call. It is not.
> The request goes into the cluster. Somewhere in there, a Pod runs the model.
> Platform teams can't see the path in between.
> So when a call fails, with a 404, a hang, a 502 or a 429, nobody can explain why.
> You check the Pod. The Pod looks fine. So where did it break?
> *(pause)* **Punchline:** If you can't see the path, you can't fix it.

---

## Slide 4: The path (1:24–2:16)

*Words: 113 · Estimated speaking time: ~48 s at 140 wpm*

**Do:** Point at each box left to right as you say its number. Then trace the dashed "tokens stream back" arrow right to left.

**Say:**
> The client sends the request.
> One. DNS and a Service. A Service is a stable address in front of Pods.
> Two. The Gateway, or Ingress. The front door of the cluster. It handles routes, TLS, which means encryption, and timeouts.
> Three. The model proxy. It reads the model name and sends the request to the right model. KServe, KubeAI or LiteLLM can do this job.
> Four. Scale from zero. If no copy of the model is running, it starts one.
> Five. The model Pod. vLLM on a GPU, or Ollama on a CPU.
> Then the answer streams back as tokens, small pieces of text, the same way.
> *(pause)* **Punchline:** Five hops. It's never one Pod.

---

## Slide 5: Where it breaks (2:16–2:58)

*Words: 90 · Estimated speaking time: ~39 s at 140 wpm*

**Do:** Point at each red note as you name it: Client, the stream arrow, Model proxy, Scale from zero.

**Say:**
> So where does it break? Each hop fails in its own way.
> At the client, a 404. You called the wrong API path.
> On the way back, a long stream. A gateway timeout kills it halfway. The user sees half an answer.
> At the model proxy, rate limits count requests, not tokens. A tiny question and a huge prompt count the same.
> At scale from zero, the model is cold. While it wakes up, your request just hangs. No error. Just waiting.
> *(pause)* **Punchline:** Your error tells you what broke. Not where.

---

## Slide 6: How OpenEverest solved it (2:58–3:51)

*Words: 116 · Estimated speaking time: ~50 s at 140 wpm*

**Do:** Point at the faded path on top, then follow the control loop left to right. Trace the dashed "status, endpoints" arrow back to Instance. Pause before the punchline.

**Say:**
> So how did we solve this at OpenEverest?
> The path stays the same. We added a control loop.
> Instead of wiring each hop yourself, you describe what you want.
> You use the API or UI to create an Instance. One object that says what you want.
> provider-kserve reconciles it into a KServe LLMInferenceService or InferenceService.
> Reconcile means: keep making the real state match what you asked for.
> KServe controllers then create the Deployments, HPAs, Services and Routes. An HPA is the autoscaler. You don't wire these by hand.
> provider-kserve writes the status and the endpoint back to the Instance. Your app gets one endpoint to call. One place to look.
> *(pause)* **Punchline:** Declare intent. Get an endpoint back.

---

## Slide 7: Same hops, any stack (3:51–4:34)

*Words: 91 · Estimated speaking time: ~39 s at 140 wpm*

**Do:** Point at the five hop headers, then run your finger along each row.

**Say:**
> Maybe you don't use KServe. That's fine. Look at the same five hops.
> KServe: a Service, Gateway API or Istio, an LLMInferenceService router, Knative or KEDA to scale, and a vLLM Pod.
> KubeAI: its own Service, your Ingress, a proxy that routes by model name, a built-in autoscaler, and a vLLM or Ollama Pod.
> Hand-rolled: a Service, ingress-nginx, the LiteLLM proxy, the KEDA HTTP add-on, and a vLLM Deployment.
> Different names. Same hops. When something breaks, walk the hops in order. Ask: which hop answered?
> *(pause)* **Punchline:** Map the path, not the brand.

---

## Slide 8: Thank you (4:34–5:00)

*Words: 52 · Estimated speaking time: ~22 s at 140 wpm*

**Do:** Gesture at the QR code. Hold the slide still so people can scan it. Deliver the callback slowly.

**Say:**
> **Callback:** Remember: one line of code, five hops. Now you can see every one of them.
> Thanks to DevCon and FOSSASIA for having me.
> Scan the QR code for my speaker page. Find me after the talk. I'm happy to chat about LLMs on Kubernetes.
> *(pause)* **Punchline:** Now go map your own path. Thank you!

---

## Totals

| Slide | Window | Words | Est. time |
|---|---|---|---|
| 1 Title | 0:00–0:18 | 33 | ~14 s |
| 2 Who am I | 0:18–0:45 | 54 | ~23 s |
| 3 The problem | 0:45–1:24 | 82 | ~35 s |
| 4 The path | 1:24–2:16 | 113 | ~48 s |
| 5 Where it breaks | 2:16–2:58 | 90 | ~39 s |
| 6 How OpenEverest solved it | 2:58–3:51 | 116 | ~50 s |
| 7 Same hops, any stack | 3:51–4:34 | 91 | ~39 s |
| 8 Thank you | 4:34–5:00 | 52 | ~22 s |
| **Total** | | **631** | **~4:30** |

The rest of the 5:00 (about 30 s) goes to pauses, clicks and holding the QR code on screen. Time windows include that slack.

## Cheat sheet (3 lines)

1. An LLM call is a path, not one Pod: Service, Gateway, model proxy, scale from zero, model Pod, then tokens stream back.
2. Each hop fails its own way: 404 on the wrong path, timeouts on long streams, request-count rate limits, cold-start hangs.
3. OpenEverest + provider-kserve: declare intent in an Instance, get an endpoint back. With any stack, map the path, not the brand.

## Hooks & punchlines

- **Opening hook (slide 1, first 10 s):** One line of code. Five hops. Four ways to fail. And platform teams can't see any of them.
- **Slide 1 (Title):** No magic. Just hops.
- **Slide 2 (Who am I):** So today, let's open one more box.
- **Slide 3 (The problem):** If you can't see the path, you can't fix it.
- **Slide 4 (The path):** Five hops. It's never one Pod.
- **Slide 5 (Where it breaks):** Your error tells you what broke. Not where.
- **Slide 6 (How OpenEverest solved it):** Declare intent. Get an endpoint back.
- **Slide 7 (Same hops, any stack):** Map the path, not the brand.
- **Slide 8 (Thank you):** Now go map your own path. Thank you!
- **Closing callback (slide 8, ties to the hook):** Remember: one line of code, five hops. Now you can see every one of them.

## Backup line (if time runs out)

> "One line of code. Five hops. It's never one Pod. Map the path, not the brand. Thank you!"

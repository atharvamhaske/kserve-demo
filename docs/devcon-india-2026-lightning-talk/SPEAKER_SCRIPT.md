# Speaker script: What Actually Happens When You Send an LLM Request to Kubernetes?

Atharva Mhaske · DevCon India VIII / FOSSASIA OTS 2026 · Mumbai · 5 Nov 2026, 16:15 IST · OTS Main Stage · CLS lightning talk

Slot: 5:00 on stage, plus 1:00 buffer. The script below runs about 5:00 at a slow pace (about 130 words a minute, with pauses). The buffer covers the walk to the mic, laughter, and one slow click.

## How to read this

- One line is one breath. Say it, then look up.
- `(pause)` is two seconds. Count them.
- `(click)` is the next slide. Click, then speak.
- Lines marked **[cut]** are the first to go if the clock is late. Skip them and the talk still makes sense.
- Contractions are written out so the lines are easy to scan. Say them the way you talk.
- The last line of each slide is the takeaway. Say it slowly. Then click.

---

## Before you start (slide 1 on screen) · 0:00 to 0:45 · 97 words

**Do:** Walk to the mic. Stop. Look at the room before you say anything.

**Say:**

> Thank you.
> (pause)
> Kasa kay, Mumbai!
> (wait for the room)
> I appreciate you showing up for this talk.
> This is the biggest stage I have ever spoken on. So, thank you for that.
> (pause)
> Quick show of hands.
> Who here has deployed an open LLM on a GPU, with Kubernetes?
> (look around)
> Who has used vLLM, or Ollama?
> (look around)
> And who has had an LLM request fail, and did not know where it failed?
> (look around, smile)
> Keep that last hand up for a second. This talk is for you.
> (pause)
> Hi, I am Atharva.
> In the next five minutes we follow one LLM request into Kubernetes, hop by hop.

*"Kasa kay" is Marathi for "how are you". If the room does not answer, say it once more and move on.*

---

## Slide 2: Who am I · 0:45 to 1:05 · 69 words

**Do:** `(click)`. Keep this short. The room wants the problem, not the bio.

**Say:**

> Two lines about me.
> I am an AI and infra engineer at Cld9.ai.
> I was a Google Summer of Code mentee this year, and I am a member of the OpenTelemetry project.
> I love FOSS, and I contribute to projects under the CNCF.
> **[cut]** One of them is OpenEverest, where I work on provider-kserve. That is LLM serving on Kubernetes.
> (pause)
> That is enough about me. Let us open the box.

---

## Slide 3: The problem · 1:05 to 1:50 · 92 words

**Do:** `(click)`. Point at "Your app" on the left. Sweep your hand across the dashed Kubernetes box. Then point at the four codes on the right.

**Say:**

> Your app calls slash v1, slash chat, slash completions.
> It looks like one call.
> Platform teams ship this fast. Then production asks a basic question.
> (pause)
> Where did this request go?
> Inside the cluster, the request crosses DNS, a gateway, a proxy, an autoscaler, and a Pod.
> Nobody drew that path.
> So when a 404, a hang, a 504, or a 429 comes back, nobody can say which hop sent it.
> You check the Pod. The Pod looks fine.
> (pause)
> Teams debug the symptom, because they never mapped the path.
> Today we map it.

---

## Slide 4: The path · 1:50 to 2:45 · 115 words

**Do:** `(click)`. Point at each box, left to right, as you say its number. At the end, trace the dashed arrow back to the client.

**Say:**

> Here is the whole path. Five hops.
> One. The client. Your app, or an SDK. It sends the request.
> Two. DNS and a Service. The name becomes an address inside the cluster.
> Three. The gateway. The front door. TLS, the route, and the timeouts live here.
> Four. The model proxy. It reads the model name and picks the right backend.
> **[cut]** If no copy of the model runs, it has to scale one up from zero first.
> Five. The model Pod. vLLM on a GPU, or Ollama on a CPU.
> It loads the model, runs the prompt, and streams the answer back, one token at a time, along the same path.
> (pause)
> It is never one Pod.

---

## Slide 5: Where it breaks · 2:45 to 3:30 · 113 words

**Do:** `(click)`. Same picture. Point at each note as you name it: 404 above the gateway, hang above the Pod, 504 and 429 below.

**Say:**

> Same path. Now the failures. Each hop fails in its own way.
> 404. The client and the gateway disagree on the path. Often the slash v1 prefix is missing.
> Hang. The model is cold. The request waits for the image, the weights, and the GPU. No error. Just silence.
> 504. The gateway has an idle timeout. A long stream stops halfway. The user sees half an answer.
> 429. The rate limit counts requests, not tokens. A tiny question and a huge prompt cost the same.
> (pause)
> Every one of these looks like "the model is broken".
> It is not. One hop is.
> (pause)
> Your error tells you what broke. It does not tell you where.

---

## Slide 6: How OpenEverest solved it · 3:30 to 4:15 · 98 words

**Do:** `(click)`. Follow the boxes left to right with your hand. Then trace the dashed "status, endpoints" arrow back to the Instance. Point at the "Ready" line.

**Say:**

> Here is how we solved it in OpenEverest.
> The path stays the same. We added a control loop.
> You create one object. An Instance.
> It says what you want. This model. One GPU. One replica.
> provider-kserve reads the Instance and writes a KServe LLMInferenceService.
> The KServe controllers create the Deployments, the autoscalers, the Services, and the Routes.
> Nobody wires those by hand.
> **[cut]** Reconcile means: keep the real cluster equal to what you asked for.
> Then provider-kserve writes the status and the endpoint back onto the Instance.
> Your app gets one URL. Ready.
> (pause)
> Declare intent. Get an endpoint back.

---

## Slide 7: Same hops, any stack · 4:15 to 4:50 · 90 words

**Do:** `(click)`. Point at the three column headers. Then run your finger down the four rows.

**Say:**

> Maybe you do not use KServe. That is fine. Look at the rows, not the columns.
> Gateway. Envoy AI Gateway, an Ingress, or ingress-nginx.
> Model routing. An InferencePool, a proxy that reads the model field, or one path per model.
> Scale from zero. Knative or KEDA, built in, or an HPA with a minimum of one.
> The model Pod. vLLM, or Ollama.
> Different names. Same four hops.
> When it breaks, walk the hops in order. Ask one question at each: did this hop answer?
> (pause)
> Map the path, not the brand.

---

## Slide 8: Thank you · 4:50 to 5:10 · 49 words

**Do:** `(click)`. Hold the slide still so people can scan the QR code. Say the last line slowly.

**Say:**

> That is the talk.
> One call. Five hops. Now you can see each one.
> Scan the QR code to connect with me on LinkedIn.
> Find me after this. I want to hear how you serve LLMs on Kubernetes.
> Thanks to DevCon and FOSSASIA for the stage.
> (pause)
> Thank you, Mumbai!

---

## Timing

| Part | Window | Words |
|---|---|---|
| Before you start (slide 1) | 0:00 to 0:45 | 97 |
| 2 Who am I | 0:45 to 1:05 | 69 |
| 3 The problem | 1:05 to 1:50 | 92 |
| 4 The path | 1:50 to 2:45 | 115 |
| 5 Where it breaks | 2:45 to 3:30 | 113 |
| 6 How OpenEverest solved it | 3:30 to 4:15 | 98 |
| 7 Same hops, any stack | 4:15 to 4:50 | 90 |
| 8 Thank you | 4:50 to 5:10 | 49 |
| **Total** | **5:10** | **723** |

723 words at 140 words a minute is 5:10 with no pauses. Say the three **[cut]** lines only if you are on time at the end of slide 3 (clock under 1:50). Without them the script is 679 words and lands under 5:00. The buffer minute is for the walk, the show of hands, and applause.

## If the clock is late

| You are at | Clock shows | Do this |
|---|---|---|
| End of slide 3 | more than 1:50 | Drop all **[cut]** lines. |
| End of slide 5 | more than 3:40 | On slide 6, say only: "You create an Instance. provider-kserve turns it into KServe objects. You get an endpoint back. Declare intent, get an endpoint back." |
| End of slide 6 | more than 4:30 | On slide 7, say only: "Different names, same four hops. Map the path, not the brand." |
| Anywhere | 5:30 | Click to slide 8 and say the last three lines. |

## One-breath version (if the laptop dies)

> One call. Five hops. DNS, gateway, proxy, autoscaler, Pod. Each one fails its own way: 404, hang, 504, 429. Map the path, not the brand. Thank you, Mumbai!

## Cheat card (print this)

1. Thanks. Kasa kay, Mumbai. Biggest stage. Three hands: GPU on Kubernetes, vLLM or Ollama, a failure with no known hop.
2. Who am I: Cld9.ai, GSoC 2026, OpenTelemetry, CNCF projects.
3. Problem: one call, five hidden hops, 404 hang 504 429. "Teams debug the symptom."
4. Path: client, DNS and Service, gateway, model proxy, model Pod. "Never one Pod."
5. Breaks: 404 path, hang cold, 504 timeout, 429 tokens. "What broke, not where."
6. OpenEverest: Instance, provider-kserve, LLMInferenceService, KServe objects, endpoint back. "Declare intent."
7. Any stack: gateway, routing, scale, Pod. "Map the path, not the brand."
8. QR, LinkedIn, find me. "Thank you, Mumbai!"

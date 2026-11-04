# Speaker script: What Actually Happens When You Send an LLM Request to Kubernetes?

Atharva Mhaske · DevCon India VIII / FOSSASIA OTS 2026 · Mumbai · 5 Nov 2026, 16:15 IST · OTS Main Stage · CLS lightning talk

Slot: 5:00 on stage, plus 1:00 buffer. Without the **[cut]** lines the script runs 5:02 at 140 words a minute. With them it runs 5:33. The buffer covers the pauses, the show of hands, the walk to the mic, laughter, and one slow click.

## How to read this

- One line is one breath. Say it, then look up.
- `(pause)` is two seconds. Count them.
- `(click)` is one press on the remote. Press, wait for the slide, then speak. Eight slides, seven presses.
- **Laser:** in each **Do** line says where to hold the dot. Hold it still for one second, then switch the laser off and look at the room. Never wave it, and never point it at people.
- Lines marked **[cut]** are the first to go if the clock is late. Skip them and the talk still makes sense.
- Contractions are written out so the lines are easy to scan. Say them the way you talk.
- The last line of each slide is the takeaway. Say it slowly. Then click.

---

## Before you start (slide 1 on screen) · 0:00 to 0:40 · 97 words

**Do:** Walk to the mic with the remote in your hand. Stop. Look at the room before you say anything. **Laser:** off.

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

## Slide 2: Who am I · 0:40 to 1:15 · 97 words

**Do:** `(click)`. Keep this short. The room wants the problem, not the bio. Say the OpenEverest line slowly. It is the one new term here. **Laser:** off. Just talk.

**Say:**

> Two lines about me.
> I am an AI and infra engineer at Cld9.ai.
> I was a Google Summer of Code mentee this year, and I am a member of the OpenTelemetry project.
> I love FOSS, and I contribute to CNCF projects. One of them is OpenEverest.
> OpenEverest is open source. It runs databases on Kubernetes. You create one object, an Instance, and get a database back.
> I work on provider-kserve. It makes an LLM just another Instance.
> **[cut]** Same UI, same API, same access rules as a database.
> (pause)
> That is enough about me. Let us open the box.

---

## Slide 3: The problem · 1:15 to 1:45 · 92 words

**Do:** `(click)`. **Laser:** dot on "Your app" at "Your app calls". Dot on the dashed Kubernetes box at "Where did this request go?". Dot on each code as you say 404, hang, 504, 429. Off.

**Say:**

> Your app calls slash v1, slash chat, slash completions.
> It looks like one call.
> **[cut]** Platform teams ship this fast. Then production asks a basic question.
> (pause)
> Where did this request go?
> Inside the cluster, the request crosses DNS, a gateway, a proxy, an autoscaler, and a Pod.
> Nobody drew that path.
> So when a 404, a hang, a 504, or a 429 comes back, nobody can say which hop sent it.
> **[cut]** You check the Pod. The Pod looks fine.
> (pause)
> Teams debug the symptom, because they never mapped the path.
> Today we map it.

---

## Slide 4: The path · 1:45 to 2:30 · 119 words

**Do:** `(click)`. **Laser:** one dot per box, left to right, as you say its number. One, two, three, four, five. At "along the same path" trace the dashed arrow back to the client once. Off.

**Say:**

> Here is the whole path. Five hops.
> One. The client. Your app, or an SDK. It sends the request.
> Two. DNS and a Service. The name becomes an address inside the cluster.
> Three. The gateway. The front door. TLS, the route, and the timeouts live here.
> Four. The model proxy. It reads the model name and picks the right backend.
> **[cut]** If no copy of the model runs, it has to scale one up from zero first.
> Five. The model Pod. vLLM on a GPU, or Ollama on a CPU. Both run the model.
> It loads the model, runs the prompt, and streams the answer back, one token at a time, along the same path.
> (pause)
> It is never one Pod.

---

## Slide 5: Where it breaks · 2:30 to 3:15 · 107 words

**Do:** `(click)`. Same picture. **Laser:** dot on each note as you name it: 404 above the gateway, hang above the Pod, 504 and 429 below. Off before "Every one of these".

**Say:**

> Same path. Now the failures. Each hop fails in its own way.
> 404. The client and the gateway disagree on the path. Often the slash v1 prefix is missing.
> Hang. The model is cold. The request waits for the image, the weights, and the GPU. No error. Just silence.
> 504. The gateway has an idle timeout. A long stream stops halfway.
> 429. The rate limit counts requests, not tokens. A tiny question and a huge prompt cost the same.
> (pause)
> Every one of these looks like "the model is broken".
> It is not. One hop is.
> (pause)
> Your error tells you what broke. It does not tell you where.

---

## Slide 6: How OpenEverest solved it · 3:15 to 3:55 · 109 words

**Do:** `(click)`. **Laser:** dot on the Instance at "You create one object". Dot on provider-kserve, then on the LLMInferenceService, then on the KServe box, as you name each. Trace the dashed "status, endpoints" arrow back to the Instance at "writes the status". Dot on "Ready". Off.

**Say:**

> Here is how we solved it in OpenEverest.
> The path stays the same. We added a control loop.
> You create one object. An Instance.
> It says what you want. This model. One GPU. One replica.
> provider-kserve reads the Instance and writes an LLMInferenceService.
> That is the object of KServe, the Kubernetes operator that serves models.
> The KServe controllers create the Deployments, the autoscalers, the Services, and the Routes.
> **[cut]** Nobody wires those by hand.
> **[cut]** Reconcile means: keep the real cluster equal to what you asked for.
> Then provider-kserve writes the status and the endpoint back onto the Instance.
> Your app gets one URL. Ready.
> (pause)
> Declare intent. Get an endpoint back.

---

## Slide 7: Same hops, any stack · 3:55 to 4:30 · 94 words

**Do:** `(click)`. **Laser:** dot on the three column headers once. Then one dot at the start of each row as you name it: Gateway, Model routing, Scale from zero, Model Pod. Off before "Different names".

**Say:**

> **[cut]** Maybe you do not use KServe. That is fine.
> Look at the rows, not the columns.
> Gateway. Envoy AI Gateway, which understands LLM calls, an Ingress, or ingress-nginx.
> Model routing. An InferencePool, a proxy that reads the model field, or one path per model.
> Scale from zero. Knative or KEDA, built in, or an HPA with a minimum of one.
> The model Pod. vLLM, or Ollama.
> Different names. Same four hops.
> When it breaks, walk the hops in order. Ask one question at each: did this hop answer?
> (pause)
> Map the path, not the brand.

---

## Slide 8: Thank you · 4:30 to 4:55 · 61 words

**Do:** `(click)`. Hold the slide still so people can scan the QR code. **Laser:** one dot on the QR code at "Scan the QR code", then off. Put the remote down. Say the last line slowly.

**Say:**

> That is the talk.
> One call. Five hops. Now you can see each one.
> Scan the QR code for my LinkedIn.
> Questions? Find me at the OpenEverest booth, or over a coffee.
> If you are hiring, let us talk.
> And come and contribute. The code is on GitHub, under openeverest.
> Thanks to DevCon and FOSSASIA for the stage.
> (pause)
> Thank you, Mumbai!

---

## Timing

| Part | Window | Words |
|---|---|---|
| Before you start (slide 1) | 0:00 to 0:40 | 97 |
| 2 Who am I | 0:40 to 1:15 | 97 |
| 3 The problem | 1:15 to 1:45 | 92 |
| 4 The path | 1:45 to 2:30 | 119 |
| 5 Where it breaks | 2:30 to 3:15 | 107 |
| 6 How OpenEverest solved it | 3:15 to 3:55 | 109 |
| 7 Same hops, any stack | 3:55 to 4:30 | 94 |
| 8 Thank you | 4:30 to 4:55 | 61 |
| **Total** | **4:55** | **776** |

The windows assume 140 words a minute and no **[cut]** lines. The full script is 776 words, 5:33. Without the 7 **[cut]** lines it is 705 words, 5:02. Say the **[cut]** lines only if you are on time at the end of slide 3 (clock under 1:50). Each `(pause)` adds two seconds. The buffer minute is for the walk, the show of hands, and applause.

## If the clock is late

| You are at | Clock shows | Do this |
|---|---|---|
| End of slide 3 | more than 1:50 | Drop all **[cut]** lines. |
| End of slide 5 | more than 3:25 | On slide 6, say only: "You create an Instance. provider-kserve turns it into KServe objects. You get an endpoint back. Declare intent, get an endpoint back." |
| End of slide 6 | more than 4:10 | On slide 7, say only: "Different names, same four hops. Map the path, not the brand." |
| Anywhere | 5:30 | Click to slide 8. Say the QR line, the booth line, and "Thank you, Mumbai!" |

## Terms you say, one line each

The full list, with what the provider builds and what KServe does, is in [TERMS.md](TERMS.md).

Say the short form the first time a term comes up. The script already does this. Use this list if someone asks after the talk.

| Term | Say |
|---|---|
| OpenEverest | An open source platform that runs databases, and now LLMs, on Kubernetes through one object. |
| Instance | The one object you create in OpenEverest. It says what you want: this model, one GPU, one replica. |
| provider-kserve | The OpenEverest provider I work on. It turns an Instance into KServe objects and writes the endpoint back. |
| KServe | A Kubernetes operator that serves models. |
| LLMInferenceService | The KServe object for one served LLM. |
| vLLM, Ollama | Engines that run the model. vLLM on a GPU, Ollama on a CPU. |
| Envoy AI Gateway, Agent Router | A gateway that understands LLM calls: routes by model name, checks the API key, counts tokens. |
| InferencePool, endpoint picker | A pool of model Pods from the Kubernetes Gateway API inference extension, and the part that picks a healthy one. KServe uses it. |
| Knative, KEDA, HPA | Autoscalers. Knative and KEDA can scale to zero. An HPA keeps at least one replica. |
| Reconcile | Keep the real cluster equal to what you asked for. |
| Token | A small piece of text. The model makes one at a time and streams them back. |
| 404, hang, 504, 429 | Wrong path, cold model, gateway timeout, rate limit. |

## One-breath version (if the laptop dies)

> One call. Five hops. DNS, gateway, proxy, autoscaler, Pod. Each one fails its own way: 404, hang, 504, 429. Map the path, not the brand. Thank you, Mumbai!

## Remote and laser

- Test the remote on slide 1 before you are introduced. Press forward once, then back once.
- One press per slide. If a slide does not change, wait one second before you press again. Two presses skip a slide.
- The laser is for one thing at a time. Dot, hold, off. Say the word while the dot is on the box, not before.
- Slide 2 and slide 8 need no laser. Slides 3 to 7 do.
- If the laser dies, point with your open hand. The **Do** lines work the same way.

## Cheat card (print this)

1. Thanks. Kasa kay, Mumbai. Biggest stage. Three hands: GPU on Kubernetes, vLLM or Ollama, a failure with no known hop.
2. Who am I: Cld9.ai, GSoC 2026, OpenTelemetry, CNCF. OpenEverest: one object, an LLM is just another Instance.
3. Problem: one call, five hidden hops, 404 hang 504 429. "Teams debug the symptom."
4. Path: client, DNS and Service, gateway, model proxy, model Pod. "Never one Pod."
5. Breaks: 404 path, hang cold, 504 timeout, 429 tokens. "What broke, not where."
6. OpenEverest: Instance, provider-kserve, LLMInferenceService, KServe objects, endpoint back. "Declare intent."
7. Any stack: gateway, routing, scale, Pod. "Map the path, not the brand."
8. QR, LinkedIn, booth or coffee, hiring, contribute. "Thank you, Mumbai!"

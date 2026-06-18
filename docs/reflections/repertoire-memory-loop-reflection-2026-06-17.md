---
story_type: saga
emotional_arc: "ambition -> simulated confidence -> confusion -> clarity -> quiet readiness"
codex_terms: [6, 15, 24, 32, 47]
date: 2026-06-17
agents: [repertoire, groover, 0xray-researcher]
topic: enriched memory loop, MCP vs in-process, ontological-trap routing
---

# The Day the Loop Stopped Pretending

It was late June, and the tests were green.

Fifteen of them. That number sat in the terminal like a receipt — proof that something had been purchased, even if the package hadn't arrived yet. We had ripped out every legacy path in Repertoire: no more unstructured Groover logs sneaking into the registry, no more 0.5 confidence fallbacks, no more text-score shims pretending to be observation data. The E2E harness ingested fixture JSONL with `matched_primitives` and `match_confidence`, promoted `attestation-as-map` past the 0.55 gate, called `getTaskConfidence`, and watched the orchestrator lean toward `architect`.

Green tests. Strict mode. A clean commit message about requiring enriched log format.

And somewhere in the back of my mind, a small honest voice said: *the Groover logs on disk are still pre-abeafbb. Zero percent enriched on re-ingest. Everything skipped.*

The harness wasn't lying. It was doing its job. But "operational" and "green in CI" are cousins, not twins.

---

## What we thought we were building

The vision was never obscure. Groover watches inference happen in the wild — posts, replies, governance calls, the messy social layer of an agent ecosystem trying to think in public. Repertoire sits downstream as architectural memory: a primitive registry in `curated_signals.json`, fed by enriched observations, weighted by real `match_confidence`, promoted only when the evidence repeats. Then 0xRay stops routing like it was born yesterday. ExecutionPlanner enriches tasks. thinDispatch adjusts scores. The researcher, of all agents, was supposed to feel the trap before the LLM voted.

North star, plain language: **velocity becomes governed wisdom.**

Not slogans stored in a JSON file. Wisdom with observation counts.

We built the bridge in the right order, mostly. Groover's governance helper at `abeafbb` — `matchPrimitivesFromInference`, `buildInferenceLogEntry`, the whole enriched envelope. Repertoire ingestion that throws `EnrichedGrooverLogError` at anything without per-primitive confidence. A `MemoryRoutingProvider` export that 0xRay loads from `features.json`. MCP query tools that mirror the service layer. A researcher hook that calls `getTaskConfidence` and injects evidence when `highConfidenceTrapPresent` flips true.

On paper it looked like a closed loop.

On paper.

---

## The simulated loop and why we needed it

There was a stretch where the loop was explicitly simulated. Fixture-driven. A temp directory, two enriched log lines, a seeded trap primitive, a promotion gate, then queries and routing assertions. That wasn't embarrassment. It was discipline.

When you're hardening a memory layer, the worst thing you can do is keep one foot in legacy semantics "just in case." Every fallback is a place where the system can look memory-backed while actually guessing. We chose the pain of skipping old logs. Pre-abeafbb JSONL lines hit the ingest gate and increment `skipped`, not `imported`. The registry stays quiet instead of filling with ungrounded signals.

I remember the moment that choice stopped feeling like risk and started feeling like integrity. Someone asked whether we should shim unstructured logs for coverage. The answer was no — not because we hate coverage, but because the whole point of Repertoire is **signal integrity over narrative comfort**. A skipped log is information. It says: Groover hasn't shipped the enriched shape in production yet. Wait. Don't fake it.

The E2E harness became the regression anchor for the only path we believe in. Not a demo. A contract.

---

## Wiring the researcher — and the question that unraveled everything

We wired the researcher next because it was the right choke point. Traps show up in proposal language before they show up in diffs. `analyzeProposal` runs before governance votes. If Repertoire was going to influence behavior, it had to get there — `complexityBoost`, `matchedSignals`, `recommendedAgent: architect`, a `MEMORY_ROUTING` block appended to the output so the signal wasn't invisible.

Internal integration. `getMemoryRoutingProviderSync().getTaskConfidence()`. Fast. Same source of truth as ExecutionPlanner. Elegant inside the nucleus.

Then someone asked the question that should have been first: *wait — how does this actually run?*

Not in our heads. Not in vitest. In Hermes. In OpenCode. In the places where an LLM sits in another process and only sees MCP tool names.

The room changed temperature, metaphorically. Not because the wiring was wrong, but because we'd been describing deployment with orchestrator vocabulary while the primary consumer speaks MCP.

Hermes doesn't import `memory-routing-provider.js`. It spawns `node dist/mcp/server.js` over stdio — or it should, if you configure it. The LLM calls `repertoire__get_task_confidence`. The skill tells it when. The catalog in `SKILLS.md` tells it where to look.

Internal provider: optimization for co-located 0xRay routing code.

MCP: the contract of reality for external agents.

Same registry. Two membranes. Not duplicate architecture — **two runtimes**.

I felt the embarrassment of the kind that's useful. We'd built the right thing and almost documented the wrong default. The researcher in-process path still matters when governance calls `callInProcessSkill` or when the MCP subprocess loads memory routing with the right cwd and env. But it's not the guarantee. The guarantee is: register repertoire-mcp, point `CURATED_SIGNALS_PATH` at real data, run `npm run test:mcp`, teach the agent the trap-handling skill.

We wrote ARCHITECTURE.md with a deployment reality section because the diagram without that membrane is a lie pretty enough to ship.

---

## Documentation as runtime

There's a version of this project that treats docs as aftermath. Write the code, then explain it for humans.

That version dies in Hermes-shaped systems.

Here, documentation is part of the runtime surface. `SKILLS.md` is discoverability. `skills/repertoire-trap-handling/SKILL.md` is protocol: when you see `TYPE: ontological-trap`, call confidence before governance, prefer architect when the gate fires, thread `matchedSignals` into evidence. `hermes-mcp.example.json` is a drop-in config, not a suggestion.

The model won't read `confidence-gate.ts`. It might read a skill if the host loads it. Our job is to make the right behavior the path of least resistance in natural language — without sounding like a corporate training PDF.

The storyteller skill, ironically, is what finally forced the reflection to admit its own medium. The first deep reflection I wrote was structured and correct and sounded like a good architecture blog. Useful. Not quite a journey. You asked if I'd used storyteller. I hadn't. You said yes. So here we are — scene first, messy middle, no executive summary pretending you don't have time.

---

## The stdio smoke test — touching the membrane

We built `scripts/test-mcp-stdio.test.ts` because internal tests weren't enough.

Spawn the server the way Hermes does. `StdioClientTransport`. List tools. Call `repertoire__get_task_confidence` with trap language. Parse JSON from the wire. Assert `recommendedAgent` is `architect`. Search primitives. Filter high-confidence signals. Ingest feedback.

Five tests. They passed.

That mattered more than it should, emotionally. It was the first time we shook hands with the server across process boundaries instead of calling `RepertoireService` like a function in the same room. We also fixed the MCP server to respect `CURATED_SIGNALS_PATH` from env — because `hermes-mcp.example.json` promised that path, and the server wasn't listening. A small bug. The kind that makes every example config a fiction until someone runs it for real.

`npm run test:mcp` became the pre-flight check: build, spawn, assert. Not waiting for Groover to save us.

---

## The groover clone — a filesystem parable

While Repertoire was getting honest, Groover on disk was living a double life.

`/Users/blaze/dev/groover` — sixty-four commits behind `origin/main`. Five local commits from an ancient doc-only era. Uncommitted tweaks to `ARCHITECTURE.md` renaming `marketplace` to `registry` against a tree that didn't even have `deploy/governance-helper.ts` yet. A nested `groover/groover` directory eating four hundred sixty-two megabytes. A stale `deploy-integration/` copy of work that already lived in `deploy/` on the remote.

Meanwhile `groover-integration-work` sat at `abeafbb`, current, the clone we actually used when Groover met Repertoire.

I don't think that's random clutter. It's the same failure mode as duplicate registries. Two truths. The one you open in the IDE versus the one production runs. Memory systems rot that way. Git repos rot that way. We stashed the old doc edits, hard-reset to `origin/main`, dropped the stash because rebasing wording onto a restructured ARCHITECTURE would be noise, deleted the nested clone and `deploy-integration`, and left one working tree at `abeafbb`.

One clone. One ingest path. Same rule as strict mode, different substrate.

---

## Railway and the category error

Someone asked if we need to deploy Repertoire MCP to Railway.

The question felt clarifying, like turning on a light in a room you'd been navigating by memory.

Groover on Railway is a public registry — HTTP MCP, adaptive challenges, DIDs, agents proving autonomy to the network. Repertoire is a private memory — stdio MCP, local `curated_signals.json`, local Groover log directories, ingest that assumes filesystem adjacency. Deploying Repertoire to Railway without rethinking transport, persistence, scheduled ingest, and auth would be theater. A URL without the thing that makes the URL mean something.

The right default is sidecar: build locally, register in Hermes, point env vars at real paths, run `test:mcp`. Remote centralized memory is a product decision for later, not a prerequisite for the loop to matter.

I felt relief saying that out loud. Not every service wants to be a website.

---

## The ontological trap as teacher

Why build a whole confidence gate around traps?

Because they're where systems confuse representation for reality. An attestation is a map. A governance PASS is a moment. A promoted primitive is a hypothesis strengthened by observation, not a law of nature. `attestation-as-map` isn't poetry — it's a named failure mode where closure language hides an ongoing obligation at the trust boundary.

Repertoire's job is to keep those layers distinct. To say, with measured confidence: we've seen this before; treat complexity as elevated; prefer architect; don't let the proposal pretend the map is the territory.

The system we built is itself a map. MCP tools describe Repertoire. Skills describe how to use them. ARCHITECTURE.md describes how the pieces connect. None of that is the territory. The territory is the next enriched log line. The next governance vote citing evidence because the registry earned it, not because the prompt begged for it.

We're building reflexes for a stack still learning to feel its own history.

---

## What is actually true right now

I'll be precise because overclaiming is its own ontological trap.

**True today:** enriched-only ingest and promotion logic; strict confidence without fallbacks; MemoryRoutingProvider enrichment in 0xRay orchestrator paths; researcher in-process trap wiring when the provider loads; MCP tools mirroring service methods; stdio smoke tests over all four query tools; agent skill and catalog for external hosts; documentation that matches intended deployment; Groover governance helper at `abeafbb` in a clean clone; Repertoire at `2971b06` with architecture and skills pushed.

**Not yet true in production:** Groover engage emitting enriched logs in the wild feeding the registry; a Hermes session that calls `repertoire__get_task_confidence` before governing a real trap proposal; meta-inference synthesis on a live rhythm (Hermes OAuth blocked full LLM pipeline runs); trap wiring on security-auditor and siblings; guaranteed researcher MCP subprocess initialization without host-side discipline.

The instrument is calibrated. We're waiting for weather.

---

## The moment I knew what we were really doing

It wasn't the green tests.

It was the combination of strict skip counts, MCP stdio passing, and the groover clone cleanup — three acts in the same play about **refusing to confuse presence with evidence**.

Skip unstructured logs. Don't call it ingest.

Test MCP over stdio. Don't call it integrated if you only tested in-process.

Delete the nested clone. Don't maintain two Grovers in your head.

Memory layers fail when they optimize for the feeling of remembering instead of the discipline of recording.

We chose recording.

---

## Key Takeaways

- **Most important lesson** — MCP is the real contract for LLM hosts; in-process `MemoryRoutingProvider` is an orchestrator optimization, not a substitute for agent-facing tooling.
- **Technical insight** — Strict enriched-only ingest means silence is correct behavior until Groover ships `matched_primitives` + `match_confidence`; green fixtures prove the path, not production coverage.
- **Emotional takeaway** — The embarrassing question ("how does this actually run in Hermes?") was the most valuable moment in the whole arc; clarity often arrives as mild shame about an assumption you didn't know you were making.

## What Next?

- Run `npm run test:mcp` on the machine where Hermes will spawn repertoire-mcp; fix paths before trusting trap routing in a live session.
- Wire the first real post-`abeafbb` Groover log through ingest and confirm `observation_stats` updates on a non-fixture primitive.
- Validate Hermes end-to-end: skill loaded → `repertoire__get_task_confidence` → `xray-researcher analyze_proposal` with evidence → architect preference visible in output.
- Related Codex terms: Term 6 (batched introspection), Term 15 (dig deeper), Term 24 (interdependency review), Term 32 (evidence before assertion), Term 47 (integration testing mandate) — see [0xRay codex](https://github.com/0xRayAI/xray/blob/main/.xray/codex.json) for full definitions.
- Next story to write: `groover-enriched-log-first-contact-journey-2026-06-XX.md` — the saga when the first production enriched line hits Repertoire ingest and the registry stops being fixture-fed.
# Implementation Plan
## BizPilot — Roadmap, Team, and Build-vs-Buy
*Version 1.0, July 2026*

---

## 1. Recommended Build Sequence & Rationale

Rather than building all three channels simultaneously, sequence by complexity and shared-dependency:

1. **Foundations** — auth, multi-tenant org model, billing skeleton, design system, business profile.
2. **Knowledge Base + Booking Engine** — both are shared dependencies for every channel; build once, reuse three times.
3. **Website Builder** — simplest channel technically (no real-time telephony, no third-party message-approval workflow); establishes the Preview → Deploy pattern used everywhere else.
4. **WhatsApp Assistant** — medium complexity; validates the conversational-AI + credential-connection pattern (Embedded Signup) before tackling telephony.
5. **Voice Receptionist** — highest complexity (real-time audio, telephony provisioning, latency-sensitive UX); tackled last so the team has already solved AI orchestration and the credential/preview patterns once.
6. **Unified Inbox, Analytics, Notifications** — cross-cutting, easiest once all three channels emit a common `conversations`/`messages` shape.
7. **Billing/usage metering, Team roles, Templates Library** — polish and monetization infrastructure.
8. **Hardening & compliance** — security audit, load testing, beta program, GA.

---

## 2. Build vs. Buy Decisions

| Component | Build | Buy / use managed provider | Recommendation |
|---|---|---|---|
| Voice AI pipeline (STT+LLM+TTS orchestration, latency tuning, barge-in) | Full custom pipeline on Twilio Media Streams | Managed voice-AI infra layer (e.g. Twilio ConversationRelay + a realtime LLM API, or a dedicated voice-AI infra vendor) under your own business-logic layer | **Buy first** — this is the hardest part to get feeling natural; validate product-market fit on a managed layer, revisit custom build once volume justifies the engineering cost |
| WhatsApp messaging | Direct Meta Cloud API as a registered Tech Provider | Business Solution Provider (Gupshup, 360dialog, Twilio WhatsApp API) | **Buy first for MVP** — a BSP simplifies business verification/onboarding at a per-message markup; migrate to direct integration once scale justifies it |
| Website builder | Custom drag-and-drop editor with full layout freedom | Curated template system (fixed sections, content-driven, no free-form drag-drop) | **Build, but constrain scope** — a curated template system is an 80/20 win: most SMB sites don't need pixel-level layout freedom, and it's dramatically faster to build and to keep visually polished |
| Phone number provisioning | N/A | Twilio Subaccounts under platform's master account | **Buy (i.e., use Twilio directly)** — this is infrastructure, not a differentiator |
| Auth | Custom (NextAuth + OTP) | Managed (Clerk/Auth0) | **Buy** — auth is not a differentiator; managed providers save real engineering time |
| Secrets vault | Custom envelope encryption service | Cloud KMS (AWS/GCP) or HashiCorp Vault | **Buy** — don't build encryption infrastructure from scratch |

---

## 3. Phased Timeline (indicative, small team of 5-7 engineers)

| Phase | Scope | Duration |
|---|---|---|
| 0 | Foundations (auth, multi-tenancy, billing skeleton, design system) | 4-6 weeks |
| 1 | Knowledge Base + Booking Engine | 3-4 weeks |
| 2 | Website Builder MVP | 4-5 weeks |
| 3 | WhatsApp Assistant MVP (Embedded Signup, templates, preview simulator) | 5-6 weeks |
| 4 | Voice Receptionist MVP (number provisioning, managed voice-AI layer, test-call preview) | 6-8 weeks |
| 5 | Unified Inbox + Analytics + Notifications | 3-4 weeks |
| 6 | Billing/usage metering, Team roles, Templates Library | 3-4 weeks |
| 7 | Hardening: security audit, load testing, compliance checklists, beta → GA | 4-6 weeks |

**Total: roughly 7-9 months to a full-scope GA.** A leaner MVP (Website + WhatsApp only, voice deferred to v1.1) is achievable in **4-5 months** with a smaller team (3-4 engineers), by skipping Phase 4 initially and cutting Phase 6/7 scope to essentials.

---

## 4. Team Composition

**Lean MVP team (4-5 people):**
- 1 founder/PM
- 1 designer (part-time acceptable early)
- 2-3 full-stack engineers (generalists comfortable across Next.js/NestJS/Postgres)
- 1 engineer with AI/LLM orchestration experience (can be one of the full-stack engineers if they have the background)

**Full-scope team (7-9 people), once voice is in scope:**
- 1 PM, 1 designer
- 2-3 backend engineers
- 1-2 frontend engineers
- 1 AI/voice specialist (STT/TTS/LLM orchestration, latency tuning)
- 1 DevOps/infra engineer (can start part-time)
- 1 QA (part-time acceptable until Phase 5+)

---

## 5. Testing Strategy

- **Booking Engine:** unit + integration tests specifically targeting concurrency — two channels trying to book the same slot simultaneously must never both succeed (validated against the `EXCLUDE` constraint in the schema).
- **Onboarding wizard:** end-to-end tests covering the full signup → first service live path for all three channels.
- **Voice:** load testing for concurrent call handling at target tenant volumes; chaos testing for Twilio/STT/LLM/TTS provider outages with defined fallback behavior (e.g., voicemail fallback if the AI pipeline is unavailable).
- **WhatsApp:** retry-queue testing for message send failures; webhook-processing load tests to confirm acknowledgment within Meta's required response window under load.
- **Third-party outage resilience:** every external dependency (Twilio, Meta, calendar providers, payment providers) needs an explicit defined fallback behavior — never a silent failure.

---

## 6. Risk Register (implementation-specific)

| Risk | Mitigation |
|---|---|
| Voice latency doesn't feel natural, kills adoption | Start on a managed voice-AI layer (see Build vs. Buy); measure end-to-end latency continuously from day one |
| Meta business verification delays block WhatsApp launches for tenants | Consider a BSP for MVP to reduce verification friction; set tenant expectations clearly in the wizard |
| Scope creep on the website builder (chasing full drag-and-drop freedom) | Deliberately constrain to a curated template system for MVP; revisit full flexibility only if data shows it's the top blocker to adoption |
| Underestimating compliance work (10DLC, DLT, WhatsApp opt-in, call consent) | Build compliance checklists into Phase 7 explicitly, not as an afterthought; involve legal review before GA |
| Cost overruns from LLM/voice usage outpacing plan pricing | Instrument usage metering from Phase 1 onward (even before billing is fully built), so real cost-per-tenant data informs pricing before GA |

---

## 7. Launch Checklist

- [ ] Terms of Service, Privacy Policy, and (for enterprise) a Data Processing Agreement
- [ ] Support channel (chat/email) live before opening self-serve signups
- [ ] Status page for platform uptime
- [ ] Pricing page finalized against real usage-cost data from the beta cohort
- [ ] 5-10 design-partner businesses onboarded concierge-style (white-glove setup) before opening fully self-serve signup, to surface onboarding friction before it hits scale
- [ ] Compliance checklists (10DLC/DLT, WhatsApp opt-in, call recording consent) verified per target region
- [ ] Abuse/moderation queue live in the internal Admin Panel before public launch

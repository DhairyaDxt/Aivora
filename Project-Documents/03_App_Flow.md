# App Flow Document
## BizPilot — End-to-End User Journeys
*Version 1.0, July 2026*

---

## A. Signup & Onboarding

1. Owner signs up (email/OTP or Google/Microsoft SSO).
2. Business basics: name, category/vertical, address, timezone, languages.
3. "What do you want to build first?" — Website / WhatsApp / Voice Receptionist / "all three" (sets wizard order; all three remain available anytime from the Dashboard).
4. Redirect into the first chosen service's builder wizard.

## B. Knowledge Base Setup (shared step, triggered the first time any service needs it)

1. Prompted mid-wizard: "Tell BizPilot about your business" — services & pricing, hours, FAQs.
2. Option to upload an existing price list/menu/brochure PDF → auto-parsed into structured entries for review.
3. Owner reviews/edits auto-parsed entries before saving.
4. This content is now available to every channel (voice, WhatsApp, website) and can be edited anytime from Settings.

## C. Website Builder Flow

1. Choose a vertical template (salon, clinic, restaurant, etc.) or "Blank."
2. AI pre-fills pages using Business Profile + Knowledge Base content.
3. Owner customizes via visual editor (text, images, sections, colors) — no code.
4. Booking widget and chat widget are added automatically (toggle to remove).
5. **Preview:** staging URL generated instantly (`preview--yourbusiness.bizpilot.site`), fully functional and shareable.
6. Domain step: free subdomain by default, or guided custom-domain connect (platform shows exact CNAME/A record for the owner's registrar; "Verify" button polls DNS until it resolves).
7. Click "Publish" → site goes live at the chosen domain.

## D. WhatsApp Assistant Flow

1. **Connect:** "Connect with Facebook" (Embedded Signup) — owner logs into their Meta Business account via popup, selects/creates a WhatsApp Business number, done. (Manual fallback available: guided steps + fields for WABA ID / Phone Number ID / access token / app secret, each with a "?" that expands into numbered instructions linking to the exact Meta Business Suite screen.)
2. Configure bot behavior: greeting, personality tone, business hours, human-handoff keywords.
3. Draft any outbound template messages (booking reminders, confirmations) — auto-submitted to Meta for approval; status shown as Pending/Approved/Rejected (with rejection reason if applicable).
4. **Preview:** simulated WhatsApp chat window inside the dashboard — owner types as a "customer," sees real bot responses, using the real knowledge base but sending nothing externally.
5. Click "Go Live" — the connected number starts receiving real messages.

## E. Voice Receptionist Flow

1. **Get a number:** search by area code → platform provisions instantly via its Twilio Subaccount (default), or "I have my own Twilio account" for BYO (enterprise path: enter Account SID + Auth Token).
2. Configure persona: greeting script, tone, business hours, after-hours behavior (voicemail / callback request / route to human).
3. Set escalation number (where live calls transfer to on request).
4. Connect calendar (Google/Microsoft OAuth) if not already connected via the Booking Engine setup.
5. **Preview:** in-browser test call (or "call my own phone now") — hear the exact experience a customer will get; sandbox logs don't affect production analytics or billing.
6. Click "Go Live" — the number starts accepting real calls.

## F. Appointment Booking — Customer-Facing (any channel)

1. Customer asks to book (via call, WhatsApp, or website widget).
2. AI checks the Booking Engine for real-time availability against staff/service/buffer rules.
3. Customer picks a slot; confirmation sent immediately via the originating channel + email if provided.
4. Reminders sent at 24h and 1h before (channel configurable).
5. Reschedule/cancel via a self-service link in the confirmation message.
6. No-shows are logged and surfaced in Analytics.

## F2. Appointment Booking — Owner-Facing

1. Owner manages Services (name, duration, price, buffer) and Staff (working hours, days off, assigned services) from the dashboard.
2. Calendar view (day/week/month) shows all bookings across channels in one place.
3. Manual booking creation/edit for phone-in or walk-in customers.

## G. Credential/Connection — Generic Pattern (applies to every third-party link)

1. Trigger point: reached naturally inside a service's setup wizard (e.g., WhatsApp connect step), or from the standalone "Connections" page.
2. Plain-language explainer: *why* this connection is needed, in non-technical terms.
3. Preferred path shown first (OAuth/one-click); manual fallback collapsed behind "Advanced" for power users.
4. On submit: "Test connection" runs a live validation call against the provider; failure shows a specific, actionable error (not a raw API error).
5. Status chip updates: **Connected** (green), **Pending verification** (amber — e.g., waiting on Meta business verification or a WhatsApp template approval), **Needs attention** (red — expired token, failed charge, etc.).
6. Notifications fire automatically if a connected credential is about to expire or has failed.

## H. Preview/Test — Generic Pattern

Every service's builder has a persistent "Preview" panel/drawer, so the owner can test at any point while still editing — not just at the end:
- Voice → test call
- WhatsApp → simulated chat
- Website → live staging link
No service can be flipped to "Live" until (a) preview has been opened at least once and (b) required credentials for that service show "Connected."

## I. Ongoing Operations

1. **Unified Inbox:** owner/staff see all conversations (calls, WhatsApp, website chat) filtered by channel/status; "Take over from AI" lets a human step into a live conversation.
2. **Analytics:** daily/weekly view of calls handled, messages handled, bookings made, missed calls, AI resolution rate.
3. **Notifications:** real-time alerts for bookings, cancellations, missed calls, escalations, expiring credentials, usage nearing plan limits.

## J. Billing & Upgrade Flow

1. Usage approaches plan limit (voice minutes, WhatsApp conversations, or number count) → in-app + email warning at 80% and 100%.
2. Owner reviews plan comparison, upgrades in two clicks (Stripe/Razorpay checkout).
3. Invoice history and usage breakdown available under Billing settings.

## K. Edge Cases Worth Designing For Explicitly

- Owner has no existing Facebook Page/Business Manager → wizard offers a guided "create one" sub-flow before Embedded Signup.
- Meta rejects business verification → dashboard shows the specific rejection reason and next steps, not a generic failure.
- Twilio number purchase fails (e.g. area code sold out) → offer nearest available area codes automatically.
- Calendar OAuth token expires → Booking Engine falls back to internal-only calendar and flags "reconnect calendar" until resolved, rather than silently failing to check availability.
- Customer tries to book a slot that's just been taken by another channel → optimistic-lock conflict check re-queries availability before confirming, and offers the next nearest slot if it's gone.

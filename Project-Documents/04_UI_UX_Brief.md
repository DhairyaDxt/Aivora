# UI/UX Brief
## BizPilot — Design Principles & Key Screens
*Version 1.0, July 2026*

---

## 1. Design Principles

1. **Plain language over jargon.** Never say "webhook," "token," or "endpoint" in user-facing copy. Say "connection," "key," or "link." The owner is a salon manager, not a developer.
2. **Wizard-first, dashboard-second.** First-run experience is a guided wizard, not an empty dashboard with a dozen unexplained options. The dashboard becomes "home" only after the first service goes live.
3. **Show, don't just configure.** Every builder screen keeps a live preview visible or one click away — settings on one side, real behavior on the other (Webflow/Typeform-style split view), so the owner never has to imagine what they're building.
4. **Progressive disclosure.** Advanced settings (BYO Twilio, manual WhatsApp token entry, custom prompt editing) live behind an "Advanced" toggle, off by default.
5. **Status is always visible.** Every service and every connection shows a clear status chip: Draft / Testing / Live / Needs Attention. The owner should never have to click in to find out if something is broken.
6. **Teach through empty states.** An empty "Services" list doesn't just say "no services yet" — it suggests what similar businesses usually start with.
7. **Channel color coding.** One accent color per channel across the whole product (e.g. voice, WhatsApp, website each get a consistent color) so a multi-service dashboard stays scannable at a glance.

---

## 2. Key Screens

### 2.1 Onboarding Wizard
Full-screen, single-column, one question group per step, progress indicator at top. Ends by dropping the owner directly into the first service's builder — never a blank dashboard.

### 2.2 Home Dashboard
Card per service (Voice / WhatsApp / Website), each showing: status chip, quick stat (calls this week / messages this week / visits this week), and a primary action ("Continue setup," "View," or "Go Live"). An "Add a service" card is always present.

### 2.3 Service Builder — Voice
Tabbed layout: Persona & Script | Business Hours | Phone Number | Calendar | Escalation | Advanced. Persistent right-side "Test call" button available from every tab.

### 2.4 Service Builder — WhatsApp
Tabs: Connection | Bot Behavior | Templates | Preview. The Preview tab is a full simulated WhatsApp UI (chat bubbles, timestamps) so it visually matches what the owner already knows from using WhatsApp personally.

### 2.5 Service Builder — Website
Visual canvas (center) + component/section panel (left) + settings sidebar (right, contextual to selected section). "Preview" always opens the real staging URL in a new tab rather than an in-app approximation, since a website's fidelity matters more than any other channel.

### 2.6 Connections Center
A single table: Provider | Purpose | Status | Action. This is where every credential across every service is visible in one place, so the owner (or their agency partner) can audit what's connected without hunting through each builder.

### 2.7 Preview/Test Drawer
A persistent, collapsible right-side drawer accessible from any builder screen — not a separate page — so testing never interrupts the editing flow.

### 2.8 Unified Inbox
Channel filter tabs (All / Calls / WhatsApp / Website Chat) + conversation list + detail pane (transcript, customer info, "Take over" button). Mirrors familiar inbox patterns (e.g. email/helpdesk UIs) rather than inventing a new interaction model.

### 2.9 Appointments / Calendar
Day/Week/Month toggle, staff shown as columns, click a slot for booking detail (customer, service, notes, cancel/reschedule).

### 2.10 Analytics Dashboard
KPI cards at top (calls, messages, bookings, resolution rate) + trend charts below + per-channel breakdown table.

### 2.11 Billing & Plan
Current plan, usage bars (minutes/conversations/numbers used vs. included), upgrade CTA, invoice history.

### 2.12 Team & Roles
Simple list: name, email, role (Owner/Admin/Agent/Viewer), invite button.

### 2.13 Settings
Business Profile, Knowledge Base editor, Notification preferences, all in one settings area with clear sub-navigation.

---

## 3. Visual Style Direction

- **Typography:** clean modern sans-serif (e.g. Inter or Geist), sentence case throughout — never Title Case or ALL CAPS in UI copy.
- **Palette:** calm neutral base with one accent color per channel (a common convention: green-adjacent for WhatsApp since it echoes the familiar WhatsApp brand association, a distinct accent for voice, another for website) so the multi-service dashboard is visually parseable at a glance.
- **Density:** generous whitespace on setup/wizard screens (reduce cognitive load for non-technical users); denser, information-rich layout acceptable on Analytics/Inbox screens where power users want more at once.
- **Iconography:** one consistent icon set throughout (avoid mixing styles).
- **Microcopy tone:** friendly, encouraging, specific — "Nice, your WhatsApp assistant just answered its first message!" rather than a generic success toast.

---

## 4. Mobile Considerations

- **Phase 1:** dashboard is responsive for viewing (Inbox, Analytics, Notifications, quick status checks) since owners frequently check in from their phone between customers.
- **Full builder editing** (Voice/WhatsApp/Website configuration) is desktop-optimized in Phase 1 given the complexity of the settings involved; simplified mobile editing is a Phase 2 target once the desktop patterns are validated.

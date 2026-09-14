# Backend Schema
## BizPilot — Data Model (PostgreSQL)
*Version 1.0, July 2026*

---

## 0. Design Decisions

- **Multi-tenancy:** shared database, shared schema, every tenant-scoped table carries `org_id`. PostgreSQL Row-Level Security (RLS) policies enforce isolation at the database layer as defense-in-depth beyond application checks.
- **Credentials:** never store a raw secret in this database. The `credentials` table stores only a `secret_ref` pointing to a KMS/Vault-encrypted value, plus non-sensitive metadata (e.g. a WhatsApp phone number ID, which isn't itself sensitive).
- **Soft deletes:** critical tables use `deleted_at` rather than hard deletes, for audit/compliance trail.
- **Timestamps:** `created_at` / `updated_at` on every table.
- **IDs:** UUID primary keys throughout.
- **Double-booking prevention:** the `appointments` table uses a Postgres exclusion constraint on a time-range column per staff member (shown below) rather than relying solely on application-layer locking.

---

## 1. Core Tenant & User Tables

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  industry_vertical TEXT,           -- 'salon' | 'clinic' | 'restaurant' | 'real_estate' | 'gym' | 'home_services' | 'other'
  country TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  plan_id UUID REFERENCES subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active', -- active | suspended | churned
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  auth_provider TEXT,                -- 'password' | 'google' | 'microsoft'
  auth_provider_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE org_members (
  org_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),
  role TEXT NOT NULL,                -- 'owner' | 'admin' | 'agent' | 'viewer'
  invited_by UUID REFERENCES users(id),
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE business_profiles (
  org_id UUID PRIMARY KEY REFERENCES organizations(id),
  legal_name TEXT,
  display_name TEXT,
  description TEXT,
  address JSONB,
  logo_url TEXT,
  business_hours JSONB,              -- {mon:[{open,close}], tue:[...], ...}
  languages TEXT[] DEFAULT ARRAY['en'],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 2. Knowledge Base

```sql
CREATE TABLE knowledge_base_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  type TEXT NOT NULL,                -- 'faq' | 'policy' | 'service' | 'pricing' | 'hours' | 'custom'
  title TEXT,
  content TEXT NOT NULL,
  embedding VECTOR(1536),            -- pgvector; used for RAG retrieval
  source TEXT,                       -- 'manual' | 'document_upload' | 'auto_parsed'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON knowledge_base_entries USING ivfflat (embedding vector_cosine_ops);
```

## 3. Services & Configs

```sql
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  type TEXT NOT NULL,                -- 'voice' | 'whatsapp' | 'website'
  name TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | testing | live | paused
  config JSONB,                      -- type-specific config not modeled in dedicated tables
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deployed_at TIMESTAMPTZ
);

CREATE TABLE voice_agent_configs (
  service_id UUID PRIMARY KEY REFERENCES services(id),
  persona_name TEXT,
  greeting_script TEXT,
  voice_id TEXT,                     -- TTS voice identifier
  llm_model TEXT,
  escalation_number TEXT,
  business_hours_override JSONB,
  barge_in_enabled BOOLEAN DEFAULT true,
  max_call_duration_seconds INT DEFAULT 600,
  recording_enabled BOOLEAN DEFAULT true,
  consent_message TEXT
);

CREATE TABLE whatsapp_bot_configs (
  service_id UUID PRIMARY KEY REFERENCES services(id),
  waba_id TEXT,
  phone_number_id TEXT,
  display_name TEXT,
  welcome_message TEXT,
  bot_personality_prompt TEXT,
  human_handoff_keywords TEXT[],
  session_timeout_minutes INT DEFAULT 1440
);

CREATE TABLE whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  category TEXT,                     -- 'marketing' | 'utility' | 'authentication'
  language TEXT DEFAULT 'en',
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  rejection_reason TEXT,
  meta_template_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE website_configs (
  service_id UUID PRIMARY KEY REFERENCES services(id),
  template_id TEXT,
  subdomain TEXT UNIQUE,
  custom_domain TEXT UNIQUE,
  custom_domain_status TEXT DEFAULT 'not_connected', -- not_connected | pending_dns | verified
  theme JSONB,
  seo_meta JSONB,
  published_version_id UUID
);

CREATE TABLE website_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id),
  pages JSONB NOT NULL,              -- page tree / component structure
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);
```

## 4. Credential Vault

```sql
CREATE TABLE credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  service_id UUID REFERENCES services(id),
  provider TEXT NOT NULL,            -- 'meta_whatsapp' | 'twilio' | 'google_calendar' | 'microsoft_calendar' | 'stripe' | 'razorpay'
  secret_ref TEXT NOT NULL,          -- pointer into KMS/Vault, never the raw secret
  metadata JSONB,                    -- non-sensitive info, e.g. phone_number_id, waba_id
  status TEXT NOT NULL DEFAULT 'pending_verification', -- connected | expired | revoked | pending_verification
  last_validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 5. Telephony

```sql
CREATE TABLE phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  twilio_sid TEXT,
  number TEXT NOT NULL,
  type TEXT,                         -- 'local' | 'toll_free'
  country TEXT,
  capabilities TEXT[],               -- ['voice','sms']
  ownership TEXT NOT NULL DEFAULT 'platform', -- 'platform' (subaccount) | 'byo'
  assigned_service_id UUID REFERENCES services(id),
  monthly_cost_cents INT,
  status TEXT DEFAULT 'active',
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 6. Appointment Booking

```sql
CREATE TABLE appointment_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  duration_minutes INT NOT NULL,
  price_cents INT,
  buffer_before_minutes INT DEFAULT 0,
  buffer_after_minutes INT DEFAULT 0
);

CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  working_hours JSONB,
  services_offered UUID[] -- references appointment_services(id)
);

CREATE TABLE calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  staff_id UUID REFERENCES staff(id),
  provider TEXT NOT NULL,            -- 'google' | 'microsoft'
  oauth_secret_ref TEXT NOT NULL,    -- vault reference, not raw token
  calendar_id TEXT,
  sync_status TEXT DEFAULT 'connected'
);

-- Requires: CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  source_channel TEXT NOT NULL,      -- 'voice' | 'whatsapp' | 'website'
  staff_id UUID REFERENCES staff(id),
  appointment_service_id UUID REFERENCES appointment_services(id),
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  time_range TSTZRANGE NOT NULL,     -- [start_time, end_time)
  status TEXT NOT NULL DEFAULT 'confirmed', -- confirmed | cancelled | completed | no_show
  notes TEXT,
  reminder_sent_24h BOOLEAN DEFAULT false,
  reminder_sent_1h BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevents double-booking the same staff member for overlapping time ranges
  EXCLUDE USING gist (staff_id WITH =, time_range WITH &&)
    WHERE (status = 'confirmed')
);
```

## 7. Conversations & Call Logs

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  channel TEXT NOT NULL,             -- 'voice' | 'whatsapp' | 'website_chat'
  service_id UUID REFERENCES services(id),
  customer_identifier TEXT,          -- phone number or session id
  status TEXT NOT NULL DEFAULT 'active', -- active | resolved | escalated
  resolution_type TEXT,              -- 'ai_resolved' | 'human_handoff' | 'booking_completed' | 'abandoned'
  is_sandbox BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  sender TEXT NOT NULL,              -- 'customer' | 'ai' | 'agent'
  content TEXT,
  content_type TEXT DEFAULT 'text',  -- 'text' | 'audio' | 'image' | 'button'
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  twilio_call_sid TEXT,
  duration_seconds INT,
  recording_url TEXT,
  transcript TEXT,
  outcome TEXT,                      -- 'booked' | 'info_only' | 'escalated' | 'missed' | 'voicemail'
  cost_cents INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 8. Notifications, Billing, Audit

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),
  type TEXT NOT NULL,                -- 'new_booking' | 'missed_call' | 'escalation' | 'credential_expiring' | 'usage_limit'
  channel TEXT NOT NULL,             -- 'email' | 'sms' | 'whatsapp' | 'push'
  payload JSONB,
  status TEXT DEFAULT 'pending',     -- pending | sent | failed
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                -- 'Starter' | 'Growth' | 'Scale'
  price_monthly_cents INT NOT NULL,
  included_voice_minutes INT,
  included_whatsapp_conversations INT,
  included_phone_numbers INT,
  overage_rates JSONB
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  plan_id UUID REFERENCES subscription_plans(id),
  billing_provider TEXT,             -- 'stripe' | 'razorpay'
  external_subscription_id TEXT,
  status TEXT DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ
);

CREATE TABLE usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  metric TEXT NOT NULL,              -- 'voice_minutes' | 'whatsapp_conversations' | 'sms_count'
  quantity NUMERIC NOT NULL,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  billed BOOLEAN DEFAULT false
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  actor_user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,              -- e.g. 'credential.connected', 'service.deployed', 'plan.changed'
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE templates_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical TEXT NOT NULL,            -- 'salon' | 'clinic' | 'restaurant' | ...
  service_type TEXT NOT NULL,        -- 'voice' | 'whatsapp' | 'website'
  name TEXT NOT NULL,
  description TEXT,
  config_json JSONB NOT NULL,
  preview_image_url TEXT
);
```

## 9. Row-Level Security Example

```sql
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON appointments
  USING (org_id = current_setting('app.current_org_id')::UUID);
```
Apply the equivalent policy to every tenant-scoped table. The application sets `app.current_org_id` at the start of each request/transaction based on the authenticated session.

---

## 10. Entity Relationship Overview

- `organizations` 1—N `users` (via `org_members`), `business_profiles` (1—1), `knowledge_base_entries`, `services`, `phone_numbers`, `staff`, `appointment_services`, `credentials`, `subscriptions`, `usage_records`, `audit_logs`
- `services` 1—1 `voice_agent_configs` / `whatsapp_bot_configs` / `website_configs` (depending on `type`)
- `services` 1—N `conversations`, `credentials`
- `appointments` N—1 `staff`, N—1 `appointment_services`
- `conversations` 1—N `messages`, 1—1 `call_logs` (voice only)

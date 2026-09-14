# Movie Recommendation System — Project Documentation

**Version:** 1.0
**Date:** July 23, 2026
**Contents:** PRD · TRD · App Flow · UI/UX · Backend Schema · Implementation Plan · Gap Analysis

---

# 1. Product Requirements Document (PRD)

## 1.1 Purpose
Build a movie recommendation platform where users get personalized movie suggestions. On signup, users declare their preferred **genres, interests, and languages**. Initially they see curated content matching those preferences (cold start). As they interact with the platform (views, ratings, watchlist adds, search, time spent), the system shifts to **personalized recommendations** using their own behavior (content-based) and the behavior of similar users (collaborative filtering).

## 1.2 Goals
- Reduce time-to-relevant-content for new users via preference-based onboarding.
- Increase engagement (session length, return visits) through progressively smarter recommendations.
- Give admins full control over the movie catalog and visibility into platform health.
- Build a system where recommendation quality measurably improves as user data accumulates.

## 1.3 User Roles

| Role | Description |
|---|---|
| **User** | Registers, sets preferences, browses/searches movies, rates, watchlists, receives personalized recommendations. |
| **Admin** | Manages movie catalog, genres/languages, users, and views platform analytics. Cannot be self-registered — seeded or promoted. |

## 1.4 Core Features

### 1.4.1 Authentication
- Email/password signup and login.
- Email verification on signup.
- Forgot/reset password flow.
- JWT-based session (access + refresh token).
- Role-based access control (user vs admin).
- (Optional, phase 2+) Social login (Google).

### 1.4.2 Onboarding (Preference Capture)
- After signup, mandatory onboarding step:
  - Select **genres** (multi-select, e.g. Action, Drama, Sci-Fi).
  - Select **languages** they like watching movies in (multi-select, e.g. English, Hindi, Korean).
  - Select **interests/moods** (e.g. "based on true events," "feel-good," "franchise films," "award-winning") — a lighter-weight tag layer on top of genre.
- Preferences are editable later from Profile/Settings.
- Onboarding must be skippable-with-defaults only if product decides cold start can tolerate it (recommend: **not skippable**, since it's the seed for recommendations).

### 1.4.3 Cold-Start Home Feed
- Immediately after onboarding, home screen shows movies filtered/ranked by selected genres + languages (+ interest tags).
- Sections like "Top in Action," "Popular in Hindi," "Because you like Sci-Fi."

### 1.4.4 Behavior Tracking
Every meaningful interaction is logged as an event, forming the basis for personalization:
- Movie view / detail-page open
- Watch time / completion (if streaming metadata available, else "marked as watched")
- Rating (1–5 stars, or thumbs up/down)
- Add/remove watchlist
- Search queries
- Explicit recommendation feedback ("not interested" / "more like this")

### 1.4.5 Personalized Recommendations (progressive)
- **Stage 1 — Cold start:** genre/language/interest filter only (no behavior data).
- **Stage 2 — Content-based:** once a user has rated/watched a handful of movies, recommend similar movies based on metadata similarity (genre, cast, director, keywords) to what they engaged with positively.
- **Stage 3 — Collaborative filtering:** once enough users have enough interactions, recommend based on "users similar to you also liked."
- **Stage 4 — Hybrid:** blend content-based + collaborative + popularity, weighted based on data availability per user (new users lean cold-start/content, active users lean collaborative).
- Recommendation sections should be explainable where possible ("Because you watched X," "Trending in Thriller").

### 1.4.6 Browse & Search
- Browse by genre, language, year, rating.
- Full-text search on title/cast/director.
- Filters and sort (newest, top-rated, most popular).

### 1.4.7 Movie Detail Page
- Poster, synopsis, cast, genre, language, rating, release year.
- User actions: rate, add to watchlist, mark as watched.
- "Similar movies" module.

### 1.4.8 User Profile
- Edit preferences (genres/languages/interests).
- View watch history, ratings given, watchlist.
- Account settings (password, email).

### 1.4.9 Admin Panel
- CRUD on movies (title, metadata, poster, genres, language, cast).
- CRUD on genres/languages/interest tags (master data).
- User management: view/search users, deactivate/ban, promote to admin.
- Analytics dashboard: DAU/MAU, top genres, most-watchlisted movies, recommendation click-through rate, signups over time.
- Content moderation (if reviews/comments are added later).

## 1.5 Non-Functional Requirements
- **Performance:** Home feed loads < 1.5s p95; recommendation API < 500ms p95 (served from precomputed/cached results, not computed live).
- **Scalability:** Support growth from thousands to millions of users without redesign — recommendation computation must be async/batch, not synchronous per-request.
- **Security:** Passwords hashed (bcrypt/argon2), JWT short-lived with refresh rotation, RBAC enforced server-side, input validation/sanitization, rate limiting on auth endpoints.
- **Availability:** 99.5%+ uptime target.
- **Privacy:** Clear consent for behavior tracking; user can view/delete their data.

## 1.6 Success Metrics
- Onboarding completion rate.
- % of home feed clicks from personalized (vs cold-start) sections over time.
- 7-day and 30-day retention.
- Average ratings/watchlist adds per active user per week.
- Recommendation CTR and "not interested" feedback rate.

## 1.7 Out of Scope (v1)
- Actual video streaming/playback.
- Payments/subscriptions.
- Social features (following users, sharing lists) — candidate for v2.
- Native mobile apps (web-responsive only for v1).

## 1.8 Assumptions & Constraints
- Movie catalog/metadata sourced from a third-party API (e.g., TMDB) rather than manually entered for all films; admins can supplement/override.
- "Language" refers to the movie's audio/original language, distinct from the UI's display language (i18n) — these should not be conflated in schema or UX.

---

# 2. Technical Requirements Document (TRD)

## 2.1 Architecture Overview
A modular monolith to start (faster to build, easier to reason about), with the **recommendation engine as a logically separate service/module** from day one so it can be extracted into its own microservice later without a rewrite.

```
[Client - React/Next.js]
        │
        ▼
[API Gateway / Backend - Node.js (Express/NestJS) or Python (FastAPI)]
   ├── Auth Module (JWT, RBAC)
   ├── Catalog Module (movies, genres, languages)
   ├── User Module (profile, preferences)
   ├── Interaction Module (events: views, ratings, watchlist)
   ├── Admin Module
   └── Recommendation Service (internal API)
        │
        ▼
[PostgreSQL - primary DB]   [Redis - cache + session]   [Job Queue - BullMQ/Celery]
        │
        ▼
[Recommendation Worker - batch job]
   ├── Content-based model (TF-IDF / cosine similarity on movie metadata)
   ├── Collaborative filtering (matrix factorization: ALS/SVD via implicit/Surprise)
   └── Hybrid ranker → writes precomputed recommendations to DB/cache
        │
        ▼
[External: TMDB/OMDB API for movie metadata + posters]
```

## 2.2 Suggested Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Next.js, Tailwind CSS | SSR for fast first paint, good SEO for movie pages |
| Backend API | Node.js (NestJS) *or* Python (FastAPI) | NestJS if team is JS-first; FastAPI if recommendation logic (Python ML libs) should live in the same service initially |
| Database | PostgreSQL | Relational integrity for users/movies/interactions; supports JSONB for flexible metadata |
| Cache | Redis | Session store, precomputed recommendation cache, rate limiting |
| Job Queue | BullMQ (Node) or Celery (Python) | Async recommendation computation, catalog sync jobs |
| Recommendation/ML | Python: `scikit-learn`, `implicit`, or `Surprise` | Industry-standard, well-documented CF/content-based tooling |
| Auth | JWT (access + refresh), bcrypt | Stateless, scalable |
| Movie Metadata | TMDB API | Free tier, rich metadata (genres, cast, posters, keywords) |
| File/Image Storage | S3-compatible bucket (or just TMDB poster URLs) | Posters can be proxied from TMDB directly to avoid storage cost |
| Hosting | Docker containers on a cloud provider (AWS/GCP/Render/Railway) | Portable, standard CI/CD |
| Monitoring | Sentry (errors) + basic metrics dashboard (Grafana/Prometheus or hosted APM) | Catch issues before users report them |

## 2.3 Recommendation Algorithm — Detailed Approach

| Stage | Trigger | Method | Notes |
|---|---|---|---|
| Cold start | 0 interactions | Filter catalog by user's selected genres/languages/interests, ranked by global popularity/rating | Recompute only when preferences change |
| Content-based | Few interactions (e.g. ≥3 ratings/watchlist adds) | Represent movies as feature vectors (genre, keywords, cast, director via TF-IDF or embeddings); recommend nearest neighbors to movies the user rated highly | Works even for users with sparse data |
| Collaborative filtering | Enough platform-wide interaction density | User-item interaction matrix → matrix factorization (implicit ALS, since most signals are implicit: views/watchlist, not explicit ratings) | Needs periodic retraining (batch job) |
| Hybrid | Steady state | Weighted blend: `score = w1*content_score + w2*cf_score + w3*popularity`, weights shift toward CF as user's interaction count grows | Store final ranked list per user in cache, refreshed on a schedule (e.g. every 6–24h) + light real-time re-ranking for recency |

**Important engineering note:** recommendations should **never be computed synchronously on page load** at scale. A batch worker precomputes top-N recommendations per user periodically and stores them; the API just reads the precomputed list. For brand-new signups, cold-start filtering can be computed on-the-fly since it's a simple DB query, not a model inference.

## 2.4 API Design Principles
- RESTful, versioned (`/api/v1/...`).
- Consistent envelope for responses (`data`, `error`, `meta`).
- Pagination on all list endpoints (cursor or offset-based).
- Idempotent writes where relevant (e.g., toggling watchlist).

## 2.5 Security Requirements
- Passwords: bcrypt (cost factor ≥ 12) or argon2.
- JWT access token: short-lived (15 min); refresh token: longer-lived, rotated, stored httpOnly cookie.
- RBAC middleware on every admin route — never trust client-side role checks alone.
- Rate limiting on `/login`, `/signup`, `/forgot-password` (prevent brute force).
- Input validation/sanitization on all endpoints (schema validation library, e.g. Zod/Joi/Pydantic).
- HTTPS everywhere; secure cookie flags.

## 2.6 Data Pipeline
1. Client emits interaction events → Interaction API → written to `user_interactions` table.
2. Nightly (or hourly) batch job aggregates interactions → feeds recommendation models.
3. Model outputs written to `recommendations` cache table (per user, top-N movie IDs + scores).
4. Movie catalog synced from TMDB on a schedule (new releases, metadata updates) via a separate ingestion job.

## 2.7 Third-Party Integrations
- **TMDB API**: movie metadata, posters, cast, genres — primary catalog source.
- **Email provider** (SendGrid/SES): verification & password reset emails.

---

# 3. App Flow

## 3.1 New User Registration & Onboarding
```
Landing Page
   → Sign Up (email, password, name)
   → Verify Email (link sent)
   → Onboarding Step 1: Select Genres (multi-select, min 3)
   → Onboarding Step 2: Select Languages (multi-select, min 1)
   → Onboarding Step 3: Select Interests/Moods (optional multi-select)
   → Home (Cold-Start Feed)
```

## 3.2 Returning User Login
```
Login Page (email + password)
   → JWT issued
   → Home (Personalized Feed, tier depends on interaction history)
```

## 3.3 Home / Browsing Flow
```
Home Feed
   ├── Row: "Top picks for you" (personalized, hybrid)
   ├── Row: "Popular in [Genre]" (per top genre from preferences)
   ├── Row: "Because you watched [Movie X]" (content-based, once available)
   ├── Row: "Trending Now" (global popularity, fallback)
   → Click movie → Movie Detail Page
   → Search icon → Search/Filter Page
```

## 3.4 Movie Detail & Interaction Flow
```
Movie Detail Page
   → Rate movie (1-5) → event logged → feed refresh queued
   → Add to Watchlist → event logged
   → Mark as Watched → event logged
   → View "Similar Movies" → content-based module
```

## 3.5 Recommendation Feedback Loop
```
User rates/watchlists/searches
   → Event stored in user_interactions
   → Nightly batch job re-scores user's recommendation profile
   → Updated recommendations available next session
   (optional real-time nudge: re-rank top row using last 24h signals)
```

## 3.6 Admin Flow
```
Admin Login (separate check: role = admin)
   → Admin Dashboard (KPIs: DAU, signups, top genres, top movies)
   → Manage Movies (CRUD, bulk import from TMDB sync)
   → Manage Genres/Languages/Interest Tags (master data CRUD)
   → Manage Users (search, view profile, deactivate, promote to admin)
   → View Recommendation Health (CTR, cold-start vs personalized split)
```

---

# 4. UI/UX

## 4.1 Screen Inventory

| Screen | Purpose |
|---|---|
| Landing / Marketing | Value prop + CTA to sign up |
| Sign Up | Email, password, name |
| Login | Email, password, "forgot password" link |
| Email Verification | Confirmation state |
| Onboarding — Genres | Visual grid of genre chips, multi-select |
| Onboarding — Languages | List/grid of languages, multi-select |
| Onboarding — Interests | Tag chips (mood/theme based) |
| Home | Personalized rows of movie cards |
| Search / Browse | Search bar + filters (genre, language, year, rating) + results grid |
| Movie Detail | Poster, info, actions, similar movies |
| Watchlist | Grid of saved movies |
| Profile / Settings | Edit preferences, account info, logout |
| Admin Dashboard | KPI cards + charts |
| Admin — Movies | Table + CRUD modal/form |
| Admin — Genres/Languages | Table + CRUD |
| Admin — Users | Table, search, role toggle, deactivate |

## 4.2 UX Principles
- **Minimize onboarding friction** — chip-based multi-select (tap to select), not dropdowns or free text. Should take under 60 seconds.
- **Progressive personalization should be visible** — label rows honestly ("Popular in Action" vs "Picked for you based on your ratings") so users understand *why* the feed changes over time — builds trust.
- **Always give an escape hatch from a recommendation** — a lightweight "not interested" on hover/long-press feeds negative signal back into the model.
- **Dark theme by default** — standard convention for media/streaming-style apps, reduces eye strain, makes posters pop.
- **Empty/loading states matter** — cold-start users, empty watchlist, and empty search results all need designed states, not blank screens.

## 4.3 Key Screen Notes

**Onboarding (Genres/Languages/Interests):**
- Chip grid, selected state = filled/highlighted.
- Sticky "Continue" button, disabled until minimum selection met.
- Progress indicator (Step 1 of 3).

**Home Feed:**
- Horizontal scrollable rows (Netflix-style), poster cards with hover preview (title, rating, quick-add-to-watchlist icon).
- Section headers double as explanation of recommendation source.

**Movie Detail:**
- Hero banner (backdrop image) + poster + metadata block.
- Primary actions (Rate, Watchlist, Mark Watched) prominent, above the fold.
- "Similar Movies" row below synopsis/cast.

**Admin Dashboard:**
- KPI cards on top (Total Users, DAU, Total Movies, Avg. Recommendation CTR).
- Charts: signups over time, top genres by engagement.
- Quick links to Movies/Users/Genres management.

## 4.4 Design System Notes
- **Typography:** one strong display font for titles/headers, a clean sans-serif for body (e.g., Inter).
- **Color:** dark background (#0d0d0f-ish), single accent color for CTAs/ratings, muted grays for secondary text.
- **Components:** movie card, chip/tag, rating stars, modal (admin CRUD), data table (admin), toast notifications (feedback on actions like "Added to Watchlist").

---

# 5. Backend Schema

## 5.1 Entity Overview
Core entities: `users`, `genres`, `languages`, `interests`, `movies`, `movie_genres`, `user_preferences`, `user_interactions`, `ratings`, `watchlist`, `recommendations`.

## 5.2 Tables

### `users`
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| name | VARCHAR | |
| email | VARCHAR, unique | |
| password_hash | VARCHAR | bcrypt hash |
| role | ENUM('user','admin') | default 'user' |
| is_email_verified | BOOLEAN | default false |
| is_active | BOOLEAN | default true (admin can deactivate) |
| onboarding_completed | BOOLEAN | default false |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### `genres`
| Column | Type | Notes |
|---|---|---|
| id | SERIAL (PK) | |
| name | VARCHAR, unique | e.g. "Action" |

### `languages`
| Column | Type | Notes |
|---|---|---|
| id | SERIAL (PK) | |
| code | VARCHAR | e.g. "en", "hi", "ko" |
| name | VARCHAR | e.g. "English" |

### `interests`
| Column | Type | Notes |
|---|---|---|
| id | SERIAL (PK) | |
| name | VARCHAR | e.g. "Feel-good", "True Story", "Award-winning" |

### `user_preferences`
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| user_id | UUID (FK → users.id) | |
| genre_id | INT (FK → genres.id) | one row per selected genre |
| language_id | INT (FK → languages.id, nullable) | one row per selected language |
| interest_id | INT (FK → interests.id, nullable) | one row per selected interest |

*(Alternative: three separate junction tables `user_genres`, `user_languages`, `user_interests` — cleaner than one polymorphic table; recommended over the combined version above.)*

### `movies`
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| tmdb_id | INT, unique, nullable | external reference |
| title | VARCHAR | |
| synopsis | TEXT | |
| release_year | INT | |
| poster_url | VARCHAR | |
| backdrop_url | VARCHAR | |
| primary_language_id | INT (FK → languages.id) | |
| avg_rating | DECIMAL | denormalized, updated via trigger/job |
| popularity_score | DECIMAL | denormalized, updated via job |
| metadata | JSONB | cast, director, keywords — flexible for content-based features |
| created_at | TIMESTAMP | |

### `movie_genres`
| Column | Type | Notes |
|---|---|---|
| movie_id | UUID (FK → movies.id) | |
| genre_id | INT (FK → genres.id) | composite PK (movie_id, genre_id) |

### `user_interactions`
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| user_id | UUID (FK → users.id) | |
| movie_id | UUID (FK → movies.id) | |
| event_type | ENUM('view','watchlist_add','watchlist_remove','watched','search','not_interested') | |
| metadata | JSONB | e.g. watch duration, search query text |
| created_at | TIMESTAMP | indexed — this table grows fast, partition by date if needed |

### `ratings`
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| user_id | UUID (FK → users.id) | |
| movie_id | UUID (FK → movies.id) | |
| score | SMALLINT | 1–5 |
| created_at | TIMESTAMP | |
| | | unique constraint (user_id, movie_id) |

### `watchlist`
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| user_id | UUID (FK → users.id) | |
| movie_id | UUID (FK → movies.id) | |
| added_at | TIMESTAMP | unique (user_id, movie_id) |

### `recommendations` (precomputed cache)
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| user_id | UUID (FK → users.id) | |
| movie_id | UUID (FK → movies.id) | |
| source | ENUM('cold_start','content_based','collaborative','popularity') | for explainability + analytics |
| score | DECIMAL | ranking score |
| generated_at | TIMESTAMP | |

## 5.3 Relationships
- `users` 1—N `user_interactions`, `ratings`, `watchlist`, `recommendations`
- `users` N—N `genres`/`languages`/`interests` via preference junction tables
- `movies` N—N `genres` via `movie_genres`
- `movies` 1—N `ratings`, `user_interactions`, `watchlist`, `recommendations`

## 5.4 Indexing Notes
- `user_interactions(user_id, created_at)` — feed the recommendation job efficiently.
- `movies(popularity_score)`, `movies(avg_rating)` — power "trending" / cold-start sorting.
- `recommendations(user_id, score)` — fast read for home feed.

---

# 6. Implementation Plan

## Phase 0 — Foundations (Week 1–2)
- Repo setup, CI/CD skeleton, environment configs.
- DB schema migration setup.
- TMDB API integration for movie ingestion (seed catalog).

## Phase 1 — Auth & Onboarding (Week 2–4)
- Signup/login/JWT, email verification, password reset.
- Genre/Language/Interest master data + admin CRUD for them.
- Onboarding flow (frontend + API) writing to `user_preferences`.

## Phase 2 — Catalog & Cold-Start Feed (Week 4–6)
- Movie browse/search/filter APIs.
- Movie detail page.
- Cold-start home feed (genre/language filtered, popularity-ranked).

## Phase 3 — Behavior Tracking (Week 6–7)
- Interaction event logging API (view, watchlist, rating, search).
- Ratings & watchlist features (frontend + API).

## Phase 4 — Content-Based Recommendations (Week 7–9)
- Feature extraction from movie metadata (genre, keywords, cast).
- Similarity computation (TF-IDF/cosine or embeddings).
- "Similar movies" module + "Because you watched X" row.

## Phase 5 — Collaborative Filtering & Hybrid Ranking (Week 9–12)
- User-item interaction matrix build.
- Matrix factorization model (batch trained).
- Hybrid scoring + precomputed `recommendations` table.
- Batch job scheduling (nightly retraining).

## Phase 6 — Admin Panel (Week 10–12, parallel to Phase 5)
- Movie CRUD, user management, analytics dashboard.
- Recommendation health metrics (CTR, source distribution).

## Phase 7 — Hardening & Launch (Week 12–14)
- Rate limiting, security review, load testing.
- Monitoring/alerting setup.
- Beta rollout → gather real feedback loop data → tune weights.

*(Timeline assumes a small team of 2–4 engineers; compress/expand based on actual team size.)*

---

# 7. What You Might Have Missed

- **Email verification & forgot-password flow** — not mentioned in your brief but essential for any auth system.
- **Recommendation explainability** — labeling *why* a movie is shown ("Because you liked X") builds trust and gives you a debugging signal.
- **Negative feedback signal** — a "not interested" action is as valuable as positive signals for both CF and content models; without it the system can only get positive reinforcement.
- **Movie cold start** (distinct from user cold start) — brand-new movies with no ratings need a fallback (popularity/metadata-based) until they accumulate interaction data.
- **Data privacy/consent** — since you're tracking behavior, users should know what's tracked and be able to view/delete it (especially relevant if you ever operate in GDPR-covered regions).
- **Rate limiting & abuse prevention** on auth endpoints — brute-force protection.
- **Language (movie audio) vs UI language (i18n)** — easy to conflate; keep them as separate concepts in schema and settings.
- **Admin sub-roles** — consider whether all admins should have equal power, or whether you need a "moderator" tier later (content only, no user management).
- **Notifications** — optional but common: "new release in your favorite genre," re-engagement nudges.
- **Content moderation** — if you ever add user reviews/comments, you'll need reporting/flagging.
- **Caching strategy** — recommendations should be precomputed/cached, not computed live per request, or it won't scale.
- **A/B testing hooks** — you'll want to test different weighting schemes for the hybrid model against real engagement, so build the recommendation source/version into the schema now (already reflected in the `recommendations.source` column above) rather than retrofitting later.
- **Analytics/CTR tracking on recommendation rows specifically** — separate from general interaction tracking, so you can measure whether personalization is actually working.

---

*End of document.*
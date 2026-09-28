# Communication Assistant - Backend

NestJS + TypeScript + PostgreSQL (Supabase) + Prisma backend for an English Communication
and Placement Training platform for Computer Science and Engineering students.

Mobile and web clients talk **only** to this API. No client ever talks directly to
PostgreSQL, Supabase Storage, or any AI provider (STT/LLM/TTS) - all of that is
orchestrated behind this backend so provider credentials never leave the server and
providers can be swapped without touching client apps.

## Status: IMPLEMENTED vs MOCKED vs PLANNED

This is a from-scratch foundation build. Being explicit about what's real:

| Area | Status |
|---|---|
| Auth (register/login/refresh/logout/me), JWT, RBAC | **IMPLEMENTED** |
| Prisma schema, migrations, seed data | **IMPLEMENTED** (needs a real Supabase DB - see below) |
| Activities, Attempts, Assessments, Progress, Recommendations, Dashboard | **IMPLEMENTED** |
| Interviews, Roleplay, Debate, Writing, Reports | **IMPLEMENTED** (rule/LLM-driven scoring) |
| AI abstraction layer (STT/LLM/TTS/Pronunciation interfaces + services) | **IMPLEMENTED** |
| STT / LLM / TTS / Pronunciation providers | **MOCKED** - deterministic, offline, rule-based stand-ins. See each provider's docstring. No paid API calls happen anywhere in this codebase today. |
| Supabase Storage for audio | **IMPLEMENTED** (requires real Supabase credentials to actually upload) |
| AI cost/usage observability (`AiUsageLog`) | **IMPLEMENTED** (measurement only, not billing) |
| Rate limiting | **IMPLEMENTED** (global + tighter limits on AI/voice endpoints) |
| Real STT/LLM/TTS provider adapters (OpenAI, Whisper, ElevenLabs, etc.) | **PLANNED** - swap by implementing the provider interfaces in `src/ai/*/providers/` and pointing `STT_PROVIDER` / `LLM_PROVIDER` / `TTS_PROVIDER` at them. No call site changes needed. |
| College ERP integration | **PLANNED** - `StudentProfile.externalStudentId` is reserved for this; nothing else is built. |
| Real-time audio streaming | **PLANNED** - current voice pipeline is request/response, not streaming. |

## Tech stack

- **Framework**: NestJS 11 (TypeScript, strict mode)
- **Database**: PostgreSQL via Supabase
- **ORM**: Prisma 6
- **Auth**: JWT (access + refresh, rotation, revocation)
- **Storage**: Supabase Storage (private bucket, signed URLs)
- **Docs**: Swagger/OpenAPI (`/api/v1/docs`, non-production only)
- **Validation**: class-validator / class-transformer
- **Testing**: Jest + Supertest

## Project structure

```
src/
  main.ts, app.module.ts
  config/            # typed configuration + Joi env validation
  common/            # filters, interceptors, decorators, middleware, shared types
  prisma/            # PrismaService/PrismaModule
  auth/               users/               students/
  skills/             activities/           attempts/
  assessments/        progress/             recommendations/
  dashboard/
  interviews/         roleplay/             debates/            writing/
  reports/
  storage/            # Supabase Storage abstraction
  ai/
    stt/  llm/  tts/  assessment/  usage/  conversation/
  voice/              # transcribe / synthesize / analyze endpoints
  health/
prisma/
  schema.prisma
  seed.ts
```

Networking activities (elevator pitch, professional introduction, etc.) are represented as
regular `Activity` rows with `type = NETWORKING` rather than a separate module, per the spec.

## Environment variables

Copy `.env.example` to `.env` and fill in real values. Key ones:

- `DATABASE_URL` / `DIRECT_URL` - Supabase Postgres connection strings (pooled / direct).
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` - long random secrets, never commit real ones.
- `AI_MODE=mock` - keeps all AI calls on the built-in mock providers (default, no paid API keys needed).
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_STORAGE_BUCKET` - for audio storage.

Never commit `.env`. Never log secrets - the logging interceptor and exception filter are
written to avoid echoing request bodies or provider credentials.

## Getting started

```bash
npm install

# 1. Fill in .env with a real Supabase DATABASE_URL / DIRECT_URL (see .env.example)
cp .env.example .env

# 2. Generate the Prisma client
npm run prisma:generate

# 3. Create/run migrations against your Supabase database
npm run prisma:migrate

# 4. Seed skills, activities, interviews, roleplays, debates, writing activities
npm run db:seed

# 5. Run the API
npm run start:dev
```

The API is served under `/api/v1` (e.g. `http://localhost:3000/api/v1/health`).
Swagger docs are at `/api/v1/docs` when `NODE_ENV !== production`.

### Without a Supabase project yet

Prisma needs a real reachable Postgres instance to run migrations against - there is no way
around that. Everything else (mock AI providers, business logic) works without any other
paid service. Point `DATABASE_URL`/`DIRECT_URL` at any Postgres instance (a free Supabase
project is the intended target) to unblock steps 2-4 above.

## Scripts

| Script | Purpose |
|---|---|
| `npm run start:dev` | Start with hot reload |
| `npm run build` / `npm run start:prod` | Production build/run |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm test` / `npm run test:cov` | Unit tests |
| `npm run test:e2e` | End-to-end tests (Supertest) |
| `npm run prisma:generate` | Regenerate the Prisma client after schema changes |
| `npm run prisma:migrate` | Create and apply a migration |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run db:seed` | Seed skills/activities/interviews/roleplays/debates/writing activities |

## Architecture principle: backend as the only AI gateway

```
Mobile / Web  --HTTPS/REST-->  NestJS  --Prisma-->  Supabase PostgreSQL
                                  |----> Supabase Storage
                                  |----> AI Service Layer --> STT / LLM / TTS providers
```

Clients call endpoints like `POST /api/v1/voice/analyze` or `POST /api/v1/ai/conversation`.
NestJS resolves the configured provider (`SpeechToTextService`, `LanguageModelService`,
`TextToSpeechService`) and calls it - provider API keys live only in this backend's
environment variables and are never sent to a client. Swapping `STT_PROVIDER=mock` for a
real provider name (once its adapter is implemented) requires no client-side changes.

System prompts for the AI conversation partner, interviews, roleplay, debate, and writing
assessment are all constructed in backend code (`src/ai/**/prompts/*`) - a client can never
supply or override a system prompt.

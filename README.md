# Trao Interview Prep

Trao generates a structured **interview preparation kit** from a job description and company website: requirements, company brief, practice questions, flashcards, and a multi-day study schedule.

The mandatory Trao assessment entry point is the batch evaluator:

```bash
npm run evaluate -- --input cases.json --output kits.json
```

---

## Repository structure

```text
traq/
├── package.json              # Root: npm run evaluate
├── cases.json                # Sample evaluation cases
├── kits.json                 # Evaluator output (generated)
├── README.md
├── backend/
│   ├── package.json
│   ├── .env                  # Local secrets (not committed)
│   └── src/
│       ├── server.ts         # Express API (health + Mongo)
│       ├── config/db.ts
│       ├── cli/
│       │   ├── evaluate.ts   # Batch evaluator (required)
│       │   ├── test-pipeline.ts
│       │   ├── test-run-pipeline.ts
│       │   └── ...           # Stage-level test scripts
│       ├── pipeline/
│       │   ├── runPipeline.ts
│       │   ├── extractRequirements.ts
│       │   ├── crawlCompany.ts
│       │   ├── generateCompanyBrief.ts
│       │   ├── generateQuestions.ts
│       │   ├── ensureCoverage.ts
│       │   ├── generateFlashcards.ts
│       │   ├── schedule.ts
│       │   ├── coverage.ts
│       │   └── interviewResearch.ts
│       ├── schemas/kit.schema.ts
│       └── utils/
│           ├── groq.ts
│           ├── firecrawl.ts
│           └── retry.ts
└── frontend/                 # Next.js app (starter; not wired yet)
```

---

## Prerequisites

- Node.js 18+
- MongoDB (only required for the HTTP API server)
- [Groq](https://console.groq.com/) API key
- [Firecrawl](https://www.firecrawl.dev/) API key (used for optional interview research paths)

---

## Setup

### 1. Install backend dependencies

```bash
cd backend
npm install
```

### 2. Configure environment

Create `backend/.env`:

```env
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
FIRECRAWL_API_KEY=your_firecrawl_api_key
MONGODB_URI=mongodb://127.0.0.1:27017/trao
PORT=5000

# Optional: allow localhost company URLs (e.g. Trao local fixtures)
# ALLOW_PRIVATE_URLS=true
```

| Variable | Required for | Notes |
|----------|--------------|--------|
| `GROQ_API_KEY` | Pipeline / evaluate | LLM calls |
| `GROQ_MODEL` | Optional | Defaults to `llama-3.3-70b-versatile` |
| `FIRECRAWL_API_KEY` | Interview research util | Loaded at import of firecrawl util |
| `MONGODB_URI` | `npm run dev` / API only | Not needed for `evaluate` |
| `PORT` | API only | Defaults to `5000` |
| `ALLOW_PRIVATE_URLS` | Optional | Set `true` for local fixture hosts |

Root install is not required for evaluate (root `package.json` only proxies into `backend`).

---

## Mandatory: batch evaluation

From the **repo root** (`traq/`):

```bash
npm run evaluate -- --input cases.json --output kits.json
```

This:

1. Reads an array of cases from `--input`
2. Runs `runPipeline` for each case
3. **Continues after individual failures**
4. Writes a results file to `--output`

### Case format (`cases.json`)

```json
[
  {
    "id": "case-trao-swe",
    "jd": "Software Engineer\n\n...",
    "company_url": "https://www.trao.ai",
    "days": 5
  },
  {
    "id": "case-broken-company",
    "jd": "Software Engineer\n\n...",
    "company_url": "https://this-domain-definitely-does-not-exist-trao-test.invalid",
    "days": 3
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Case identifier |
| `jd` | string | Full job description text |
| `company_url` | string | Company homepage URL |
| `days` | number | Study schedule length (1–60) |

### Output format (`kits.json`)

```json
{
  "version": "1.0",
  "generated_at": "2026-...",
  "kits": [
    {
      "id": "case-trao-swe",
      "status": "ok",
      "kit": { "...validated KitSchema..." },
      "error": null
    },
    {
      "id": "case-broken-company",
      "status": "failed",
      "kit": null,
      "error": {
        "code": "COMPANY_UNREACHABLE",
        "message": "..."
      }
    }
  ]
}
```

### Failure codes

| Code | When |
|------|------|
| `COMPANY_UNREACHABLE` | Bad URL, DNS failure, timeout, 404-like crawl errors |
| `RATE_LIMITED` | Upstream rate limit message |
| `INVALID_JOB_DESCRIPTION` | JD-related validation errors |
| `KIT_VALIDATION_FAILED` | Zod / schema validation failures |
| `PIPELINE_FAILED` | All other pipeline errors |

Relative `--input` / `--output` paths are resolved from the directory where you ran `npm` (`INIT_CWD`), so root-level `cases.json` works even though the script runs under `backend/`.

---

## Pipeline

Entry point: `backend/src/pipeline/runPipeline.ts`

```text
JD + company_url + days
        │
        ▼
1. extractRequirements     (Groq)   → role, requirements
        │
        ▼
2. crawlCompany            (HTTP)   → homepage + related pages
        │
        ▼
3. generateCompanyBrief    (Groq)   → summary, what_they_do, sources
        │
        ▼
4. generateAllQuestions    (Groq)   → technical / behavioural /
   (per category)                     system-design / company-fit
        │
        ▼
5. ensureCoverage          (Groq)   → fill gaps for uncovered must-haves only
        │
        ▼
6. generateFlashcards      (Groq)
        │
        ▼
7. buildSchedule           (local)  → N-day plan
        │
        ▼
8. KitSchema.parse         (Zod)    → validated kit or throw
```

### Robustness

- Every Groq call goes through `withRetry()` (`backend/src/utils/retry.ts`): retries 429 / 5xx with exponential backoff and `retry-after` support.
- `ensureCoverage` only generates questions for **missing** requirements via `generateQuestionsForCategory`, not a full second pass of all categories.
- Nothing leaves the pipeline unless it passes `KitSchema`.

### Kit shape (summary)

Validated by `backend/src/schemas/kit.schema.ts`:

- **source** — company, URL, role, JD length, pages used, timestamp
- **company_brief** — summary, what they do, sources
- **role** — title, seniority, responsibilities, requirements (`must` / `nice`, kinds: technical / behavioural / domain)
- **questions** — categories, prompts, answer outlines, difficulty 1–3, linked requirement IDs
- **flashcards** — front / back, linked requirement IDs
- **schedule** — `days_available` + per-day focus, question IDs, minutes
- **coverage** — uncovered must-have IDs + pass count

---

## Local development commands

### Batch evaluate (from repo root)

```bash
npm run evaluate -- --input cases.json --output kits.json
```

### Full pipeline smoke test (backend)

```bash
cd backend
npx tsx src/cli/test-run-pipeline.ts
# or
npx tsx src/cli/test-pipeline.ts
```

### Stage CLIs (backend)

| Script | Purpose |
|--------|---------|
| `src/cli/test-extraction.ts` | Requirement extraction |
| `src/cli/test-crawler.ts` | Company crawl |
| `src/cli/test-company-brief.ts` | Company brief |
| `src/cli/test-firecrawl.ts` | Firecrawl smoke test |
| `src/cli/test-interview-research.ts` | Public interview research |

### HTTP API

```bash
cd backend
npm run dev    # tsx watch src/server.ts
# or
npm start
```

- `GET /health` → `{ success: true, message: "Trao Interview Kit API is running" }`
- Connects to MongoDB on startup
- Routes / controllers / auth are scaffolded but not fully productized yet

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Next.js 16 starter on `http://localhost:3000`. Not yet connected to the kit pipeline.

---

## Sample evaluate result

Verified locally with the included `cases.json`:

| Case | Result |
|------|--------|
| `case-trao-swe` | `ok` — full kit (requirements, questions, flashcards, 5-day schedule, zero uncovered must-haves) |
| `case-broken-company` | `failed` — `COMPANY_UNREACHABLE` (hostname does not resolve); does **not** stop the batch |

---

## Tech stack

| Layer | Stack |
|-------|--------|
| Backend | Node.js, Express 5, TypeScript (`tsx`), Zod, Mongoose |
| LLM | Groq (`llama-3.3-70b-versatile` by default) |
| Crawl | Axios + Cheerio (company site); Firecrawl SDK for research helpers |
| Frontend | Next.js 16, React 19, Tailwind 4 |

---

## Notes / known follow-ups

- Question generation can still invent adjacent tech (e.g. Redis, Kubernetes) not present in the JD; tighten prompts before final submission.
- Frontend and persistent kit APIs are incomplete relative to the pipeline.
- Keep secrets in `backend/.env` only — never commit API keys.

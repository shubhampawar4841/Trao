"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

const generationSteps = [
  "Extracting role requirements",
  "Researching company",
  "Finding relevant company pages",
  "Building company brief",
  "Generating interview questions",
  "Checking requirement coverage",
  "Creating flashcards",
  "Building your study schedule",
];

interface CreateKitResponse {
  success: boolean;
  reused?: boolean;

  kit: {
    id: string;
    status: string;
  };

  diagnostics?: PipelineDiagnostics;
}

interface PipelineDiagnostics {
  requirementCount: number;
  companyPagesFound: number;
  hasHiringPage: boolean;
  skippedSources: {
    url: string;
    reason: string;
  }[];
  publicDiscussionFound: boolean;
  publicDiscussionSources: number;
  publicDiscussionNote: string;
  questionCount: number;
  uncoveredMustHaveCount: number;
  coveragePasses: number;
  scheduleDays: number;
}

interface SummaryItem {
  status: "ok" | "warn";
  label: string;
}

type InputMode = "single" | "batch";

interface BatchCase {
  id: string;
  jd: string;
  company_url: string;
  days: number;
}

interface BatchCreateResponse {
  success: boolean;

  results: Array<{
    id: string;
    status: "ok" | "failed";
    kitId: string | null;
    reused?: boolean;
    error: {
      code?: string;
      message: string;
    } | null;
  }>;
}

const MAX_BATCH_CASES = 10;
const MAX_BATCH_FILE_BYTES = 1_000_000;

export default function NewKitPage() {
  const router = useRouter();

  const [jd, setJd] = useState("");
  const [companyUrl, setCompanyUrl] =
    useState("");
  const [days, setDays] = useState(5);

  const [mode, setMode] =
    useState<InputMode>("single");

  const [batchCases, setBatchCases] =
    useState<BatchCase[]>([]);

  const [batchFileName, setBatchFileName] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [stepIndex, setStepIndex] =
    useState(0);

  const [error, setError] =
    useState("");

  const [completedKitId, setCompletedKitId] =
    useState<string | null>(null);

  const [diagnostics, setDiagnostics] =
    useState<PipelineDiagnostics | null>(
      null
    );

  const [reusedExisting, setReusedExisting] =
    useState(false);

  useEffect(() => {
    if (!loading) {
      setStepIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setStepIndex((current) =>
        Math.min(
          current + 1,
          generationSteps.length - 1
        )
      );
    }, 4500);

    return () => clearInterval(interval);
  }, [loading]);

  function buildSummaryItems(
    data: PipelineDiagnostics
  ): SummaryItem[] {
    const items: SummaryItem[] = [
      {
        status: "ok",
        label: `${data.requirementCount} requirement${
          data.requirementCount === 1 ? "" : "s"
        } extracted`,
      },
      {
        status: "ok",
        label: "Company homepage analyzed",
      },
    ];

    if (data.hasHiringPage) {
      items.push({
        status: "ok",
        label: "Careers / hiring page found",
      });
    } else if (data.companyPagesFound > 0) {
      items.push({
        status: "warn",
        label: `${data.companyPagesFound} company page${
          data.companyPagesFound === 1 ? "" : "s"
        } researched (no clear careers page)`,
      });
    } else {
      items.push({
        status: "warn",
        label: "No additional company pages found",
      });
    }

    if (data.skippedSources.length > 0) {
      items.push({
        status: "warn",
        label: `${data.skippedSources.length} company page${
          data.skippedSources.length === 1
            ? ""
            : "s"
        } skipped`,
      });
    }

    if (data.publicDiscussionFound) {
      items.push({
        status: "ok",
        label: `${data.publicDiscussionSources} public interview source${
          data.publicDiscussionSources === 1
            ? ""
            : "s"
        } verified`,
      });
    } else {
      items.push({
        status: "warn",
        label:
          "No public interview discussion found",
      });
    }

    items.push({
      status: "ok",
      label: `${data.questionCount} questions generated`,
    });

    items.push({
      status:
        data.uncoveredMustHaveCount === 0
          ? "ok"
          : "warn",
      label:
        data.uncoveredMustHaveCount === 0
          ? "Coverage complete"
          : `${data.uncoveredMustHaveCount} must-have${
              data.uncoveredMustHaveCount === 1
                ? ""
                : "s"
            } still uncovered`,
    });

    items.push({
      status: "ok",
      label: `${data.scheduleDays}-day schedule built`,
    });

    return items;
  }

  function validateBatchCase(
    value: unknown,
    index: number
  ): BatchCase {
    if (
      !value ||
      typeof value !== "object"
    ) {
      throw new Error(
        `Role ${index + 1} must be an object`
      );
    }

    const item = value as Record<
      string,
      unknown
    >;

    const jd =
      typeof item.jd === "string"
        ? item.jd.trim()
        : "";

    const companyUrl =
      typeof item.company_url === "string"
        ? item.company_url.trim()
        : "";

    const days = Number(item.days);

    const id =
      typeof item.id === "string" &&
      item.id.trim()
        ? item.id.trim()
        : `role-${index + 1}`;

    if (!jd) {
      throw new Error(
        `Role ${index + 1}: job description is required`
      );
    }

    if (!companyUrl) {
      throw new Error(
        `Role ${index + 1}: company_url is required`
      );
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(companyUrl);
    } catch {
      throw new Error(
        `Role ${index + 1}: invalid company URL`
      );
    }

    if (
      !["http:", "https:"].includes(
        parsedUrl.protocol
      )
    ) {
      throw new Error(
        `Role ${index + 1}: company URL must use HTTP or HTTPS`
      );
    }

    if (
      !Number.isInteger(days) ||
      days < 1 ||
      days > 60
    ) {
      throw new Error(
        `Role ${index + 1}: days must be between 1 and 60`
      );
    }

    return {
      id,
      jd,
      company_url: companyUrl,
      days,
    };
  }

  async function handleBatchFile(
    file: File | undefined
  ) {
    if (!file) return;

    setError("");
    setBatchCases([]);
    setBatchFileName("");

    if (
      !file.name
        .toLowerCase()
        .endsWith(".json")
    ) {
      setError(
        "Upload a .json file"
      );
      return;
    }

    if (
      file.size >
      MAX_BATCH_FILE_BYTES
    ) {
      setError(
        "Batch file must be smaller than 1 MB"
      );
      return;
    }

    try {
      const text =
        await file.text();

      const parsed: unknown =
        JSON.parse(text);

      if (!Array.isArray(parsed)) {
        throw new Error(
          "Batch file must contain a JSON array"
        );
      }

      if (parsed.length === 0) {
        throw new Error(
          "Batch file contains no roles"
        );
      }

      if (
        parsed.length >
        MAX_BATCH_CASES
      ) {
        throw new Error(
          `Maximum ${MAX_BATCH_CASES} roles per batch`
        );
      }

      const validated =
        parsed.map(
          (item, index) =>
            validateBatchCase(
              item,
              index
            )
        );

      const ids =
        validated.map(
          (item) => item.id
        );

      if (
        new Set(ids).size !==
        ids.length
      ) {
        throw new Error(
          "Every role must have a unique id"
        );
      }

      setBatchCases(validated);
      setBatchFileName(
        file.name
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not read batch file"
      );
    }
  }

  async function handleBatchSubmit() {
    if (
      batchCases.length === 0
    ) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response =
        await api<BatchCreateResponse>(
          "/api/kits/batch",
          {
            method: "POST",

            body: JSON.stringify({
              cases: batchCases,
            }),
          }
        );

      const successful =
        response.results.filter(
          (result) =>
            result.status === "ok"
        );

      if (
        successful.length === 1 &&
        successful[0]?.kitId
      ) {
        router.push(
          `/kits/${successful[0].kitId}`
        );

        return;
      }

      router.push(
        "/dashboard"
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not generate batch"
      );

      setLoading(false);
    }
  }

  async function handleSubmit(
    event: FormEvent
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response =
        await api<CreateKitResponse>(
          "/api/kits",
          {
            method: "POST",

            body: JSON.stringify({
              jd,
              company_url: companyUrl,
              days,
            }),
          }
        );

      setCompletedKitId(
        String(response.kit.id)
      );
      setReusedExisting(
        Boolean(response.reused)
      );
      setDiagnostics(
        response.diagnostics ?? null
      );
      setLoading(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not generate interview kit"
      );

      setLoading(false);
    }
  }

  if (
    completedKitId &&
    mode === "single" &&
    (diagnostics || reusedExisting)
  ) {
    const summaryItems = diagnostics
      ? buildSummaryItems(diagnostics)
      : [];

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080808] px-6 text-white">
        <div className="w-full max-w-xl">
          <div className="mb-8 flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />

            <span className="text-sm tracking-[0.15em] text-emerald-400">
              {reusedExisting
                ? "EXISTING KIT REUSED"
                : "GENERATION COMPLETE"}
            </span>
          </div>

          <h1 className="text-4xl font-semibold tracking-tight">
            {reusedExisting
              ? "You already have this kit."
              : "Your interview kit is ready."}
          </h1>

          <p className="mt-4 text-zinc-500">
            {reusedExisting
              ? "Same job description, company, and days — opened your existing completed kit instead of regenerating."
              : "Honest research summary before you open the kit — including pages we could not use and interview discussions we could not verify."}
          </p>

          {summaryItems.length > 0 && (
            <div className="mt-10 space-y-2">
              {summaryItems.map((item) => (
                <div
                  key={item.label}
                  className={`flex items-start gap-4 rounded-xl border px-4 py-3 ${
                    item.status === "ok"
                      ? "border-emerald-500/20 bg-emerald-500/[0.04]"
                      : "border-amber-500/20 bg-amber-500/[0.04]"
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                      item.status === "ok"
                        ? "bg-emerald-400 text-black"
                        : "bg-amber-400/20 text-amber-400"
                    }`}
                  >
                    {item.status === "ok"
                      ? "✓"
                      : "!"}
                  </div>

                  <span
                    className={`text-sm leading-6 ${
                      item.status === "ok"
                        ? "text-zinc-200"
                        : "text-amber-200/90"
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {diagnostics &&
            diagnostics.skippedSources.length >
              0 && (
            <div className="mt-6 rounded-xl border border-white/5 bg-black/30 p-4">
              <div className="text-[10px] uppercase tracking-wider text-zinc-600">
                Skipped sources
              </div>

              <div className="mt-3 space-y-2">
                {diagnostics.skippedSources.map(
                  (source) => (
                    <div
                      key={source.url}
                      className="text-xs leading-5 text-zinc-500"
                    >
                      <div className="truncate text-zinc-400">
                        {source.url}
                      </div>
                      <div className="mt-0.5 text-zinc-600">
                        {source.reason}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {diagnostics &&
            !diagnostics.publicDiscussionFound &&
            diagnostics.publicDiscussionNote && (
              <p className="mt-5 text-xs leading-5 text-zinc-600">
                {diagnostics.publicDiscussionNote}
              </p>
            )}

          <button
            type="button"
            onClick={() =>
              router.push(
                `/kits/${completedKitId}`
              )
            }
            className="mt-10 w-full rounded-xl bg-white px-6 py-3.5 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            Open interview kit →
          </button>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080808] px-6 text-white">
        <div className="w-full max-w-xl">

          <div className="mb-8 flex items-center gap-3">
            <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />

            <span className="text-sm tracking-[0.15em] text-emerald-400">
              BUILDING YOUR KIT
            </span>
          </div>

          <h1 className="text-4xl font-semibold tracking-tight">
            {mode === "batch"
              ? `Building ${batchCases.length} interview kits.`
              : "Researching your interview."}
          </h1>

          <p className="mt-4 text-zinc-500">
            {mode === "batch"
              ? "Each role is processed independently. A failed role will not stop the rest of the batch."
              : "This can take around a minute. We're researching the company and building your preparation plan."}
          </p>

          <div className="mt-10 space-y-2">
            {generationSteps.map(
              (step, index) => {
                const completed =
                  index < stepIndex;

                const active =
                  index === stepIndex;

                return (
                  <div
                    key={step}
                    className={`flex items-center gap-4 rounded-xl border px-4 py-3 transition ${
                      active
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-white/5"
                    }`}
                  >
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                        completed
                          ? "bg-emerald-400 text-black"
                          : active
                          ? "border border-emerald-400 text-emerald-400"
                          : "border border-white/10 text-zinc-700"
                      }`}
                    >
                      {completed
                        ? "✓"
                        : index + 1}
                    </div>

                    <span
                      className={
                        active
                          ? "text-sm text-white"
                          : completed
                          ? "text-sm text-zinc-400"
                          : "text-sm text-zinc-700"
                      }
                    >
                      {step}
                    </span>
                  </div>
                );
              }
            )}
          </div>

          <p className="mt-8 text-xs text-zinc-700">
            Keep this page open while generation
            is running.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080808] text-white">

      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <button
            type="button"
            onClick={() =>
              router.push("/dashboard")
            }
            className="text-sm text-zinc-500 transition hover:text-white"
          >
            ← Dashboard
          </button>

          <div className="text-sm font-medium tracking-[0.18em] text-emerald-400">
            TRAO PREP
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-12">

        <section className="max-w-2xl">
          <div className="text-sm text-zinc-500">
            New preparation kit
          </div>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            What are you interviewing for?
          </h1>

          <p className="mt-4 leading-7 text-zinc-500">
            Add the job description and company.
            We&apos;ll extract what matters,
            research the company, and build your
            preparation plan.
          </p>
        </section>

        <div className="mt-10 inline-flex rounded-xl border border-white/10 bg-[#101010] p-1">
          <button
            type="button"
            onClick={() => {
              setMode("single");
              setError("");
            }}
            className={`rounded-lg px-4 py-2 text-sm transition ${
              mode === "single"
                ? "bg-white text-black"
                : "text-zinc-500 hover:text-white"
            }`}
          >
            Single role
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("batch");
              setError("");
            }}
            className={`rounded-lg px-4 py-2 text-sm transition ${
              mode === "batch"
                ? "bg-white text-black"
                : "text-zinc-500 hover:text-white"
            }`}
          >
            Multiple roles
          </button>
        </div>

        {mode === "single" && (
        <form
          onSubmit={handleSubmit}
          className="mt-12 max-w-3xl space-y-8"
        >

          {/* JD */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-medium">
                Job description
              </label>

              <span className="text-xs text-zinc-600">
                {jd.length.toLocaleString()} chars
              </span>
            </div>

            <textarea
              required
              value={jd}
              onChange={(e) =>
                setJd(e.target.value)
              }
              placeholder="Paste the complete job description here..."
              className="min-h-[300px] w-full resize-y rounded-2xl border border-white/10 bg-[#101010] p-5 text-sm leading-7 text-zinc-200 outline-none transition placeholder:text-zinc-700 focus:border-emerald-500/40"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-[1fr_180px]">

            {/* COMPANY */}
            <div>
              <label className="mb-3 block text-sm font-medium">
                Company website
              </label>

              <input
                required
                type="url"
                value={companyUrl}
                onChange={(e) =>
                  setCompanyUrl(
                    e.target.value
                  )
                }
                placeholder="https://company.com"
                className="w-full rounded-xl border border-white/10 bg-[#101010] px-4 py-3.5 text-sm outline-none transition placeholder:text-zinc-700 focus:border-emerald-500/40"
              />
            </div>

            {/* DAYS */}
            <div>
              <label className="mb-3 block text-sm font-medium">
                Days available
              </label>

              <input
                required
                type="number"
                min={1}
                max={60}
                value={days}
                onChange={(e) =>
                  setDays(
                    Number(e.target.value)
                  )
                }
                className="w-full rounded-xl border border-white/10 bg-[#101010] px-4 py-3.5 text-sm outline-none transition focus:border-emerald-500/40"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-white/10 pt-7">
            <p className="max-w-md text-xs leading-5 text-zinc-600">
              Company pages will be researched
              and combined with the requirements
              found in your job description.
            </p>

            <button
              type="submit"
              disabled={
                !jd.trim() ||
                !companyUrl.trim()
              }
              className="rounded-xl bg-white px-6 py-3.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Generate kit →
            </button>
          </div>
        </form>
        )}

        {mode === "batch" && (
          <section className="mt-12 max-w-3xl">
            <div>
              <h2 className="text-xl font-medium">
                Upload roles
              </h2>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Upload a JSON file containing up to{" "}
                {MAX_BATCH_CASES} job-description
                and company pairs.
              </p>
            </div>

            {/* FILE DROP AREA */}
            <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#101010] px-6 py-12 text-center transition hover:border-emerald-500/30">
              <div className="text-sm font-medium text-zinc-300">
                Choose JSON file
              </div>

              <p className="mt-2 text-xs text-zinc-600">
                Maximum 1 MB · up to{" "}
                {MAX_BATCH_CASES} roles
              </p>

              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) =>
                  handleBatchFile(
                    e.target.files?.[0]
                  )
                }
              />
            </label>

            {/* FORMAT */}
            <div className="mt-5 rounded-xl border border-white/5 bg-black/30 p-4">
              <div className="text-[10px] uppercase tracking-wider text-zinc-600">
                Expected format
              </div>

              <pre className="mt-3 overflow-x-auto text-xs leading-6 text-zinc-500">
{`[
  {
    "id": "frontend-role",
    "jd": "Paste job description...",
    "company_url": "https://company.com",
    "days": 5
  },
  {
    "id": "backend-role",
    "jd": "Another job description...",
    "company_url": "https://another.com",
    "days": 7
  }
]`}
              </pre>
            </div>

            {/* PREVIEW */}
            {batchCases.length > 0 && (
              <div className="mt-7">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">
                      {batchFileName}
                    </div>

                    <div className="mt-1 text-xs text-emerald-400">
                      ✓ {batchCases.length}{" "}
                      {batchCases.length === 1
                        ? "role"
                        : "roles"}{" "}
                      ready
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setBatchCases([]);
                      setBatchFileName("");
                    }}
                    className="text-xs text-zinc-600 hover:text-red-400"
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  {batchCases.map(
                    (item, index) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-white/[0.07] bg-[#101010] p-4"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="text-xs text-zinc-600">
                              ROLE {index + 1}
                            </div>

                            <div className="mt-1 truncate text-sm text-zinc-300">
                              {item.id}
                            </div>
                          </div>

                          <span className="shrink-0 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-zinc-500">
                            {item.days}{" "}
                            {item.days === 1
                              ? "day"
                              : "days"}
                          </span>
                        </div>

                        <div className="mt-3 truncate text-xs text-zinc-600">
                          {item.company_url}
                        </div>

                        <div className="mt-2 text-xs text-zinc-700">
                          {item.jd.length.toLocaleString()}{" "}
                          JD characters
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="mt-7 flex items-center justify-between border-t border-white/10 pt-7">
              <p className="max-w-md text-xs leading-5 text-zinc-600">
                Each role uses the same research,
                generation, coverage and scheduling
                pipeline as a single kit.
              </p>

              <button
                type="button"
                onClick={handleBatchSubmit}
                disabled={
                  batchCases.length === 0
                }
                className="rounded-xl bg-white px-6 py-3.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Generate{" "}
                {batchCases.length || ""}{" "}
                {batchCases.length === 1
                  ? "kit"
                  : "kits"}{" "}
                →
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

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

  kit: {
    id: string;
    status: string;
  };
}

export default function NewKitPage() {
  const router = useRouter();

  const [jd, setJd] = useState("");
  const [companyUrl, setCompanyUrl] =
    useState("");
  const [days, setDays] = useState(5);

  const [loading, setLoading] =
    useState(false);

  const [stepIndex, setStepIndex] =
    useState(0);

  const [error, setError] =
    useState("");

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

      router.push(
        `/kits/${response.kit.id}`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not generate interview kit"
      );

      setLoading(false);
    }
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
            Researching your interview.
          </h1>

          <p className="mt-4 text-zinc-500">
            This can take around a minute.
            We&apos;re researching the company
            and building your preparation plan.
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
      </div>
    </main>
  );
}

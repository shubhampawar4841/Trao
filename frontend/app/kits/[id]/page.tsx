"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";

type Tab =
  | "overview"
  | "questions"
  | "flashcards"
  | "schedule";

interface Requirement {
  id: string;
  text: string;
  kind: string;
  priority: "must" | "nice";
}

interface Question {
  id: string;
  requirement_ids: string[];
  category:
    | "technical"
    | "behavioural"
    | "system-design"
    | "company-fit";
  prompt: string;
  answer_outline: string;
  difficulty: number;
}

interface Flashcard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
}

interface ScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

interface KitDocument {
  _id: string;

  editorState: {
    editedQuestionIds: string[];
    manualQuestionIds: string[];
    pinnedQuestionIds: string[];
    editedFlashcardIds: string[];
    manualFlashcardIds: string[];
    pinnedFlashcardIds: string[];
  };

  kit: {
    source: {
      company: string;
      company_url: string;
      role: string;
      location: string;
      pages_used: string[];
    };

    company_brief: {
      summary: string;
      what_they_do: string;
      sources: string[];
    };

    role: {
      title: string;
      seniority: string;
      responsibilities: string[];
      requirements: Requirement[];
    };

    questions: Question[];
    flashcards: Flashcard[];

    schedule: {
      days_available: number;
      days: ScheduleDay[];
    };

    coverage: {
      uncovered_requirement_ids: string[];
      passes: number;
    };
  };
}

export default function KitPage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id as string;

  const [document, setDocument] =
    useState<KitDocument | null>(null);

  const [tab, setTab] =
    useState<Tab>("overview");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [editingQuestion, setEditingQuestion] =
    useState<string | null>(null);

  const [questionDraft, setQuestionDraft] =
    useState({
      prompt: "",
      answer_outline: "",
    });

  const [saving, setSaving] =
    useState(false);

  const [regenerating, setRegenerating] =
    useState<string | null>(null);

  const [editingBrief, setEditingBrief] =
    useState(false);

  const [briefDraft, setBriefDraft] =
    useState({
      summary: "",
      what_they_do: "",
    });

  const [briefSaving, setBriefSaving] =
    useState(false);

  const [briefRegenerating, setBriefRegenerating] =
    useState(false);

  async function loadKit() {
    try {
      const response = await api<{
        success: boolean;
        kit: KitDocument;
      }>(`/api/kits/${id}`);

      setDocument(response.kit);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load kit"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadKit();
  }, [id]);

  function startEditing(question: Question) {
    setEditingQuestion(question.id);

    setQuestionDraft({
      prompt: question.prompt,
      answer_outline:
        question.answer_outline,
    });
  }

  async function saveQuestion(
    questionId: string
  ) {
    setSaving(true);

    try {
      await api(
        `/api/kits/${id}/questions/${questionId}`,
        {
          method: "PATCH",

          body: JSON.stringify(
            questionDraft
          ),
        }
      );

      await loadKit();
      setEditingQuestion(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save question"
      );
    } finally {
      setSaving(false);
    }
  }

  async function regenerateCategory(
    category: Question["category"]
  ) {
    setRegenerating(category);
    setError("");

    try {
      await api(
        `/api/kits/${id}/regenerate/questions/${category}`,
        {
          method: "POST",
        }
      );

      await loadKit();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not regenerate questions"
      );
    } finally {
      setRegenerating(null);
    }
  }

  function startEditingBrief() {
    if (!document) return;

    setBriefDraft({
      summary: document.kit.company_brief.summary,
      what_they_do:
        document.kit.company_brief.what_they_do,
    });

    setEditingBrief(true);
  }

  async function saveBrief() {
    setBriefSaving(true);
    setError("");

    try {
      await api(
        `/api/kits/${id}/company-brief`,
        {
          method: "PATCH",
          body: JSON.stringify(briefDraft),
        }
      );

      await loadKit();
      setEditingBrief(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save company brief"
      );
    } finally {
      setBriefSaving(false);
    }
  }

  async function regenerateBrief() {
    setBriefRegenerating(true);
    setError("");

    try {
      await api(
        `/api/kits/${id}/regenerate/company-brief`,
        {
          method: "POST",
        }
      );

      await loadKit();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not regenerate company brief"
      );
    } finally {
      setBriefRegenerating(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080808] text-zinc-500">
        Loading interview kit...
      </main>
    );
  }

  if (!document) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080808] text-white">
        <div className="text-center">
          <h1 className="text-2xl">
            Kit not found
          </h1>

          <button
            type="button"
            onClick={() =>
              router.push("/dashboard")
            }
            className="mt-6 text-sm text-emerald-400"
          >
            ← Dashboard
          </button>
        </div>
      </main>
    );
  }

  const kit = document.kit;

  const categories: Question["category"][] =
    [
      "technical",
      "behavioural",
      "system-design",
      "company-fit",
    ];

  return (
    <main className="min-h-screen bg-[#080808] text-white">

      {/* TOP BAR */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#080808]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
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

          <button
            type="button"
            onClick={() =>
              router.push(
                `/kits/${id}/practice`
              )
            }
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
          >
            Practice →
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">

        {/* HERO */}
        <section className="border-b border-white/10 pb-9">
          <div className="text-sm text-emerald-400">
            {kit.source.company}
          </div>

          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            {kit.role.title}
          </h1>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-500">
              {kit.role.requirements.length} requirements
            </span>

            <span className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-500">
              {kit.questions.length} questions
            </span>

            <span className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-500">
              {kit.flashcards.length} flashcards
            </span>

            <span className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-500">
              {kit.schedule.days_available} day plan
            </span>

            {kit.coverage
              .uncovered_requirement_ids
              .length === 0 && (
              <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs text-emerald-400">
                ✓ Must-have coverage complete
              </span>
            )}
          </div>
        </section>

        {/* TABS */}
        <nav className="mt-8 flex gap-1 overflow-x-auto border-b border-white/10">
          {(
            [
              "overview",
              "questions",
              "flashcards",
              "schedule",
            ] as Tab[]
          ).map((item) => (
            <button
              type="button"
              key={item}
              onClick={() =>
                setTab(item)
              }
              className={`whitespace-nowrap border-b-2 px-5 py-3 text-sm capitalize transition ${
                tab === item
                  ? "border-emerald-400 text-white"
                  : "border-transparent text-zinc-500 hover:text-white"
              }`}
            >
              {item}
            </button>
          ))}
        </nav>

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">

            <section className="rounded-2xl border border-white/10 bg-[#101010] p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.15em] text-zinc-600">
                    Company brief
                  </div>

                  <h2 className="mt-4 text-xl font-medium">
                    About {kit.source.company}
                  </h2>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={startEditingBrief}
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-white"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={regenerateBrief}
                    disabled={briefRegenerating}
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
                  >
                    {briefRegenerating
                      ? "Regenerating..."
                      : "↻ Regenerate"}
                  </button>
                </div>
              </div>

              {editingBrief ? (
                <div className="mt-6 space-y-4">
                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-wider text-zinc-600">
                      Summary
                    </label>

                    <textarea
                      value={briefDraft.summary}
                      onChange={(e) =>
                        setBriefDraft({
                          ...briefDraft,
                          summary: e.target.value,
                        })
                      }
                      className="min-h-[130px] w-full rounded-xl border border-white/10 bg-black p-4 text-sm leading-6 text-zinc-300 outline-none focus:border-emerald-500/40"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-wider text-zinc-600">
                      What they do
                    </label>

                    <textarea
                      value={briefDraft.what_they_do}
                      onChange={(e) =>
                        setBriefDraft({
                          ...briefDraft,
                          what_they_do: e.target.value,
                        })
                      }
                      className="min-h-[160px] w-full rounded-xl border border-white/10 bg-black p-4 text-sm leading-6 text-zinc-300 outline-none focus:border-emerald-500/40"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveBrief}
                      disabled={briefSaving}
                      className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black disabled:opacity-50"
                    >
                      {briefSaving ? "Saving..." : "Save changes"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingBrief(false)}
                      className="rounded-lg border border-white/10 px-4 py-2 text-xs text-zinc-500 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-4 leading-7 text-zinc-400">
                    {kit.company_brief.summary}
                  </p>

                  <div className="mt-7 border-t border-white/10 pt-6">
                    <div className="text-sm font-medium">
                      What they do
                    </div>

                    <p className="mt-3 leading-7 text-zinc-500">
                      {kit.company_brief.what_they_do}
                    </p>
                  </div>
                </>
              )}

              <div className="mt-7">
                <div className="mb-3 text-xs uppercase tracking-wider text-zinc-600">
                  Sources
                </div>

                <div className="flex flex-wrap gap-2">
                  {kit.company_brief.sources.map(
                    (source) => (
                      <a
                        key={source}
                        href={source}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-500 hover:text-white"
                      >
                        Source ↗
                      </a>
                    )
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#101010] p-6">
              <div className="text-xs uppercase tracking-[0.15em] text-zinc-600">
                Role requirements
              </div>

              <div className="mt-5 space-y-3">
                {kit.role.requirements.map(
                  (requirement) => (
                    <div
                      key={requirement.id}
                      className="rounded-xl border border-white/5 bg-black/30 p-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs text-zinc-600">
                          {requirement.id}
                        </span>

                        <span
                          className={`rounded-md px-2 py-1 text-[10px] uppercase ${
                            requirement.priority ===
                            "must"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-white/5 text-zinc-500"
                          }`}
                        >
                          {
                            requirement.priority
                          }
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-zinc-300">
                        {requirement.text}
                      </p>

                      <div className="mt-3 text-xs text-zinc-600">
                        {requirement.kind}
                      </div>
                    </div>
                  )
                )}
              </div>
            </section>
          </div>
        )}

        {/* QUESTIONS */}
        {tab === "questions" && (
          <div className="mt-8 space-y-10">
            {categories.map(
              (category) => {
                const questions =
                  kit.questions.filter(
                    (q) =>
                      q.category ===
                      category
                  );

                if (
                  questions.length === 0
                ) {
                  return null;
                }

                return (
                  <section key={category}>
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-medium capitalize">
                          {category.replace(
                            "-",
                            " "
                          )}
                        </h2>

                        <p className="mt-1 text-xs text-zinc-600">
                          {
                            questions.length
                          }{" "}
                          questions
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={
                          regenerating ===
                          category
                        }
                        onClick={() =>
                          regenerateCategory(
                            category
                          )
                        }
                        className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
                      >
                        {regenerating ===
                        category
                          ? "Regenerating..."
                          : "↻ Regenerate"}
                      </button>
                    </div>

                    <div className="space-y-3">
                      {questions.map(
                        (question) => {
                          const edited =
                            document.editorState.editedQuestionIds.includes(
                              question.id
                            );

                          const manual =
                            document.editorState.manualQuestionIds.includes(
                              question.id
                            );

                          const isEditing =
                            editingQuestion ===
                            question.id;

                          return (
                            <article
                              key={
                                question.id
                              }
                              className="rounded-2xl border border-white/10 bg-[#101010] p-5"
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-zinc-600">
                                    {
                                      question.id
                                    }
                                  </span>

                                  {edited && (
                                    <span className="rounded-md bg-amber-500/10 px-2 py-1 text-[10px] text-amber-400">
                                      edited
                                    </span>
                                  )}

                                  {manual && (
                                    <span className="rounded-md bg-blue-500/10 px-2 py-1 text-[10px] text-blue-400">
                                      manual
                                    </span>
                                  )}
                                </div>

                                {!isEditing && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      startEditing(
                                        question
                                      )
                                    }
                                    className="text-xs text-zinc-500 hover:text-white"
                                  >
                                    Edit
                                  </button>
                                )}
                              </div>

                              {isEditing ? (
                                <div className="mt-4 space-y-4">
                                  <textarea
                                    value={
                                      questionDraft.prompt
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      setQuestionDraft(
                                        {
                                          ...questionDraft,
                                          prompt:
                                            e
                                              .target
                                              .value,
                                        }
                                      )
                                    }
                                    className="min-h-[100px] w-full rounded-xl border border-white/10 bg-black p-4 text-sm leading-6 outline-none focus:border-emerald-500/40"
                                  />

                                  <textarea
                                    value={
                                      questionDraft.answer_outline
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      setQuestionDraft(
                                        {
                                          ...questionDraft,
                                          answer_outline:
                                            e
                                              .target
                                              .value,
                                        }
                                      )
                                    }
                                    className="min-h-[130px] w-full rounded-xl border border-white/10 bg-black p-4 text-sm leading-6 text-zinc-400 outline-none focus:border-emerald-500/40"
                                  />

                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      disabled={
                                        saving
                                      }
                                      onClick={() =>
                                        saveQuestion(
                                          question.id
                                        )
                                      }
                                      className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black"
                                    >
                                      {saving
                                        ? "Saving..."
                                        : "Save"}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditingQuestion(
                                          null
                                        )
                                      }
                                      className="rounded-lg border border-white/10 px-4 py-2 text-xs text-zinc-500"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <h3 className="mt-4 text-base font-medium leading-7">
                                    {
                                      question.prompt
                                    }
                                  </h3>

                                  <div className="mt-4 rounded-xl bg-black/40 p-4">
                                    <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-600">
                                      Answer outline
                                    </div>

                                    <p className="whitespace-pre-line text-sm leading-6 text-zinc-500">
                                      {
                                        question.answer_outline
                                      }
                                    </p>
                                  </div>

                                  <div className="mt-4 flex items-center justify-between text-xs text-zinc-600">
                                    <span>
                                      Difficulty{" "}
                                      {
                                        question.difficulty
                                      }
                                      /3
                                    </span>

                                    <span>
                                      Covers{" "}
                                      {question.requirement_ids.join(
                                        ", "
                                      )}
                                    </span>
                                  </div>
                                </>
                              )}
                            </article>
                          );
                        }
                      )}
                    </div>
                  </section>
                );
              }
            )}
          </div>
        )}

        {/* FLASHCARDS */}
        {tab === "flashcards" && (
          <section className="mt-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-medium">
                  Flashcards
                </h2>

                <p className="mt-2 text-sm text-zinc-500">
                  Quick review before the
                  interview.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/kits/${id}/practice`
                  )
                }
                className="rounded-xl bg-white px-4 py-2.5 text-sm text-black"
              >
                Start practice →
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {kit.flashcards.map(
                (flashcard) => (
                  <article
                    key={flashcard.id}
                    className="rounded-2xl border border-white/10 bg-[#101010] p-5"
                  >
                    <div className="text-xs text-zinc-600">
                      {flashcard.id}
                    </div>

                    <h3 className="mt-4 font-medium leading-6">
                      {flashcard.front}
                    </h3>

                    <p className="mt-4 border-t border-white/5 pt-4 text-sm leading-6 text-zinc-500">
                      {flashcard.back}
                    </p>
                  </article>
                )
              )}
            </div>
          </section>
        )}

        {/* SCHEDULE */}
        {tab === "schedule" && (
          <section className="mt-8">
            <div>
              <h2 className="text-2xl font-medium">
                {
                  kit.schedule
                    .days_available
                }
                -day preparation plan
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Higher-priority and harder
                questions are scheduled earlier.
              </p>
            </div>

            <div className="mt-8 space-y-4">
              {kit.schedule.days.map(
                (day) => (
                  <div
                    key={day.day}
                    className="grid gap-5 rounded-2xl border border-white/10 bg-[#101010] p-5 md:grid-cols-[100px_1fr_100px]"
                  >
                    <div>
                      <div className="text-xs text-zinc-600">
                        DAY
                      </div>

                      <div className="mt-1 text-2xl font-semibold">
                        {day.day}
                      </div>
                    </div>

                    <div>
                      <div className="font-medium">
                        {day.focus}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {day.question_ids.map(
                          (
                            questionId
                          ) => (
                            <span
                              key={
                                questionId
                              }
                              className="rounded-md bg-white/5 px-2 py-1 text-xs text-zinc-500"
                            >
                              {
                                questionId
                              }
                            </span>
                          )
                        )}
                      </div>
                    </div>

                    <div className="md:text-right">
                      <div className="text-xl font-medium">
                        {day.minutes}
                      </div>

                      <div className="text-xs text-zinc-600">
                        minutes
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

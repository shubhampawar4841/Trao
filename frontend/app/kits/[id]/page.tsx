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

  const [editingFlashcard, setEditingFlashcard] =
    useState<string | null>(null);

  const [flashcardDraft, setFlashcardDraft] = useState({
    front: "",
    back: "",
  });

  const [addingFlashcard, setAddingFlashcard] =
    useState(false);

  const [newFlashcard, setNewFlashcard] = useState({
    front: "",
    back: "",
  });

  const [flashcardSaving, setFlashcardSaving] =
    useState(false);

  const [addingQuestion, setAddingQuestion] =
    useState(false);

  const [newQuestion, setNewQuestion] = useState({
    prompt: "",
    answer_outline: "",
    category: "technical" as Question["category"],
    difficulty: 2,
    requirement_ids: [] as string[],
  });

  const [questionSaving, setQuestionSaving] =
    useState(false);

  const [scheduleDays, setScheduleDays] = useState(5);

  const [scheduleRegenerating, setScheduleRegenerating] =
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

  useEffect(() => {
    if (document) {
      setScheduleDays(
        document.kit.schedule.days_available
      );
    }
  }, [document]);

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

  async function addQuestion() {
    if (
      !newQuestion.prompt.trim() ||
      !newQuestion.answer_outline.trim()
    ) {
      return;
    }

    setQuestionSaving(true);
    setError("");

    try {
      await api(
        `/api/kits/${id}/questions`,
        {
          method: "POST",

          body: JSON.stringify(newQuestion),
        }
      );

      setNewQuestion({
        prompt: "",
        answer_outline: "",
        category: "technical",
        difficulty: 2,
        requirement_ids: [],
      });

      setAddingQuestion(false);

      await loadKit();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not add question"
      );
    } finally {
      setQuestionSaving(false);
    }
  }

  async function deleteQuestion(
    questionId: string
  ) {
    const confirmed = window.confirm(
      "Delete this question?"
    );

    if (!confirmed) return;

    setError("");

    try {
      await api(
        `/api/kits/${id}/questions/${questionId}`,
        {
          method: "DELETE",
        }
      );

      await loadKit();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not delete question"
      );
    }
  }

  async function moveQuestion(
    questionId: string,
    category: Question["category"]
  ) {
    try {
      await api(
        `/api/kits/${id}/questions/${questionId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            category,
          }),
        }
      );

      await loadKit();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not move question"
      );
    }
  }

  async function moveQuestionOrder(
    questionId: string,
    direction: "up" | "down"
  ) {
    if (!document) return;

    const questions = [...document.kit.questions];

    const currentIndex = questions.findIndex(
      (q) => q.id === questionId
    );

    if (currentIndex === -1) return;

    const currentQuestion = questions[currentIndex];

    // Find questions in the same category.
    const sameCategoryIndexes = questions
      .map((q, index) => ({
        q,
        index,
      }))
      .filter(
        (item) =>
          item.q.category ===
          currentQuestion.category
      )
      .map((item) => item.index);

    const positionInCategory =
      sameCategoryIndexes.indexOf(
        currentIndex
      );

    const targetPosition =
      direction === "up"
        ? positionInCategory - 1
        : positionInCategory + 1;

    if (
      targetPosition < 0 ||
      targetPosition >=
        sameCategoryIndexes.length
    ) {
      return;
    }

    const targetIndex =
      sameCategoryIndexes[targetPosition];

    // Swap the two questions.
    [questions[currentIndex], questions[targetIndex]] = [
      questions[targetIndex],
      questions[currentIndex],
    ];

    try {
      await api(
        `/api/kits/${id}/question-order`,
        {
          method: "PATCH",

          body: JSON.stringify({
            question_ids: questions.map(
              (q) => q.id
            ),
          }),
        }
      );

      await loadKit();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not reorder questions"
      );
    }
  }

  async function regenerateSchedule() {
    setScheduleRegenerating(true);
    setError("");

    try {
      await api(
        `/api/kits/${id}/regenerate/schedule`,
        {
          method: "POST",
          body: JSON.stringify({
            days: scheduleDays,
          }),
        }
      );

      await loadKit();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not regenerate schedule"
      );
    } finally {
      setScheduleRegenerating(false);
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

  function startEditingFlashcard(
    flashcard: Flashcard
  ) {
    setEditingFlashcard(flashcard.id);

    setFlashcardDraft({
      front: flashcard.front,
      back: flashcard.back,
    });
  }

  async function saveFlashcard(
    flashcardId: string
  ) {
    setFlashcardSaving(true);
    setError("");

    try {
      await api(
        `/api/kits/${id}/flashcards/${flashcardId}`,
        {
          method: "PATCH",
          body: JSON.stringify(flashcardDraft),
        }
      );

      await loadKit();
      setEditingFlashcard(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save flashcard"
      );
    } finally {
      setFlashcardSaving(false);
    }
  }

  async function addFlashcard() {
    if (
      !newFlashcard.front.trim() ||
      !newFlashcard.back.trim()
    ) {
      return;
    }

    setFlashcardSaving(true);
    setError("");

    try {
      await api(
        `/api/kits/${id}/flashcards`,
        {
          method: "POST",
          body: JSON.stringify({
            front: newFlashcard.front,
            back: newFlashcard.back,
            requirement_ids: [],
          }),
        }
      );

      setNewFlashcard({
        front: "",
        back: "",
      });

      setAddingFlashcard(false);

      await loadKit();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not add flashcard"
      );
    } finally {
      setFlashcardSaving(false);
    }
  }

  async function deleteFlashcard(
    flashcardId: string
  ) {
    const confirmed = window.confirm(
      "Delete this flashcard?"
    );

    if (!confirmed) return;

    setError("");

    try {
      await api(
        `/api/kits/${id}/flashcards/${flashcardId}`,
        {
          method: "DELETE",
        }
      );

      await loadKit();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not delete flashcard"
      );
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

  const questionsById = new Map(
    kit.questions.map((question) => [
      question.id,
      question,
    ])
  );

  const requirementsById = new Map(
    kit.role.requirements.map((requirement) => [
      requirement.id,
      requirement,
    ])
  );

  const totalScheduleMinutes =
    kit.schedule.days.reduce(
      (total, day) =>
        total + day.minutes,
      0
    );

  return (
    <main className="min-h-screen bg-[#080808] text-white">

      {/* TOP BAR */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#080808]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-10">
          <button
            type="button"
            onClick={() =>
              router.push("/dashboard")
            }
            className="shrink-0 text-sm text-zinc-500 transition hover:text-white"
          >
            <span className="sm:hidden">←</span>
            <span className="hidden sm:inline">← Dashboard</span>
          </button>

          <div className="truncate text-sm font-medium tracking-[0.18em] text-emerald-400">
            TRAO PREP
          </div>

          <button
            type="button"
            onClick={() =>
              router.push(
                `/kits/${id}/practice`
              )
            }
            className="shrink-0 rounded-lg bg-white px-3 py-2 text-sm font-medium text-black sm:px-4"
          >
            <span className="sm:hidden">Practice</span>
            <span className="hidden sm:inline">Practice →</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10">

        {/* HERO */}
        <section className="border-b border-white/10 pb-9">
          <div className="text-sm text-emerald-400">
            {kit.source.company}
          </div>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
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
        <nav className="-mx-4 mt-8 flex gap-1 overflow-x-auto border-b border-white/10 px-4 sm:mx-0 sm:px-0">
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
              className={`shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-sm capitalize transition sm:px-5 ${
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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-medium">
                  Questions
                </h2>

                <p className="mt-2 text-sm text-zinc-500">
                  Edit, move, regenerate, or add
                  interview questions.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setAddingQuestion(true)}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5"
              >
                + Add question
              </button>
            </div>

            {addingQuestion && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="font-medium">
                    New question
                  </div>

                  <span className="rounded-md bg-blue-500/10 px-2 py-1 text-[10px] text-blue-400">
                    manual
                  </span>
                </div>

                <div className="space-y-4">
                  <textarea
                    value={newQuestion.prompt}
                    onChange={(e) =>
                      setNewQuestion({
                        ...newQuestion,
                        prompt: e.target.value,
                      })
                    }
                    placeholder="Interview question..."
                    className="min-h-[100px] w-full rounded-xl border border-white/10 bg-black p-4 text-sm outline-none"
                  />

                  <textarea
                    value={newQuestion.answer_outline}
                    onChange={(e) =>
                      setNewQuestion({
                        ...newQuestion,
                        answer_outline: e.target.value,
                      })
                    }
                    placeholder="Answer outline..."
                    className="min-h-[120px] w-full rounded-xl border border-white/10 bg-black p-4 text-sm outline-none"
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <select
                      value={newQuestion.category}
                      onChange={(e) =>
                        setNewQuestion({
                          ...newQuestion,
                          category:
                            e.target.value as Question["category"],
                        })
                      }
                      className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm"
                    >
                      <option value="technical">
                        Technical
                      </option>
                      <option value="behavioural">
                        Behavioural
                      </option>
                      <option value="system-design">
                        System design
                      </option>
                      <option value="company-fit">
                        Company fit
                      </option>
                    </select>

                    <select
                      value={newQuestion.difficulty}
                      onChange={(e) =>
                        setNewQuestion({
                          ...newQuestion,
                          difficulty: Number(
                            e.target.value
                          ),
                        })
                      }
                      className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm"
                    >
                      <option value={1}>
                        Difficulty 1
                      </option>
                      <option value={2}>
                        Difficulty 2
                      </option>
                      <option value={3}>
                        Difficulty 3
                      </option>
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={questionSaving}
                      onClick={addQuestion}
                      className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black disabled:opacity-50"
                    >
                      {questionSaving
                        ? "Adding..."
                        : "Add question"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setAddingQuestion(false)
                      }
                      className="rounded-lg border border-white/10 px-4 py-2 text-xs text-zinc-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                      {questions.map((question) => {
                        const edited =
                          document.editorState.editedQuestionIds.includes(
                            question.id
                          );

                        const manual =
                          document.editorState.manualQuestionIds.includes(
                            question.id
                          );

                        const pinned =
                          document.editorState.pinnedQuestionIds.includes(
                            question.id
                          );

                        const isEditing =
                          editingQuestion === question.id;

                        const requirementLabels =
                          question.requirement_ids
                            .map((requirementId) =>
                              requirementsById.get(
                                requirementId
                              )
                            )
                            .filter(
                              (
                                requirement
                              ): requirement is Requirement =>
                                Boolean(requirement)
                            );

                        const stateLabel = manual
                          ? "manual"
                          : edited
                            ? "edited"
                            : "generated";

                        const difficultyLabel =
                          question.difficulty === 3
                            ? "Hard"
                            : question.difficulty === 2
                              ? "Medium"
                              : "Easy";

                        return (
                          <article
                            key={question.id}
                            className="group rounded-2xl border border-white/10 bg-[#101010] transition hover:border-white/[0.16]"
                          >
                            {/* CARD HEADER */}
                            <div className="flex items-start justify-between gap-5 px-5 pt-5 sm:px-6 sm:pt-6">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                                  {question.id}
                                </span>

                                <span className="rounded-md bg-white/[0.05] px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-400">
                                  {question.category.replace(
                                    "-",
                                    " "
                                  )}
                                </span>

                                <span
                                  className={`rounded-md px-2 py-1 text-[10px] font-medium ${
                                    question.difficulty === 3
                                      ? "bg-red-500/10 text-red-400"
                                      : question.difficulty === 2
                                        ? "bg-amber-500/10 text-amber-400"
                                        : "bg-emerald-500/10 text-emerald-400"
                                  }`}
                                >
                                  {difficultyLabel}
                                </span>

                                <span
                                  className={`rounded-md px-2 py-1 text-[10px] uppercase tracking-wide ${
                                    manual
                                      ? "bg-blue-500/10 text-blue-400"
                                      : edited
                                        ? "bg-amber-500/10 text-amber-400"
                                        : "bg-white/[0.04] text-zinc-600"
                                  }`}
                                >
                                  {stateLabel}
                                </span>

                                {pinned && (
                                  <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-wide text-emerald-400">
                                    pinned
                                  </span>
                                )}
                              </div>

                              {!isEditing && (
                                <details className="relative shrink-0">
                                  <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg border border-white/10 text-lg leading-none text-zinc-500 transition hover:bg-white/5 hover:text-white">
                                    ···
                                  </summary>

                                  <div className="absolute right-0 top-10 z-20 w-48 overflow-hidden rounded-xl border border-white/10 bg-[#151515] p-1 shadow-2xl">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        startEditing(question)
                                      }
                                      className="w-full rounded-lg px-3 py-2 text-left text-xs text-zinc-300 transition hover:bg-white/5"
                                    >
                                      Edit question
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        moveQuestionOrder(
                                          question.id,
                                          "up"
                                        )
                                      }
                                      className="w-full rounded-lg px-3 py-2 text-left text-xs text-zinc-400 transition hover:bg-white/5 hover:text-white"
                                    >
                                      ↑ Move up
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        moveQuestionOrder(
                                          question.id,
                                          "down"
                                        )
                                      }
                                      className="w-full rounded-lg px-3 py-2 text-left text-xs text-zinc-400 transition hover:bg-white/5 hover:text-white"
                                    >
                                      ↓ Move down
                                    </button>

                                    <div className="my-1 border-t border-white/[0.07]" />

                                    <div className="px-3 pb-1 pt-2 text-[9px] uppercase tracking-wider text-zinc-700">
                                      Move to category
                                    </div>

                                    <select
                                      value={question.category}
                                      onChange={(e) =>
                                        moveQuestion(
                                          question.id,
                                          e.target
                                            .value as Question["category"]
                                        )
                                      }
                                      className="mx-2 mb-2 w-[calc(100%-16px)] rounded-lg border border-white/10 bg-black px-2 py-2 text-xs text-zinc-400 outline-none"
                                    >
                                      <option value="technical">
                                        Technical
                                      </option>

                                      <option value="behavioural">
                                        Behavioural
                                      </option>

                                      <option value="system-design">
                                        System design
                                      </option>

                                      <option value="company-fit">
                                        Company fit
                                      </option>
                                    </select>

                                    <div className="my-1 border-t border-white/[0.07]" />

                                    <button
                                      type="button"
                                      onClick={() =>
                                        deleteQuestion(
                                          question.id
                                        )
                                      }
                                      className="w-full rounded-lg px-3 py-2 text-left text-xs text-red-400/70 transition hover:bg-red-500/[0.06] hover:text-red-400"
                                    >
                                      Delete question
                                    </button>
                                  </div>
                                </details>
                              )}
                            </div>

                            {isEditing ? (
                              /* EDIT MODE */
                              <div className="space-y-4 px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
                                <div>
                                  <label className="mb-2 block text-[10px] uppercase tracking-wider text-zinc-600">
                                    Question
                                  </label>

                                  <textarea
                                    value={
                                      questionDraft.prompt
                                    }
                                    onChange={(e) =>
                                      setQuestionDraft({
                                        ...questionDraft,
                                        prompt:
                                          e.target.value,
                                      })
                                    }
                                    className="min-h-[110px] w-full rounded-xl border border-white/10 bg-black p-4 text-sm leading-6 text-white outline-none transition focus:border-emerald-500/40"
                                  />
                                </div>

                                <div>
                                  <label className="mb-2 block text-[10px] uppercase tracking-wider text-zinc-600">
                                    Answer outline
                                  </label>

                                  <textarea
                                    value={
                                      questionDraft.answer_outline
                                    }
                                    onChange={(e) =>
                                      setQuestionDraft({
                                        ...questionDraft,
                                        answer_outline:
                                          e.target.value,
                                      })
                                    }
                                    className="min-h-[140px] w-full rounded-xl border border-white/10 bg-black p-4 text-sm leading-6 text-zinc-400 outline-none transition focus:border-emerald-500/40"
                                  />
                                </div>

                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() =>
                                      saveQuestion(
                                        question.id
                                      )
                                    }
                                    className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black transition hover:bg-zinc-200 disabled:opacity-50"
                                  >
                                    {saving
                                      ? "Saving..."
                                      : "Save changes"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingQuestion(
                                        null
                                      )
                                    }
                                    className="rounded-lg border border-white/10 px-4 py-2 text-xs text-zinc-500 transition hover:text-white"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {/* QUESTION */}
                                <div className="px-5 pt-5 sm:px-6">
                                  <h3 className="max-w-4xl text-[15px] font-medium leading-7 text-zinc-100 sm:text-base">
                                    {question.prompt}
                                  </h3>
                                </div>

                                {/* ANSWER */}
                                <div className="mx-5 mt-5 rounded-xl border border-white/[0.05] bg-black/30 p-4 sm:mx-6">
                                  <div className="mb-2 text-[9px] uppercase tracking-[0.14em] text-zinc-600">
                                    Answer outline
                                  </div>

                                  <p className="whitespace-pre-line text-sm leading-6 text-zinc-500">
                                    {
                                      question.answer_outline
                                    }
                                  </p>
                                </div>

                                {/* FOOTER */}
                                <div className="mt-5 flex flex-col gap-3 border-t border-white/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                                  <div className="flex flex-wrap items-center gap-2">
                                    {requirementLabels.length >
                                    0 ? (
                                      <>
                                        <span className="mr-1 text-[9px] uppercase tracking-wider text-zinc-700">
                                          Covers
                                        </span>

                                        {requirementLabels.map(
                                          (requirement) => (
                                            <span
                                              key={
                                                requirement.id
                                              }
                                              className={`rounded-lg border px-2.5 py-1 text-[10px] ${
                                                requirement.priority ===
                                                "must"
                                                  ? "border-emerald-500/15 bg-emerald-500/[0.05] text-emerald-400"
                                                  : "border-white/[0.07] bg-white/[0.02] text-zinc-500"
                                              }`}
                                            >
                                              {requirement.text}

                                              <span className="ml-1.5 text-zinc-700">
                                                {
                                                  requirement.id
                                                }
                                              </span>
                                            </span>
                                          )
                                        )}
                                      </>
                                    ) : (
                                      <span className="text-[10px] text-zinc-700">
                                        General interview question
                                      </span>
                                    )}
                                  </div>

                                  <span className="text-[10px] text-zinc-700">
                                    Difficulty{" "}
                                    {question.difficulty}/3
                                  </span>
                                </div>
                              </>
                            )}
                          </article>
                        );
                      })}
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
            <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-medium">
                  Flashcards
                </h2>

                <p className="mt-2 text-sm text-zinc-500">
                  Review, edit, or add cards for focused
                  interview practice.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setAddingFlashcard(true)
                  }
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/5"
                >
                  + Add flashcard
                </button>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/kits/${id}/practice`
                    )
                  }
                  className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black"
                >
                  Start practice →
                </button>
              </div>
            </div>

            {/* ADD FLASHCARD */}
            {addingFlashcard && (
              <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-sm font-medium">
                    New flashcard
                  </div>

                  <span className="rounded-md bg-blue-500/10 px-2 py-1 text-[10px] text-blue-400">
                    manual
                  </span>
                </div>

                <div className="space-y-4">
                  <textarea
                    value={newFlashcard.front}
                    onChange={(e) =>
                      setNewFlashcard({
                        ...newFlashcard,
                        front: e.target.value,
                      })
                    }
                    placeholder="Question / front..."
                    className="min-h-[100px] w-full rounded-xl border border-white/10 bg-black p-4 text-sm outline-none placeholder:text-zinc-700 focus:border-emerald-500/40"
                  />

                  <textarea
                    value={newFlashcard.back}
                    onChange={(e) =>
                      setNewFlashcard({
                        ...newFlashcard,
                        back: e.target.value,
                      })
                    }
                    placeholder="Answer / back..."
                    className="min-h-[120px] w-full rounded-xl border border-white/10 bg-black p-4 text-sm text-zinc-300 outline-none placeholder:text-zinc-700 focus:border-emerald-500/40"
                  />

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={
                        flashcardSaving ||
                        !newFlashcard.front.trim() ||
                        !newFlashcard.back.trim()
                      }
                      onClick={addFlashcard}
                      className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black disabled:opacity-40"
                    >
                      {flashcardSaving
                        ? "Adding..."
                        : "Add flashcard"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAddingFlashcard(false);

                        setNewFlashcard({
                          front: "",
                          back: "",
                        });
                      }}
                      className="rounded-lg border border-white/10 px-4 py-2 text-xs text-zinc-500 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* FLASHCARD GRID */}
            <div className="grid gap-4 md:grid-cols-2">
              {kit.flashcards.map(
                (flashcard) => {
                  const isEditing =
                    editingFlashcard ===
                    flashcard.id;

                  const edited =
                    document.editorState.editedFlashcardIds.includes(
                      flashcard.id
                    );

                  const manual =
                    document.editorState.manualFlashcardIds.includes(
                      flashcard.id
                    );

                  return (
                    <article
                      key={flashcard.id}
                      className="rounded-2xl border border-white/10 bg-[#101010] p-5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-600">
                            {flashcard.id}
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
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                startEditingFlashcard(
                                  flashcard
                                )
                              }
                              className="text-xs text-zinc-500 hover:text-white"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                deleteFlashcard(
                                  flashcard.id
                                )
                              }
                              className="text-xs text-zinc-600 hover:text-red-400"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="mt-4 space-y-4">
                          <textarea
                            value={
                              flashcardDraft.front
                            }
                            onChange={(e) =>
                              setFlashcardDraft({
                                ...flashcardDraft,
                                front: e.target.value,
                              })
                            }
                            className="min-h-[100px] w-full rounded-xl border border-white/10 bg-black p-4 text-sm outline-none focus:border-emerald-500/40"
                          />

                          <textarea
                            value={
                              flashcardDraft.back
                            }
                            onChange={(e) =>
                              setFlashcardDraft({
                                ...flashcardDraft,
                                back: e.target.value,
                              })
                            }
                            className="min-h-[120px] w-full rounded-xl border border-white/10 bg-black p-4 text-sm text-zinc-400 outline-none focus:border-emerald-500/40"
                          />

                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={
                                flashcardSaving
                              }
                              onClick={() =>
                                saveFlashcard(
                                  flashcard.id
                                )
                              }
                              className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black disabled:opacity-50"
                            >
                              {flashcardSaving
                                ? "Saving..."
                                : "Save"}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setEditingFlashcard(
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
                          <h3 className="mt-4 font-medium leading-6">
                            {flashcard.front}
                          </h3>

                          <p className="mt-4 border-t border-white/5 pt-4 text-sm leading-6 text-zinc-500">
                            {flashcard.back}
                          </p>

                          {flashcard
                            .requirement_ids
                            .length > 0 && (
                            <div className="mt-4 flex gap-2">
                              {flashcard.requirement_ids.map(
                                (
                                  requirementId
                                ) => (
                                  <span
                                    key={
                                      requirementId
                                    }
                                    className="rounded-md bg-white/5 px-2 py-1 text-[10px] text-zinc-600"
                                  >
                                    {
                                      requirementId
                                    }
                                  </span>
                                )
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </article>
                  );
                }
              )}
            </div>
          </section>
        )}

        {/* SCHEDULE */}
        {tab === "schedule" && (
          <section className="mt-8">
            {/* HEADER */}
            <div className="flex flex-col gap-6 border-b border-white/10 pb-7 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-2 text-xs uppercase tracking-[0.16em] text-emerald-400">
                  Preparation roadmap
                </div>

                <h2 className="text-2xl font-medium sm:text-3xl">
                  {kit.schedule.days_available}-day interview plan
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                  Your highest-priority and hardest interview questions
                  are front-loaded so you can prepare the important areas first.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs text-zinc-400">
                    {kit.questions.length} questions
                  </span>

                  <span className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs text-zinc-400">
                    {totalScheduleMinutes} total minutes
                  </span>

                  <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs text-emerald-400">
                    ✓ Must-haves covered
                  </span>
                </div>
              </div>

              {/* REGENERATE */}
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
                <div className="w-full sm:w-auto">
                  <label className="mb-2 block text-[11px] uppercase tracking-wider text-zinc-600">
                    Days available
                  </label>

                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={scheduleDays}
                    onChange={(e) =>
                      setScheduleDays(
                        Math.min(
                          60,
                          Math.max(
                            1,
                            Number(e.target.value)
                          )
                        )
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#0d0d0d] px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500/40 sm:w-24"
                  />
                </div>

                <button
                  type="button"
                  onClick={regenerateSchedule}
                  disabled={scheduleRegenerating}
                  className="w-full rounded-xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {scheduleRegenerating
                    ? "Regenerating..."
                    : "↻ Regenerate plan"}
                </button>
              </div>
            </div>

            {/* TIMELINE */}
            <div className="relative mt-8">
              {/* desktop timeline line */}
              <div className="absolute bottom-0 left-[23px] top-0 hidden w-px bg-white/10 md:block" />

              <div className="space-y-5">
                {kit.schedule.days.map(
                  (day, dayIndex) => {
                    const scheduledQuestions =
                      day.question_ids
                        .map((questionId) =>
                          questionsById.get(
                            questionId
                          )
                        )
                        .filter(
                          (
                            question
                          ): question is Question =>
                            Boolean(question)
                        );

                    return (
                      <article
                        key={day.day}
                        className="relative md:pl-16"
                      >
                        {/* TIMELINE DOT */}
                        <div className="absolute left-0 top-7 hidden h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#080808] text-sm font-semibold text-zinc-300 md:flex">
                          {day.day}
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#101010]">
                          {/* DAY HEADER */}
                          <div className="flex flex-col gap-4 border-b border-white/[0.07] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                            <div className="flex items-start gap-4">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] text-sm font-semibold text-emerald-400 md:hidden">
                                {day.day}
                              </div>

                              <div>
                                <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">
                                  Day {day.day}
                                </div>

                                <h3 className="mt-1 text-lg font-medium text-zinc-100">
                                  {day.focus}
                                </h3>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className="text-xl font-medium">
                                  {day.minutes}
                                </div>

                                <div className="text-[10px] uppercase tracking-wider text-zinc-600">
                                  minutes
                                </div>
                              </div>

                              <div className="h-8 w-px bg-white/10" />

                              <div className="text-right">
                                <div className="text-xl font-medium">
                                  {
                                    scheduledQuestions.length
                                  }
                                </div>

                                <div className="text-[10px] uppercase tracking-wider text-zinc-600">
                                  questions
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* QUESTIONS */}
                          <div className="space-y-2 p-4 sm:p-5">
                            {scheduledQuestions.length >
                            0 ? (
                              scheduledQuestions.map(
                                (
                                  question,
                                  questionIndex
                                ) => (
                                  <div
                                    key={question.id}
                                    className="group rounded-xl border border-white/[0.06] bg-black/30 p-4 transition hover:border-white/10 hover:bg-black/50"
                                  >
                                    <div className="flex gap-4">
                                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-[11px] text-zinc-600">
                                        {questionIndex +
                                          1}
                                      </div>

                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="rounded-md bg-white/[0.05] px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                                            {question.category.replace(
                                              "-",
                                              " "
                                            )}
                                          </span>

                                          <span
                                            className={`rounded-md px-2 py-1 text-[10px] ${
                                              question.difficulty ===
                                              3
                                                ? "bg-red-500/10 text-red-400"
                                                : question.difficulty ===
                                                  2
                                                ? "bg-amber-500/10 text-amber-400"
                                                : "bg-emerald-500/10 text-emerald-400"
                                            }`}
                                          >
                                            Difficulty{" "}
                                            {
                                              question.difficulty
                                            }
                                            /3
                                          </span>

                                          <span className="text-[10px] text-zinc-700">
                                            {
                                              question.id
                                            }
                                          </span>
                                        </div>

                                        <p className="mt-3 text-sm leading-6 text-zinc-300">
                                          {
                                            question.prompt
                                          }
                                        </p>

                                        {question
                                          .requirement_ids
                                          .length > 0 && (
                                          <div className="mt-3 flex flex-wrap items-center gap-2">
                                            <span className="text-[10px] uppercase tracking-wider text-zinc-700">
                                              Covers
                                            </span>

                                            {question.requirement_ids.map(
                                              (
                                                requirementId
                                              ) => (
                                                <span
                                                  key={
                                                    requirementId
                                                  }
                                                  className="rounded-md border border-white/[0.06] px-2 py-1 text-[10px] text-zinc-600"
                                                >
                                                  {
                                                    requirementId
                                                  }
                                                </span>
                                              )
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              )
                            ) : (
                              <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-zinc-600">
                                Review and reinforcement
                              </div>
                            )}
                          </div>

                          {/* PROGRESS */}
                          <div className="border-t border-white/[0.05] px-5 py-3">
                            <div className="flex items-center justify-between text-[10px] text-zinc-700">
                              <span>
                                Day {day.day} of{" "}
                                {
                                  kit.schedule
                                    .days_available
                                }
                              </span>

                              <span>
                                {Math.round(
                                  ((dayIndex + 1) /
                                    kit.schedule
                                      .days_available) *
                                    100
                                )}
                                % through plan
                              </span>
                            </div>

                            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                              <div
                                className="h-full rounded-full bg-emerald-400"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    ((dayIndex + 1) /
                                      kit.schedule
                                        .days_available) *
                                      100
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

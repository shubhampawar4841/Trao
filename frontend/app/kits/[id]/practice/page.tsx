"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface PracticeFlashcard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];

  practice: {
    confidence: number;
    covered: boolean;
    timesReviewed: number;
    lastPracticedAt: string | null;
  };
}

interface PracticeResponse {
  success: boolean;

  stats: {
    total: number;
    reviewed: number;
    covered: number;
  };

  flashcards: PracticeFlashcard[];
}

export default function PracticePage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id as string;

  const [cards, setCards] = useState<
    PracticeFlashcard[]
  >([]);

  const [stats, setStats] = useState({
    total: 0,
    reviewed: 0,
    covered: 0,
  });

  const [index, setIndex] = useState(0);

  const [revealed, setRevealed] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  async function loadPractice() {
    try {
      const response =
        await api<PracticeResponse>(
          `/api/kits/${id}/practice`
        );

      setCards(response.flashcards);
      setStats(response.stats);
      setIndex(0);
      setRevealed(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load practice session"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPractice();
  }, [id]);

  async function rateCard(
    confidence: number
  ) {
    const card = cards[index];

    if (!card) return;

    setSaving(true);
    setError("");

    try {
      await api(
        `/api/kits/${id}/practice/${card.id}`,
        {
          method: "PATCH",

          body: JSON.stringify({
            confidence,
            covered: confidence >= 2,
          }),
        }
      );

      const nextCards = [...cards];

      nextCards[index] = {
        ...card,

        practice: {
          ...card.practice,

          confidence,

          covered: confidence >= 2,

          timesReviewed:
            card.practice.timesReviewed + 1,

          lastPracticedAt:
            new Date().toISOString(),
        },
      };

      setCards(nextCards);

      setStats((current) => ({
        ...current,

        reviewed:
          card.practice.timesReviewed === 0
            ? current.reviewed + 1
            : current.reviewed,

        covered:
          confidence >= 2 &&
          !card.practice.covered
            ? current.covered + 1
            : confidence < 2 &&
              card.practice.covered
            ? Math.max(
                0,
                current.covered - 1
              )
            : current.covered,
      }));

      if (index < cards.length - 1) {
        setIndex(index + 1);
        setRevealed(false);
      } else {
        await loadPractice();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save progress"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080808] text-zinc-500">
        Preparing practice session...
      </main>
    );
  }

  if (cards.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080808] px-6 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-medium">
            No flashcards yet
          </h1>

          <button
            type="button"
            onClick={() =>
              router.push(`/kits/${id}`)
            }
            className="mt-6 text-sm text-emerald-400"
          >
            ← Back to kit
          </button>
        </div>
      </main>
    );
  }

  const card = cards[index];

  const progress =
    ((index + 1) / cards.length) * 100;

  return (
    <main className="min-h-screen bg-[#080808] text-white">

      {/* TOP */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <button
            type="button"
            onClick={() =>
              router.push(`/kits/${id}`)
            }
            className="text-sm text-zinc-500 hover:text-white"
          >
            ← Back to kit
          </button>

          <div className="text-sm font-medium tracking-[0.18em] text-emerald-400">
            PRACTICE
          </div>

          <div className="text-sm text-zinc-500">
            {index + 1} / {cards.length}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-12">

        {/* STATS */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/10 bg-[#101010] p-4">
            <div className="text-xs text-zinc-600">
              Cards
            </div>

            <div className="mt-2 text-xl font-medium">
              {stats.total}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#101010] p-4">
            <div className="text-xs text-zinc-600">
              Reviewed
            </div>

            <div className="mt-2 text-xl font-medium">
              {stats.reviewed}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#101010] p-4">
            <div className="text-xs text-zinc-600">
              Covered
            </div>

            <div className="mt-2 text-xl font-medium text-emerald-400">
              {stats.covered}
            </div>
          </div>
        </div>

        {/* PROGRESS */}
        <div className="mt-8 h-1 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full bg-emerald-400 transition-all duration-300"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* CARD */}
        <section className="mt-10 min-h-[380px] rounded-3xl border border-white/10 bg-[#101010] p-8 sm:p-10">

          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-600">
              {card.id}
            </span>

            <div className="flex gap-2">
              {card.requirement_ids.map(
                (requirementId) => (
                  <span
                    key={requirementId}
                    className="rounded-md bg-white/5 px-2 py-1 text-[10px] text-zinc-500"
                  >
                    {requirementId}
                  </span>
                )
              )}
            </div>
          </div>

          <div className="mt-12">
            <div className="text-xs uppercase tracking-[0.16em] text-zinc-600">
              Question
            </div>

            <h1 className="mt-4 text-2xl font-medium leading-9 sm:text-3xl">
              {card.front}
            </h1>
          </div>

          {!revealed ? (
            <button
              type="button"
              onClick={() =>
                setRevealed(true)
              }
              className="mt-14 w-full rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-zinc-300 transition hover:bg-white/[0.06]"
            >
              Reveal answer
            </button>
          ) : (
            <div className="mt-10 border-t border-white/10 pt-8">
              <div className="text-xs uppercase tracking-[0.16em] text-emerald-400">
                Answer
              </div>

              <p className="mt-4 text-base leading-7 text-zinc-300">
                {card.back}
              </p>
            </div>
          )}
        </section>

        {/* CONFIDENCE */}
        {revealed && (
          <section className="mt-7">
            <div className="mb-3 text-center text-xs text-zinc-600">
              How confident are you?
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  rateCard(1)
                }
                className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-4 text-sm text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
              >
                1 · Needs work
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  rateCard(2)
                }
                className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-4 text-sm text-amber-400 transition hover:bg-amber-500/10 disabled:opacity-50"
              >
                2 · Almost
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  rateCard(3)
                }
                className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-4 text-sm text-emerald-400 transition hover:bg-emerald-500/10 disabled:opacity-50"
              >
                3 · Confident
              </button>
            </div>
          </section>
        )}

        <p className="mt-8 text-center text-xs text-zinc-700">
          Low-confidence cards are prioritized
          in your next practice session.
        </p>
      </div>
    </main>
  );
}

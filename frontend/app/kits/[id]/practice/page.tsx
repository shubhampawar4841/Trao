"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { fetchCurrentUser } from "@/lib/auth";

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

interface SessionRatings {
  needsWork: number;
  gettingThere: number;
  confident: number;
}

function confidenceLabel(confidence: number) {
  if (confidence === 1) return "Needs work";
  if (confidence === 2) return "Getting there";
  if (confidence === 3) return "Confident";
  return null;
}

export default function PracticePage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id as string;

  // Frozen for the whole session after loadPractice().
  // Only reloaded when the user clicks "Practice again".
  const [cards, setCards] = useState<
    PracticeFlashcard[]
  >([]);

  const [index, setIndex] = useState(0);

  const [revealed, setRevealed] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [sessionComplete, setSessionComplete] =
    useState(false);

  const [sessionRatings, setSessionRatings] =
    useState<SessionRatings>({
      needsWork: 0,
      gettingThere: 0,
      confident: 0,
    });

  async function loadPractice() {
    setLoading(true);
    setError("");
    setSessionComplete(false);
    setSessionRatings({
      needsWork: 0,
      gettingThere: 0,
      confident: 0,
    });

    try {
      const user = await fetchCurrentUser();

      if (!user) {
        router.replace("/");
        return;
      }

      const response =
        await api<PracticeResponse>(
          `/api/kits/${id}/practice`
        );

      // Freeze this ordered queue for the session.
      setCards(response.flashcards);
      setIndex(0);
      setRevealed(false);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not load practice session";

      if (
        message
          .toLowerCase()
          .includes("authentication") ||
        message
          .toLowerCase()
          .includes("session")
      ) {
        router.replace("/");
        return;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPractice();
  }, [id]);

  const rateCard = useCallback(
    async (confidence: number) => {
      const card = cards[index];

      if (!card || saving || sessionComplete) {
        return;
      }

      setSaving(true);
      setError("");

      try {
        await api(
          `/api/kits/${id}/practice/${card.id}`,
          {
            method: "PATCH",

            body: JSON.stringify({
              confidence,
              covered: true,
            }),
          }
        );

        const nextCards = [...cards];

        nextCards[index] = {
          ...card,

          practice: {
            ...card.practice,
            confidence,
            covered: true,
            timesReviewed:
              card.practice.timesReviewed + 1,
            lastPracticedAt:
              new Date().toISOString(),
          },
        };

        // Local update only — do not re-fetch / re-sort mid-session.
        setCards(nextCards);

        setSessionRatings((current) => ({
          needsWork:
            current.needsWork +
            (confidence === 1 ? 1 : 0),
          gettingThere:
            current.gettingThere +
            (confidence === 2 ? 1 : 0),
          confident:
            current.confident +
            (confidence === 3 ? 1 : 0),
        }));

        if (index < cards.length - 1) {
          setIndex(index + 1);
          setRevealed(false);
        } else {
          setSessionComplete(true);
          setRevealed(false);
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
    },
    [cards, id, index, saving, sessionComplete]
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (loading || sessionComplete || saving) {
        return;
      }

      if (
        event.key === " " ||
        event.key === "Enter"
      ) {
        if (!revealed) {
          event.preventDefault();
          setRevealed(true);
        }
        return;
      }

      if (!revealed) {
        return;
      }

      if (event.key === "1") {
        event.preventDefault();
        void rateCard(1);
      } else if (event.key === "2") {
        event.preventDefault();
        void rateCard(2);
      } else if (event.key === "3") {
        event.preventDefault();
        void rateCard(3);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () =>
      window.removeEventListener(
        "keydown",
        onKeyDown
      );
  }, [
    loading,
    rateCard,
    revealed,
    saving,
    sessionComplete,
  ]);

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

  // Covered/uncovered and confidence stay separate.
  const coveredCount = cards.filter(
    (item) => item.practice.covered
  ).length;

  const needsWorkCount = cards.filter(
    (item) => item.practice.confidence === 1
  ).length;

  const confidentCount = cards.filter(
    (item) => item.practice.confidence === 3
  ).length;

  const sessionReviewed =
    sessionRatings.needsWork +
    sessionRatings.gettingThere +
    sessionRatings.confident;

  if (sessionComplete) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080808] px-6 text-white">
        <div className="w-full max-w-md text-center">
          <div className="text-sm tracking-[0.18em] text-emerald-400">
            PRACTICE COMPLETE
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Practice complete
          </h1>

          <p className="mt-3 text-sm text-zinc-500">
            Low-confidence cards come back first
            next session.
          </p>

          <div className="mt-10 space-y-3 text-left">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#101010] px-4 py-3 text-sm">
              <span className="text-zinc-500">
                Reviewed
              </span>
              <span className="font-medium">
                {sessionReviewed}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#101010] px-4 py-3 text-sm">
              <span className="text-red-400/90">
                Needs work
              </span>
              <span className="font-medium">
                {sessionRatings.needsWork}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#101010] px-4 py-3 text-sm">
              <span className="text-amber-400/90">
                Getting there
              </span>
              <span className="font-medium">
                {sessionRatings.gettingThere}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#101010] px-4 py-3 text-sm">
              <span className="text-emerald-400">
                Confident
              </span>
              <span className="font-medium">
                {sessionRatings.confident}
              </span>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => void loadPractice()}
              className="w-full rounded-xl bg-white px-5 py-3.5 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              Practice again
            </button>

            <button
              type="button"
              onClick={() =>
                router.push(`/kits/${id}`)
              }
              className="w-full rounded-xl border border-white/10 px-5 py-3.5 text-sm text-zinc-300 transition hover:bg-white/5"
            >
              Back to kit
            </button>
          </div>
        </div>
      </main>
    );
  }

  const card = cards[index];

  const progress =
    ((index + 1) / cards.length) * 100;

  const priorLabel = confidenceLabel(
    card.practice.confidence
  );

  const statusPill = !card.practice.covered
    ? "Not practiced"
    : priorLabel
      ? `Covered · ${priorLabel}`
      : "Covered";

  return (
    <main className="min-h-screen bg-[#080808] pb-36 text-white sm:pb-28">

      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
          <button
            type="button"
            onClick={() =>
              router.push(`/kits/${id}`)
            }
            className="shrink-0 text-sm text-zinc-500 hover:text-white"
          >
            <span className="sm:hidden">←</span>
            <span className="hidden sm:inline">
              ← Back to kit
            </span>
          </button>

          <div className="truncate text-sm font-medium tracking-[0.18em] text-emerald-400">
            PRACTICE
          </div>

          <div className="shrink-0 text-sm text-zinc-500">
            {index + 1} / {cards.length}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl border border-white/10 bg-[#101010] p-3 sm:p-4">
            <div className="text-[10px] text-zinc-600 sm:text-xs">
              Covered
            </div>

            <div className="mt-2 text-lg font-medium sm:text-xl">
              {coveredCount} / {cards.length}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#101010] p-3 sm:p-4">
            <div className="text-[10px] text-zinc-600 sm:text-xs">
              Needs work
            </div>

            <div className="mt-2 text-lg font-medium text-red-400 sm:text-xl">
              {needsWorkCount}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#101010] p-3 sm:p-4">
            <div className="text-[10px] text-zinc-600 sm:text-xs">
              Confident
            </div>

            <div className="mt-2 text-lg font-medium text-emerald-400 sm:text-xl">
              {confidentCount}
            </div>
          </div>
        </div>

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

        <section className="mt-10 min-h-[280px] rounded-3xl border border-white/10 bg-[#101010] p-5 sm:min-h-[340px] sm:p-8 lg:p-10">
          <div className="flex justify-start">
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] tracking-wide ${
                card.practice.covered
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-white/5 text-zinc-500"
              }`}
            >
              {statusPill}
            </span>
          </div>

          <div className="mt-10">
            <div className="text-xs uppercase tracking-[0.16em] text-zinc-600">
              Question
            </div>

            <h1 className="mt-4 text-xl font-medium leading-8 sm:text-2xl sm:leading-9 lg:text-3xl">
              {card.front}
            </h1>
          </div>

          {!revealed ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
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
      </div>

      {revealed && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#080808]/95 px-4 py-4 backdrop-blur-md sm:px-6">
          <div className="mx-auto max-w-3xl">
            <div className="mb-3 text-center text-xs text-zinc-600">
              How confident are you?
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => void rateCard(1)}
                className="rounded-xl border border-red-500/20 bg-red-500/5 px-2 py-3.5 text-xs text-red-400 transition hover:bg-red-500/10 disabled:opacity-50 sm:px-4 sm:text-sm"
              >
                1 · Needs work
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => void rateCard(2)}
                className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-2 py-3.5 text-xs text-amber-400 transition hover:bg-amber-500/10 disabled:opacity-50 sm:px-4 sm:text-sm"
              >
                2 · Getting there
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => void rateCard(3)}
                className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-2 py-3.5 text-xs text-emerald-400 transition hover:bg-emerald-500/10 disabled:opacity-50 sm:px-4 sm:text-sm"
              >
                3 · Confident
              </button>
            </div>

            <p className="mt-3 text-center text-xs text-zinc-700">
              Low-confidence cards come back first
              next session.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  fetchCurrentUser,
  type AuthUser,
} from "@/lib/auth";

interface KitListItem {
  _id: string;
  status: "generating" | "completed" | "failed";

  input: {
    jd: string;
    companyUrl: string;
    days: number;
  };

  kit: {
    source?: {
      company?: string;
      role?: string;
      company_url?: string;
    };
  };

  createdAt: string;
  updatedAt: string;
}

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] =
    useState<AuthUser | null>(null);

  const [kits, setKits] =
    useState<KitListItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const user = await fetchCurrentUser();

        if (!user) {
          router.replace("/");
          return;
        }

        const kitsResponse = await api<{
          success: boolean;
          kits: KitListItem[];
        }>("/api/kits");

        setUser(user);
        setKits(kitsResponse.kits);
      } catch {
        router.replace("/");
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, [router]);

  async function handleLogout() {
    try {
      await api("/api/auth/logout", {
        method: "POST",
      });

      router.replace("/");
    } catch {
      setError("Could not log out");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080808] text-zinc-500">
        Loading your workspace...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080808] text-white">

      {/* NAV */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <div>
            <div className="text-sm font-medium tracking-[0.18em] text-emerald-400">
              TRAO PREP
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-zinc-500 sm:block">
              {user?.email}
            </span>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">

        {/* HEADER */}
        <section className="flex flex-col gap-7 border-b border-white/10 pb-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm text-zinc-500">
              Interview workspace
            </div>

            <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
              Your preparation kits
            </h1>

            <p className="mt-4 max-w-xl text-zinc-500">
              Research the company, understand
              the role, and focus your practice
              on what matters.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push("/kits/new")
            }
            className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            + Create new kit
          </button>
        </section>

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* EMPTY */}
        {kits.length === 0 && (
          <section className="mt-16 rounded-3xl border border-dashed border-white/10 px-6 py-20 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-xl">
              +
            </div>

            <h2 className="mt-5 text-xl font-medium">
              No preparation kits yet
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
              Paste a job description and
              company URL. We&apos;ll research
              the company and build a focused
              interview plan.
            </p>

            <button
              type="button"
              onClick={() =>
                router.push("/kits/new")
              }
              className="mt-7 rounded-xl bg-white px-5 py-3 text-sm font-medium text-black"
            >
              Build your first kit
            </button>
          </section>
        )}

        {/* KITS */}
        {kits.length > 0 && (
          <section className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {kits.map((kit) => {
              const company =
                kit.kit?.source?.company ||
                "Company";

              const role =
                kit.kit?.source?.role ||
                "Interview role";

              return (
                <button
                  type="button"
                  key={kit._id}
                  onClick={() =>
                    router.push(
                      `/kits/${kit._id}`
                    )
                  }
                  className="group rounded-2xl border border-white/10 bg-[#101010] p-6 text-left transition hover:border-white/20 hover:bg-[#131313]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-zinc-500">
                      {kit.status}
                    </div>

                    <span className="text-zinc-700 transition group-hover:translate-x-1 group-hover:text-zinc-400">
                      →
                    </span>
                  </div>

                  <div className="mt-8">
                    <div className="text-sm text-emerald-400">
                      {company}
                    </div>

                    <h2 className="mt-2 text-xl font-medium">
                      {role}
                    </h2>
                  </div>

                  <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-4 text-xs text-zinc-600">
                    <span>
                      {kit.input.days} day
                      {kit.input.days === 1
                        ? ""
                        : "s"}
                    </span>

                    <span>
                      {new Date(
                        kit.createdAt
                      ).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

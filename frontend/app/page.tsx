"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type Mode = "login" | "register";

export default function HomePage() {
  const router = useRouter();

  const [mode, setMode] =
    useState<Mode>("login");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleSubmit(
    event: FormEvent
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      await api(
        `/api/auth/${
          mode === "login"
            ? "login"
            : "register"
        }`,
        {
          method: "POST",

          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl items-center px-6 py-12 lg:px-10">
        <div className="grid w-full gap-16 lg:grid-cols-2 lg:items-center">

          {/* LEFT */}
          <section>
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              AI Interview Preparation
            </div>

            <h1 className="max-w-2xl text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
              Walk into your
              <span className="block text-zinc-500">
                interview prepared.
              </span>
            </h1>

            <p className="mt-7 max-w-xl text-lg leading-8 text-zinc-400">
              Turn any job description and
              company website into a focused
              interview preparation kit.
            </p>

            <div className="mt-10 grid max-w-xl grid-cols-3 gap-3">
              {[
                ["01", "Research"],
                ["02", "Practice"],
                ["03", "Prepare"],
              ].map(([number, label]) => (
                <div
                  key={number}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="text-xs text-zinc-600">
                    {number}
                  </div>

                  <div className="mt-5 text-sm text-zinc-300">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* AUTH CARD */}
          <section className="mx-auto w-full max-w-md">
            <div className="rounded-3xl border border-white/10 bg-[#111] p-7 shadow-2xl shadow-black/40">

              <div className="mb-7">
                <div className="text-sm text-emerald-400">
                  TRAO PREP
                </div>

                <h2 className="mt-3 text-2xl font-semibold">
                  {mode === "login"
                    ? "Welcome back"
                    : "Create your account"}
                </h2>

                <p className="mt-2 text-sm text-zinc-500">
                  {mode === "login"
                    ? "Continue preparing for your next interview."
                    : "Create an account and generate your first preparation kit."}
                </p>
              </div>

              <div className="mb-6 grid grid-cols-2 rounded-xl bg-black p-1">
                <button
                  type="button"
                  onClick={() =>
                    setMode("login")
                  }
                  className={`rounded-lg px-4 py-2.5 text-sm transition ${
                    mode === "login"
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-500 hover:text-white"
                  }`}
                >
                  Sign in
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setMode("register")
                  }
                  className={`rounded-lg px-4 py-2.5 text-sm transition ${
                    mode === "register"
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-500 hover:text-white"
                  }`}
                >
                  Register
                </button>
              </div>

              <form
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    Email
                  </label>

                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) =>
                      setEmail(e.target.value)
                    }
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm outline-none transition placeholder:text-zinc-700 focus:border-emerald-500/60"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    Password
                  </label>

                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    placeholder="Minimum 8 characters"
                    className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm outline-none transition placeholder:text-zinc-700 focus:border-emerald-500/60"
                  />
                </div>

                {error && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                <button
                  disabled={loading}
                  type="submit"
                  className="mt-2 w-full rounded-xl bg-white px-4 py-3 font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading
                    ? "Please wait..."
                    : mode === "login"
                    ? "Continue"
                    : "Create account"}
                </button>
              </form>

              <p className="mt-6 text-center text-xs leading-5 text-zinc-600">
                Research companies. Understand
                requirements. Practice what
                matters.
              </p>
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}

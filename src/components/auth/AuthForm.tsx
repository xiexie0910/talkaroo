"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { safeInternalPath } from "@/lib/safeRedirect";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

type AuthFormProps = {
  mode: AuthMode;
  nextPath?: string;
  initialError?: string | null;
};

export function AuthForm({ mode, nextPath = "/session", initialError }: AuthFormProps) {
  const router = useRouter();
  const safeNext = safeInternalPath(nextPath, "/session");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setPending(true);

    try {
      const supabase = createClient();

      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() || undefined },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
          },
        });
        if (signUpError) throw signUpError;

        if (data.session) {
          router.replace(safeNext);
          router.refresh();
          return;
        }

        setInfo("Check your email to confirm your account, then sign in.");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;

      router.replace(safeNext);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-panel glass-panel">
        <Link href="/" className="brand-mark">
          Talkaroo
        </Link>
        <p className="kicker">{mode === "login" ? "Sign in" : "Sign up"}</p>
        <h1 className="auth-title">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="auth-sub">
          {mode === "login"
            ? "Continue Korean conversation practice."
            : "Save sessions and track what you practice."}
        </p>

        <form className="auth-form" onSubmit={onSubmit}>
          {mode === "signup" ? (
            <label className="auth-field">
              <span>Display name</span>
              <input
                type="text"
                autoComplete="nickname"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Optional"
              />
            </label>
          ) : null}

          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </label>

          {error ? <p className="auth-error">{error}</p> : null}
          {info ? <p className="auth-info">{info}</p> : null}

          <button type="submit" className="btn-primary auth-submit" disabled={pending}>
            {pending
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Sign up"}
          </button>
        </form>

        <p className="auth-switch">
          {mode === "login" ? (
            <>
              No account?{" "}
              <Link href={`/signup?next=${encodeURIComponent(safeNext)}`}>
                Sign up
              </Link>
            </>
          ) : (
            <>
              Already practicing?{" "}
              <Link href={`/login?next=${encodeURIComponent(safeNext)}`}>
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

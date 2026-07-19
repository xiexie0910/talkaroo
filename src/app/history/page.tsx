import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { listPracticeSessions } from "@/lib/db/practice";
import { createClient } from "@/lib/supabase/server";

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (typeof userId !== "string") {
    redirect("/login?next=/history");
  }

  const sessions = await listPracticeSessions(supabase, userId);

  return (
    <main className="history-shell">
      <header className="session-top">
        <div>
          <p className="brand-mark">Talkaroo</p>
          <p className="text-sm text-[var(--muted)]">Practice history</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/session" className="btn-primary">
            New session
          </Link>
          <SignOutButton />
        </div>
      </header>

      {sessions.length === 0 ? (
        <p className="history-empty">
          No saved sessions yet. Start a conversation and your practice will
          appear here.
        </p>
      ) : (
        <ul className="history-list">
          {sessions.map((s) => (
            <li key={s.id} className="history-item">
              <div>
                <p className="history-title">
                  {s.title_ko ?? s.scenario_id}
                  {s.title_en ? (
                    <span className="history-title-en"> · {s.title_en}</span>
                  ) : null}
                </p>
                <p className="history-meta">{formatWhen(s.started_at)}</p>
              </div>
              <span
                className={
                  s.status === "active"
                    ? "history-badge history-badge-active"
                    : "history-badge"
                }
              >
                {s.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

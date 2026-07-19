import { AuthForm } from "@/components/auth/AuthForm";
import { safeInternalPath } from "@/lib/safeRedirect";

type LoginPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = safeInternalPath(params.next, "/session");
  const initialError =
    params.error === "confirm_failed"
      ? "Email confirmation failed. Try signing in or request a new link."
      : params.error === "auth_callback_failed"
        ? "Could not complete sign-in. Please try again."
        : null;

  return (
    <main className="min-h-full flex-1">
      <AuthForm mode="login" nextPath={nextPath} initialError={initialError} />
    </main>
  );
}

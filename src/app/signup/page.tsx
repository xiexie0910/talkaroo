import { AuthForm } from "@/components/auth/AuthForm";
import { safeInternalPath } from "@/lib/safeRedirect";

type SignupPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const nextPath = safeInternalPath(params.next, "/session");

  return (
    <main className="min-h-full flex-1">
      <AuthForm mode="signup" nextPath={nextPath} />
    </main>
  );
}

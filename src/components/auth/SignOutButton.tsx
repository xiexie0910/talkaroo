"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      className="btn-secondary"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const supabase = createClient();
          await supabase.auth.signOut();
          router.replace("/login");
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? "…" : "Sign out"}
    </button>
  );
}

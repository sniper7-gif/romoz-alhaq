import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Dashboard from "@/components/dashboard";

async function Gate() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <Dashboard session={session} />;
}

export default function Home() {
  return (
    <Suspense fallback={<main className="grid min-h-dvh place-items-center text-xs tracking-widest text-dim">ESTABLISHING LINK…</main>}>
      <Gate />
    </Suspense>
  );
}

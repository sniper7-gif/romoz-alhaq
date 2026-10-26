import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Console from "@/components/console";

async function Gate() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <Console session={session} />;
}

export default function Home() {
  return (
    <Suspense fallback={<main className="min-h-screen grid place-items-center text-dim text-xs tracking-widest">ESTABLISHING LINK…</main>}>
      <Gate />
    </Suspense>
  );
}

"use client";
import { useRouter } from "next/navigation";
import { SignupModal } from "@/components/SignupModal";

// One authoritative signup flow. Never simulate provisioning on a second route.
export default function SignupPage() {
  const router = useRouter();
  return <main className="min-h-screen bg-[#0B1017] text-[#EAF1F8]">
    <SignupModal isOpen onClose={() => router.push("/")} onOpenSignIn={() => router.push("/?signin=1")}
      onSuccess={() => router.push("/?signin=1")} />
  </main>;
}

import type { Metadata } from "next";
import { AcceptInvitation } from "@/components/AcceptInvitation";
export const metadata: Metadata = { title: "Join your workspace | SupportV8", referrer: "no-referrer", robots: { index: false, follow: false } };
export default function AcceptInvitePage() { return <AcceptInvitation />; }

import { redirect } from "next/navigation";

const ACTION_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export default async function PortalHelpLinkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const normalized = decodeURIComponent(slug || "").toLowerCase();
  redirect(ACTION_SLUG.test(normalized) ? `/?help=${encodeURIComponent(normalized)}` : "/");
}

import type { Metadata } from "next";
import "./globals.css";
import "./family.css";
import "./family-legacy-tokens.css";
import "./support-family-bridge.css";
import "./support-chat.css";

export const metadata: Metadata = {
  title: "supportv8 — AI Customer Support Intelligence & Automation",
  description: "Enterprise AI customer support intelligence, interaction, and governed automation layer for ServiceV8.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script src="/family-theme.js" />
        {/* Shared ServiceV8 family shell, vendored by scripts/sync-family-ui.mjs (no CDN). */}
        <link rel="stylesheet" href="/vendor/family-ui/family.css" />
        {/* Fetched early; SupportFamilyShell runs it once as a module script. */}
        <link rel="modulepreload" href="/vendor/family-ui/family.js" />
        <meta name="theme-color" content="#0B1017" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Support" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        <link rel="stylesheet" href="https://cdn-uicons.flaticon.com/2.6.0/uicons-regular-rounded/css/uicons-regular-rounded.css" />
        <link rel="stylesheet" href="https://cdn-uicons.flaticon.com/2.6.0/uicons-solid-rounded/css/uicons-solid-rounded.css" />
        <link rel="stylesheet" href="https://cdn-uicons.flaticon.com/2.6.0/uicons-bold-rounded/css/uicons-bold-rounded.css" />
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}`,
          }}
        />
      </head>
      <body className="min-h-screen bg-[#0B1017] text-[#EAF1F8] font-sans antialiased selection:bg-[#EC4899] selection:text-[#FFFFFF]">
        {children}
      </body>
    </html>
  );
}

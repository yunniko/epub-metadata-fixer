import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const SERVICE_NAME = "EPUB Metadata Fixer";
const SERVICE_DESCRIPTION =
  "Free browser-based tools for self-published authors: check and fix EPUB metadata (title, author, language, identifiers), and validate your cover image against Amazon KDP, Kobo, and Apple Books requirements. Nothing is uploaded — every file is processed in your browser.";

const ADSENSE_PUBLISHER_ID = process.env.ADSENSE_PUBLISHER_ID;

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: SERVICE_NAME,
    template: `%s — ${SERVICE_NAME}`,
  },
  description: SERVICE_DESCRIPTION,
  openGraph: {
    title: SERVICE_NAME,
    description: SERVICE_DESCRIPTION,
    url: APP_URL,
    siteName: SERVICE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: SERVICE_NAME,
    description: SERVICE_DESCRIPTION,
  },
  other: {
    ...(process.env.GOOGLE_SITE_VERIFICATION
      ? { "google-site-verification": process.env.GOOGLE_SITE_VERIFICATION }
      : {}),
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        {ADSENSE_PUBLISHER_ID && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}

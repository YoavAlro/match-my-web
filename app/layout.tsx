import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  metadataBase: new URL("https://tweaksy-live.yoavalro.chatgpt.site"),
  title: "Tweaksy Live — make this page fit you",
  description: "A transparent, reversible WebMCP experience for adapting the same live page with your agent.",
  openGraph: {
    type: "website",
    title: "Tweaksy Live",
    description: "Make this page fit you—with transparent, reversible WebMCP adaptations.",
    images: [{ url: "/assets/tweaksy-live-social.png", width: 1200, height: 630, alt: "Tweaksy turns a dense editorial grid into a calm reading card" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tweaksy Live",
    description: "Make this page fit you—with transparent, reversible WebMCP adaptations.",
    images: ["/assets/tweaksy-live-social.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#f7f2e8" />
        <link rel="stylesheet" href="/app.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/shared/theme-provider";
import "./globals.css";

// IBM Plex Sans carries the whole portal. It was drawn for interfaces dense
// with data rather than for landing pages, which is what most of these screens
// are, and its heaviest weight is 700 — so the ExtraBold-everything look this
// replaced is not reachable by accident.
//
// Only the four weights the stylesheets actually use are requested. Plex is
// not a variable font on Google Fonts, so each one is a separate file.
// Self-hosted through next/font, so none of it is a network fetch and the
// fallback metrics are matched.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
});

// Reserved for identifiers a reader compares character by character: roll
// numbers, record ids, hashes. A proportional face makes 2023UCS1632 and
// 2023UCS1362 look alike at a glance, which is the one thing a roll number
// must not do.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "IIIT Lucknow | Training & Placement",
  description: "Student training and placement portal for IIIT Lucknow"
};

const themeScript = `
  try {
    const saved = localStorage.getItem('tnp-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && prefersDark) || (saved === 'system' && prefersDark)) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${plexSans.variable} ${plexMono.variable}`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

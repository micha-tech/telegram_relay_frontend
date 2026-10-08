import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SessionProvider } from "../services/session";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Prime Edge Football — Football Analytics and Live Match Signals",
    template: "Prime Edge Football — %s",
  },
  description:
    "Football data. Market movement. Clearer signals. Match context, odds analysis and structured live signals in one analytical workspace.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Prime Edge Football — Football Analytics and Live Match Signals",
    description:
      "See the match. Read the market. Find your edge with SoccerTradeView.",
    type: "website",
  },
};
export const viewport: Viewport = { themeColor: "#030716" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}

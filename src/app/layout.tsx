import type { Metadata } from "next";
import "./globals.css";

import localFont from "next/font/local";
import { css } from "@/pandacss/css";

const pretendard = localFont({
  src: "../../public/fonts/PretendardVariable.woff2",
  display: "swap",
  weight: "100 900",
  variable: "--font-pretendard",
  preload: true,
});

export const metadata: Metadata = {
  title: "bh2980.dev",
  description: "bh2980's dev blog",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body className={css({ fontFamily: "pretendard" })}>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

import localFont from "next/font/local";
import { css } from "@/pandacss/css";

const ibmPlex = localFont({
  src: [
    {
      path: "../../public/fonts/IBMPlexSansKR-ExtraLight.woff2",
      weight: "200",
      style: "normal",
    },
    {
      path: "../../public/fonts/IBMPlexSansKR-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../public/fonts/IBMPlexSansKR-Text.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/IBMPlexSansKR-Regular.woff2",
      weight: "450",
      style: "normal",
    },
    {
      path: "../../public/fonts/IBMPlexSansKR-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/IBMPlexSansKR-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/fonts/IBMPlexSansKR-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-ibmplex",
});

const righteous = localFont({
  src: "../../public/fonts/Righteous-Regular.ttf",
  display: "swap",
  variable: "--font-righteous",
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
    <html lang="ko" className={`${ibmPlex.variable} ${righteous.variable}`}>
      <body className={css({ fontFamily: "ibmPlex" })}>{children}</body>
    </html>
  );
}

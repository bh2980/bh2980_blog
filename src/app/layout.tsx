import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const pretendardVariable = localFont({
  src: "../../public/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "bh2980's blog",
  description: "bh2980's blog",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${pretendardVariable.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}

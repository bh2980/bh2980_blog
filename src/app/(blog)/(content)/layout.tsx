import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Fragment } from "react";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Fragment>
      <Navigation className="bg-white border-b border-gray-800 border-gray-200 sticky top-0 z-10 dark:bg-gray-950 dark:border-gray-800" />
      <main className="flex-1 flex flex-col">{children}</main>
    </Fragment>
  );
}

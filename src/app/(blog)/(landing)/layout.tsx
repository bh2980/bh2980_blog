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
      <Navigation className="absolute top-0 w-full z-10 bg-transparent" />
      <main className="flex-1 flex flex-col">{children}</main>
    </Fragment>
  );
}

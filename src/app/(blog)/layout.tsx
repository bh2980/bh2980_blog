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
      <Navigation />
      <main className="flex-1">{children}</main>
      <Footer />
    </Fragment>
  );
}

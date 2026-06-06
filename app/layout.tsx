import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Falsify",
  description: "Evidence-based verification for forwarded messages."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

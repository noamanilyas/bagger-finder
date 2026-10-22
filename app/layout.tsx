import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bagger Finder",
  description: "Used Yanmar, Doosan and Hyundai excavators in Germany on one map",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

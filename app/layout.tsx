import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "draw.io AI Editor",
  description: "Describe a diagram in plain English and edit it live in draw.io.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

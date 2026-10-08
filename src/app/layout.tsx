import "./globals.css";
import type { Metadata } from "next";
import { Poppins } from "next/font/google";

const font = Poppins({
  weight: ["200", "300", "400","600", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Paper Bidding",
  description: "Computational Methods Paper Bidding Tool",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`min-h-screen  ${font.className}`}>
        {children}
      </body>
    </html>
  );
}

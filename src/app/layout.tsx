import "./globals.css";
import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import AuthProvider from "@/components/authprovider";

const font = Poppins({
  weight: "400",
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
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

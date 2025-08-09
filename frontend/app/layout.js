import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Provider from "./provider";
import Header from "./_components/Header";
import FloatingDock from "../components/ui/FloatingDock";
import { GalleryHorizontalEnd, Home as HomeIcon } from "lucide-react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "KnowledgeLink",
  description: "Save links, get AI summaries, and search with vectors.",
  icons: {
    icon: "/kl1.png",
    shortcut: "/kl1.png",
    apple: "/kl1.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Provider>
          {children}
          <Header />
          <FloatingDock
            items={[
              { title: "Home", icon: <HomeIcon className="h-full w-full" />, href: "/" },
              { title: "Library", icon: <GalleryHorizontalEnd className="h-full w-full" />, href: "/lib" },
            ]}
          />
        </Provider>
      </body>
    </html>
  );
}

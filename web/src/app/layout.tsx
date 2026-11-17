import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import { TelegramProvider } from "@/components/providers/telegram-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const onest = Onest({ variable: "--font-onest", subsets: ["latin", "cyrillic"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Oydin", template: "%s · Oydin" },
  description: "Второй мозг для малого бизнеса: заранее покажет, хватит ли денег на обещанные платежи.",
  applicationName: "Oydin",
  appleWebApp: { capable: true, title: "Oydin", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/pwa-icon/180" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fbf7ee",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={onest.variable}>
      <body className="min-h-dvh font-sans">
        <TelegramProvider>{children}</TelegramProvider>
        <Toaster />
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { SwRegister } from "@/components/sw-register";
import { UpdatePrompt } from "@/components/update-prompt";
import { APP_DESCRIPTION, APP_NAME, THEME_COLOR } from "@/lib/config";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
    : undefined,
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: THEME_COLOR,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${manrope.variable} h-full antialiased`}>
      <body className="flex min-h-dvh flex-col">
        {children}
        <SwRegister />
        <UpdatePrompt />
      </body>
    </html>
  );
}

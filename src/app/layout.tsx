import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudyTok · 공부를 숏폼으로",
  description: "강의자료·자격증 PDF를 올리면 개념마다 모션그래픽 숏폼과 퀴즈로 바꿔 주는 학습 피드",
  applicationName: "StudyTok",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon-180.png" },
  appleWebApp: { capable: true, title: "StudyTok", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#4B6BFB",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

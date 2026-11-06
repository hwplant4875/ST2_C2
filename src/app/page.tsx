"use client";

import { useEffect, useState } from "react";
import App from "@/components/App";

export default function Page() {
  // The app reads localStorage and drives browser-only APIs (Web Audio, pdf.js),
  // so it renders on the client only.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#eef0f6" }}>
        <div style={{ font: "400 28px Jua, sans-serif", color: "#1B1B3A" }}>StudyTok</div>
      </div>
    );
  }
  return <App />;
}

import type { Metadata } from "next";
import { Newsreader } from "next/font/google";
import "./styles/tokens.css";
import "./styles/lumora-components.css";
import "./styles/globals.css";

const newsreader = Newsreader({ subsets: ["latin"], weight: "500", variable: "--font-newsreader" });

export const metadata: Metadata = {
  title: { default: "CSE Attendance", template: "%s · CSE Attendance" },
  description: "Rotating-QR attendance for lecturers and students.",
};

// Applies the saved theme before the first paint, so there's no flash.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={newsreader.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

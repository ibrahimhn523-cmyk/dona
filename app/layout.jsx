import "./globals.css";

export const metadata = {
  title: "دونا — سكرتيرك الذكي",
  description: "وكيل ذكي شخصي بالعربية مدعوم بالصوت",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#2b6cb0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WeatherPulse — Multi-Source Weather Intelligence",
  description:
    "WeatherPulse aggregates live weather data from multiple providers, evaluates agreement and freshness, and gives you an honest confidence score for Indore and beyond.",
  keywords: "weather, Indore, weather app, multi-source, weather confidence, WeatherPulse",
  authors: [{ name: "WeatherPulse" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/app-icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" }
    ],
    apple: [
      { url: "/app-icon.svg" }
    ]
  },
  openGraph: {
    title: "WeatherPulse",
    description: "Honest, multi-source weather intelligence for Indore",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f8f9fb",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300..800;1,14..32,300..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

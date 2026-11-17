import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Oydin",
    short_name: "Oydin",
    description: "Второй мозг для малого бизнеса",
    lang: "ru",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#fbf7ee",
    theme_color: "#fbf7ee",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

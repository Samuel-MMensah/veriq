import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Veriq Health",
    short_name: "Veriq Health",
    description: "Know before you go. See which hospitals really accept your card.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6f5",
    theme_color: "#0b6e4f",
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}

import type { MetadataRoute } from "next";

   export default function manifest(): MetadataRoute.Manifest {
     return {
       name: "Reconecta VE",
       short_name: "Reconecta",
       description: "Buscador unificado de personas tras el terremoto",
       start_url: "/",
       display: "standalone",
       background_color: "#EEF2F2",
       theme_color: "#0E6E6E",
       icons: [
         { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
         { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
       ],
     };
   }
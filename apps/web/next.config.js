import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
});

export default withSerwist({
  // Necesario para que Next compile el código TypeScript del paquete del monorepo:
  transpilePackages: ["@repo/logistics"],
});
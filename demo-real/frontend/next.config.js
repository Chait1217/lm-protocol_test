/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/trade-demo/", destination: "/trade-demo", permanent: false },
    ];
  },
  // Ensure @polymarket/clob-client and ethers are NOT bundled by webpack
  experimental: {
    serverComponentsExternalPackages: [
      "@polymarket/clob-client",
      "@polymarket/builder-relayer-client",
      "@polymarket/builder-signing-sdk",
      "ethers",
    ],
  },
  webpack: (config, { dev, isServer }) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage/async-storage": false,
    };
    // Also externalize for server builds to prevent bundling issues
    if (isServer) {
      config.externals.push(
        "@polymarket/clob-client",
        "@polymarket/builder-relayer-client",
        "@polymarket/builder-signing-sdk",
        "ethers"
      );
    }
    if (dev && process.env.NEXT_USE_POLLING === "true") {
      config.watchOptions = {
        ...config.watchOptions,
        poll: 2000,
        ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**"],
      };
    }
    return config;
  },
};

module.exports = nextConfig;

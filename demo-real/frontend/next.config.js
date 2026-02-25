/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage/async-storage": false,
    };
    // Polling is expensive; enable only when explicitly requested:
    //   NEXT_USE_POLLING=true npm run dev
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

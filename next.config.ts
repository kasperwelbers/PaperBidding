import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // ...
  },
};

export default nextConfig;

// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   turbopack: {},

//   // Override the default webpack configuration
//   webpack: (config) => {
//     // See https://webpack.js.org/configuration/resolve/#resolvealias
//     config.resolve.alias = {
//       ...config.resolve.alias,
//       sharp$: false,
//       "onnxruntime-node$": false,
//     };
//     return config;
//   },
// };

// module.exports = nextConfig;

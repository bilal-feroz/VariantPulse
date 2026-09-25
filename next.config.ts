import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Next compiles this file to CommonJS, so `__dirname` is the project directory.
  outputFileTracingRoot: path.resolve(__dirname),
};

export default nextConfig;

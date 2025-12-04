import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use webpack instead of Turbopack for build (fixes node_modules issues)
  experimental: {
    // Turbopack has issues with some node_modules test files
  },
  
  // Ignore problematic packages during build
  webpack: (config, { isServer }) => {
    // Fix for WalletConnect dependencies
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    
    // Ignore test files in node_modules
    config.module.rules.push({
      test: /node_modules\/thread-stream\/test/,
      use: 'null-loader',
    });
    
    return config;
  },
  
  // Transpile problematic packages
  transpilePackages: ['@walletconnect/ethereum-provider'],
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@myinventory/shared'],
  // Allow the Cloudflare tunnel host and any trycloudflare subdomains in dev
  allowedDevOrigins: [
    'higher-memorial-steering-donna.trycloudflare.com',
    '*.trycloudflare.com',
  ],
};

export default nextConfig;

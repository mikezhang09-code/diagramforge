/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // `next dev` blocks its /_next/* resources from non-localhost origins. This
  // allows reaching the dev server by the VM's Tailscale IP. Dev-only —
  // production builds ignore this entirely.
  allowedDevOrigins: ["100.113.14.97"],
};

export default nextConfig;

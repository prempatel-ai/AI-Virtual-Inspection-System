/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/_blocks",
        destination: "/blocks",
      },
    ];
  },
};

export default nextConfig;

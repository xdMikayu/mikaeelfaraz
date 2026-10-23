/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // The cricket routes read the model's tables from disk at run time (src/lib/cricket-data.mjs)
    // rather than bundling 13 MB of JSON, so the files have to ship with them.
    outputFileTracingIncludes: { '/api/cricket': ['./src/lib/cricket/**/*.json'] },
  },
  async redirects() {
    // Addresses from when Matchday lived at www.mikaeelfaraz.com/sport, put onto this domain by hand.
    // (/sport on its own needs its own rule: through /:path* it would redirect to an empty address.)
    return [
      { source: '/sport', destination: '/', permanent: true },
      { source: '/sport/:path+', destination: '/:path+', permanent: true },
    ];
  },
};

export default nextConfig;

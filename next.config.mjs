/** @type {import('next').NextConfig} */
const old = ['/about', '/projects', '/projects/:path*', '/experience', '/records', '/contact', '/services'];

const nextConfig = {
  experimental: {
    // The cricket routes read the model's tables from disk at run time (src/lib/sport/cricket-data.mjs)
    // rather than bundling 13 MB of JSON, so the files have to ship with them.
    outputFileTracingIncludes: { '/api/sport/cricket': ['./src/lib/sport/cricket/**/*.json'] },
  },
  async redirects() {
    return [
      ...old.map((source) => ({ source, destination: '/', permanent: true })),
      { source: '/resume', destination: '/resume.pdf', permanent: false },
      { source: '/cv', destination: '/resume.pdf', permanent: false },
    ];
  },
};

export default nextConfig;

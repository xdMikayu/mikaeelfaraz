/** @type {import('next').NextConfig} */
const old = ['/about', '/projects', '/projects/:path*', '/experience', '/records', '/contact', '/services'];

const nextConfig = {
  async redirects() {
    return [
      ...old.map((source) => ({ source, destination: '/', permanent: true })),
      { source: '/resume', destination: '/resume.pdf', permanent: false },
      { source: '/cv', destination: '/resume.pdf', permanent: false },
    ];
  },
};

export default nextConfig;

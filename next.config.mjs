/** @type {import('next').NextConfig} */
const old = ['/about', '/projects', '/projects/:path*', '/experience', '/records', '/contact', '/services'];

const nextConfig = {
  async redirects() {
    return [
      ...old.map((source) => ({ source, destination: '/', permanent: true })),
      { source: '/resume', destination: '/resume.pdf', permanent: false },
      { source: '/cv', destination: '/resume.pdf', permanent: false },
      // Mifolio moved to its own site. (API calls under /api/finance are forwarded, not redirected.)
      { source: '/finance', destination: 'https://mifolio.mikaeelfaraz.com/', permanent: false },
      { source: '/finance/transactions', destination: 'https://mifolio.mikaeelfaraz.com/activity', permanent: false },
      { source: '/finance/portfolio', destination: 'https://mifolio.mikaeelfaraz.com/net-worth', permanent: false },
      { source: '/finance/:path*', destination: 'https://mifolio.mikaeelfaraz.com/:path*', permanent: false },
    ];
  },
};

export default nextConfig;

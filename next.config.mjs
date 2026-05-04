/** @type {import('next').NextConfig} */
const nextConfig = {
  /* Suppress slow filesystem warning on network/mapped drives */
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/**',
      },
    ],
  },
};

export default nextConfig;

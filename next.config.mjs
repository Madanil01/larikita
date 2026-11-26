/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: 'https', hostname: '**.cloudfront.net' }, { protocol: 'https', hostname: '**.strava.com' }] },
};
export default nextConfig;

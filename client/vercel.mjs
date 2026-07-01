const apiOrigin = String(process.env.API_ORIGIN || '').trim().replace(/\/+$/, '');

if (!apiOrigin) {
  throw new Error(
    'API_ORIGIN is required. Set it to the deployed API origin, without the /api suffix.',
  );
}

export const config = {
  framework: 'vite',
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
  rewrites: [
    {
      source: '/api/:path*',
      destination: `${apiOrigin}/api/:path*`,
    },
    {
      source: '/(.*)',
      destination: '/index.html',
    },
  ],
};

import type { NextConfig } from 'next';

function buildContentSecurityPolicy() {
  const connectSources = ["'self'", 'https://challenges.cloudflare.com', 'ws:', 'wss:'];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (supabaseUrl) {
    try {
      connectSources.push(new URL(supabaseUrl).origin);
    } catch {
      // Ignore malformed env values and fall back to same-origin only.
    }
  }

  const isProduction = process.env.NODE_ENV === 'production';

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "font-src 'self' data:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'self' https://challenges.cloudflare.com",
    "img-src 'self' data: blob: https:",
    "manifest-src 'self'",
    "media-src 'self' blob: data:",
    "object-src 'none'",
    // unsafe-eval is only needed in development for Next.js hot-reload / source maps.
    // In production we drop it to strengthen XSS protection.
    isProduction
      ? "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    `connect-src ${connectSources.join(' ')}`,
    "worker-src 'self' blob:",
  ];

  if (isProduction) {
    directives.push('upgrade-insecure-requests');
  }

  return directives.join('; ');
}

function buildAllowedOrigin(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      return new URL(appUrl).origin;
    } catch {
      // Fall through
    }
  }
  return '';
}

const allowedOrigin = buildAllowedOrigin();

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: buildContentSecurityPolicy(),
  },
  {
    key: 'Cross-Origin-Opener-Policy',
    value: 'same-origin-allow-popups',
  },
  {
    key: 'Permissions-Policy',
    value: [
      'accelerometer=()',
      'autoplay=()',
      'browsing-topics=()',
      'camera=()',
      'clipboard-read=()',
      'clipboard-write=(self)',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'payment=()',
      'picture-in-picture=()',
      'usb=()',
    ].join(', '),
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'off',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Permitted-Cross-Domain-Policies',
    value: 'none',
  },
];

const corsHeaders = [
  {
    key: 'Access-Control-Allow-Origin',
    value: allowedOrigin || 'null',
  },
  {
    key: 'Access-Control-Allow-Methods',
    value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  },
  {
    key: 'Access-Control-Allow-Headers',
    value: 'Content-Type, Authorization, X-Request-Id, X-Extension-Version',
  },
  {
    key: 'Access-Control-Max-Age',
    value: '86400',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@study-assistant/ui', '@study-assistant/shared-types', '@study-assistant/shared-utils'],
  typedRoutes: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/api/:path*',
        headers: corsHeaders,
      },
    ];
  },
};

export default nextConfig;

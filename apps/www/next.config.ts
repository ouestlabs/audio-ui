import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";
import type { Redirect } from "next/dist/lib/load-custom-routes";

const registryDeploymentId =
  process.env.VERCEL_DEPLOYMENT_ID ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  Date.now().toString(36);

function versionedRegistryDestination(destination: string) {
  const separator = destination.includes("?") ? "&" : "?";
  return `${destination}${separator}v=${registryDeploymentId}`;
}

function createVersionedRegistryRedirects(
  source: string,
  destination: string
): Redirect[] {
  return [
    {
      source,
      missing: [
        {
          type: "query",
          key: "v",
        },
      ],
      destination: versionedRegistryDestination(destination),
      permanent: false,
    },
    {
      source,
      has: [
        {
          type: "query",
          key: "v",
          value: "(?<registryVersion>.*)",
        },
      ],
      destination: `${destination}?v=:registryVersion`,
      permanent: true,
    },
  ];
}

const nextConfig: NextConfig = {
  devIndicators: false,
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
  skipProxyUrlNormalize: true,
  env: {
    // Shared with the browser so registry JSON URLs rotate on every deploy.
    // Build timestamp is the last fallback so redeploys still invalidate caches
    // even if Vercel system env exposure is disabled.
    NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID: registryDeploymentId,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  outputFileTracingIncludes: {
    "/*": [
      "./src/registry/**/*",
      "./src/registry-audio/**/*",
      "./public/r/styles/**/*",
    ],
  },
  experimental: {
    // Enable file system cache for development
    turbopackFileSystemCacheForDev: true,
    optimizePackageImports: [
      "lucide-react",
      "@tabler/icons-react",
      "@phosphor-icons/react",
      "@base-ui/react",
      "radix-ui",
      "motion",
      "jotai",
    ],
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  images: {
    minimumCacheTTL: 2_592_000, // 30 days - reduce image re-optimizations
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "avatar.vercel.sh",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
  },
  headers() {
    const versionedRegistryHeaders = [
      {
        key: "Cache-Control",
        value:
          "public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400, immutable",
      },
      {
        key: "CDN-Cache-Control",
        value:
          "public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400",
      },
      {
        key: "Vercel-CDN-Cache-Control",
        value:
          "public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400",
      },
    ];
    const redirectRegistryHeaders = [
      {
        key: "Cache-Control",
        value: "no-store, max-age=0",
      },
      {
        key: "CDN-Cache-Control",
        value: "no-store",
      },
      {
        key: "Vercel-CDN-Cache-Control",
        value: "no-store",
      },
    ];
    const securityHeaders = [
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "X-DNS-Prefetch-Control",
        value: "on",
      },
    ];

    return [
      {
        // Versioned registry assets are immutable for the lifetime of a deploy.
        source: "/r/styles/:path*",
        has: [
          {
            type: "query",
            key: "v",
          },
        ],
        headers: versionedRegistryHeaders,
      },
      {
        // Bare registry URLs must not cache the redirect response, otherwise a
        // client could stay pinned to an older deployment id.
        source: "/r/:path*",
        missing: [
          {
            type: "query",
            key: "v",
          },
        ],
        headers: redirectRegistryHeaders,
      },
      {
        // All pages: allow same-origin + approved external sites to embed in iframes
        source: "/(.*)",
        headers: [
          ...securityHeaders,
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://shoogle.dev https://*.shoogle.dev",
          },
        ],
      },
      {
        // API routes: block iframes entirely
        source: "/api/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
  rewrites() {
    return [
      {
        source: "/docs/:path*.md",
        destination: "/llm/:path*",
      },
      // PostHog rewrites
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  redirects() {
    return [
      {
        source: "/docs/:path*.mdx",
        destination: "/docs/:path*.md",
        permanent: true,
      },
      // Canonicalize registry URLs to a deploy-scoped cache key.
      ...createVersionedRegistryRedirects(
        "/r/:name.json",
        "/r/styles/base-nova/:name.json"
      ),
      {
        source: "/r/styles/:path*",
        missing: [
          {
            type: "query",
            key: "v",
          },
        ],
        destination: versionedRegistryDestination("/r/styles/:path*"),
        permanent: false,
      },
      ...createVersionedRegistryRedirects(
        "/r/:style/:name.json",
        "/r/styles/:style/:name.json"
      ),
    ];
  },
};

const withMDX = createMDX({});

export default withMDX(nextConfig);

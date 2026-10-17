interface ImportMetaEnv {
  /** Set at build: changes on every deploy, so the registry's addresses are a new cache key each time. */
  readonly VITE_DEPLOYMENT_ID: string;
  /** PostHog's project token; analytics are off without it. */
  readonly VITE_PUBLIC_POSTHOG_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

# Changelog

## 1.0.0 — 2026-09-27

First release on the v1 protocol, written from scratch over `@mirafive/sdk-browser` 1.0.

- `<MiraProvider client bootstrap>`, `useMira()`, `useFlag()`, `useFlagConfig()` and
  `useTrackOnMount()` (0.84 kB with peers external).
- Flag hooks use `useSyncExternalStore`: the server render and hydration read only the
  `bootstrap` prop (a `FlagBootstrap` or the block `UserFlags.bootstrap()` returns), so
  both render the same markup; afterwards they follow the browser SDK's `onFlags`.
- `useMira()` returns an inert client during a server render (`onFlags` returns a no-op
  unsubscribe, `flush()` resolves).
- A bootstrap older than 7 days is ignored, as sdk-browser ignores it; a config equal to
  the bootstrap's keeps the rendered object, so hydration causes no extra render.
- `useTrackOnMount()` sends once per mount, StrictMode included.
- No router hooks: `pageviews()` from sdk-browser counts every SPA navigation.

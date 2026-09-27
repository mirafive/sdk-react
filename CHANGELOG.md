# Changelog

## 0.5.0 — unreleased

First release on the v1 protocol, written from scratch over `@mirafive/sdk-browser` 0.5.

- `<MiraProvider client bootstrap>`, `useMira()`, `useFlag()`, `useFlagConfig()` and
  `useTrackOnMount()` (0.73 kB with peers external).
- Flag hooks use `useSyncExternalStore`: the server render and hydration read only the
  `bootstrap` prop (a `FlagBootstrap` or the block `UserFlags.bootstrap()` returns), so
  both render the same markup; afterwards they follow the browser SDK's `onFlags`.
- `useMira()` returns an inert client during a server render.
- `useTrackOnMount()` sends once per mount, StrictMode included.
- No router hooks: `pageviews()` from sdk-browser counts every SPA navigation.

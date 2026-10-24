# Changelog

## Unreleased

- Revenue events may carry `payment_id`, the payment provider's id of the payment (1–255 characters), next to `revenue` and `currency`. Nothing changes in the API: pass it in the properties. The README shows a Stripe example.
- The default ingest host is `https://collect.mirafive.io`.

### Breaking

- Removed feature flags and A/B experiments: `useFlag()`, `useFlagConfig()`, the `FlagBootstrap`
  type and the `bootstrap` prop of `<MiraProvider>`. The provider, `useMira()` and
  `useTrackOnMount()` stay. The inert client of a server render no longer has `onFlags`.
- Statistics is the only consent purpose. A consent call that still passes `experiments` or
  `targeting` is accepted and the keys are ignored.

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

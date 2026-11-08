# @mirafive/react

MIRA FIVE for React: consent-aware analytics and revenue attribution with one provider and three
hooks. Built on [`@mirafive/web`](https://github.com/mirafive/sdk-web), which follows your
consent banner and captures pageviews (also on client-side navigation) on its own. Safe for
server rendering and StrictMode; no dependencies besides MIRA FIVE's own.

On Next.js use [`@mirafive/next`](https://github.com/mirafive/sdk-next), on TanStack Start
[`@mirafive/tanstack`](https://github.com/mirafive/sdk-tanstack): same API, plus server helpers.

## Install

```sh
npm install @mirafive/react   # or: bun add, pnpm add, yarn add
```

React 18 or 19.

## Quickstart

```tsx
// main.tsx
import { MiraProvider } from "@mirafive/react";

createRoot(root).render(
  <MiraProvider publicKey={import.meta.env.VITE_MIRAFIVE_KEY}>
    <App />
  </MiraProvider>,
);
```

```tsx
// anywhere below
import { useIdentify, useMira, useTrackOnMount } from "@mirafive/react";

function Pricing() {
  const mira = useMira();
  useTrackOnMount("pricing_viewed");
  return <button onClick={() => mira.track("signup_started", { plan: "pro" })}>Start</button>;
}

function Session({ user }: { user?: { id: string; plan: string } }) {
  // Identifies on sign-in, resets on sign-out.
  useIdentify(user?.id, { plan: user?.plan });
  return null;
}
```

## API

| Export                                              | What it does                                                                                                                                                                                                                                    |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<MiraProvider publicKey="mira_pk_…" {...options}>` | Starts the client in the browser, once per page. Takes every `@mirafive/web` option (`host`, `consent`, `autocapture`, `adapters`, `debug`), or `client` for one you made with `createMira()`. (`key` is reserved by React, hence `publicKey`.) |
| `useMira<Events>()`                                 | The client: `track`, `page`, `identify`, `group`, `survey`, `consent`, `reset`, `flush`, `status`, `anonymousId`. On a server or without a provider, a stand-in that does nothing.                                                              |
| `useIdentify(userId, traits?)`                      | `identify` when a user id appears or changes, `reset` when it goes away.                                                                                                                                                                        |
| `useTrackOnMount(name, properties?)`                | One event per mount, also under StrictMode.                                                                                                                                                                                                     |

Typed events: `useMira<{ signup_started: { plan: "free" | "pro" } }>()` checks names and
properties. Everything about consent, automatic events and delivery is in the
[`@mirafive/web` README](https://github.com/mirafive/sdk-web#readme).

## For AI coding assistants

Rules for integrating MIRA FIVE correctly. They hold for every MIRA FIVE SDK.

- **Keys:** the public key (`mira_pk_…`) goes in browser and app code. The secret key (`mira_sk_…`)
  goes only into the server's environment (`MIRAFIVE_SECRET_KEY`), never into client code, a
  `NEXT_PUBLIC_`/`VITE_`/`PUBLIC_` variable or a repository. The SDKs refuse the wrong key.
- **Money** is sent only from the server: integer minor units plus an ISO 4217 currency
  (`amount: 1999, currency: "EUR"` is 19.99 EUR), never floats.
- **Count once:** give money an `entryId` from the payment provider (`stripe:in_123`), so the
  Stripe connector and retries do not double it. Give business events a stable id:
  `eventId: await eventIdFor("order:123:paid")`. The same key gives the same id in every SDK.
- **Personal data** never goes into event names or properties. Use your own user id (not an email)
  for `identify`; put email, name and phone in its traits, which MIRA FIVE encrypts at rest.
- **Consent:** keep `consent: "auto"`; it follows the site's consent banner (Usercentrics,
  Cookiebot, consentmanager, CCM19, Borlabs, any TCF 2.2 CMP, Google Consent Mode). Call
  `consent()` only for a custom banner. Do not gate the SDK behind consent yourself: without
  consent it is cookieless and still counts.
- **Never block on analytics:** event methods return nothing, never throw, and batch on their
  own. Do not `await` or `try` them. Call `flush()`/`shutdown()` only at the end of a script or a
  serverless function.
- **Server events and visitors:** pass the browser's `mira.anonymousId` to your server and set it
  as `anonymousId` on server events, so a purchase joins the visit and its source.

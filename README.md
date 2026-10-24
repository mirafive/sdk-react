# @mirafive/sdk-react

React bindings for the MIRA FIVE browser SDK: a provider, a hook for the client,
and a mount tracker. Privacy-first analytics from MIRA FIVE, hosted in the EU.

## Size

| Import | min + gzip |
|---|---|
| `@mirafive/sdk-react` | 0.47 kB |

Measured with its peers (`react`, `@mirafive/sdk-browser`) external: this is what the
package adds on top of the browser SDK. What you do not import is not shipped
(`sideEffects: false`). No transport of its own: events
come from `@mirafive/sdk-browser`.

## Install

```sh
npm install @mirafive/sdk-react @mirafive/sdk-browser
# or: bun add / pnpm add / yarn add
```

Peers: `react` ≥ 18.3 (18 and 19), `@mirafive/sdk-browser` ^1.0.0. ESM only. Using Next.js
or TanStack Start? Use [`@mirafive/sdk-next`](https://github.com/mirafive/sdk-next) or
[`@mirafive/sdk-tanstack`](https://github.com/mirafive/sdk-tanstack): they create the
client for you and add the server side.

## Quickstart

```tsx
// main.tsx: runs once, in the browser
import { createMira } from "@mirafive/sdk-browser"
import { pageviews } from "@mirafive/sdk-browser/pageviews"
import { MiraProvider, useMira } from "@mirafive/sdk-react"
import { createRoot } from "react-dom/client"

const mira = createMira({
  key: import.meta.env.VITE_MIRAFIVE_KEY, // the source's website key, mf_…
  plugins: [pageviews()]
})

function Checkout() {
  const client = useMira()

  return (
    <button onClick={() => client.track("checkout_started", { plan: "pro" })}>
      Checkout
    </button>
  )
}

createRoot(document.getElementById("root")!).render(
  <MiraProvider client={mira}>
    <Checkout />
  </MiraProvider>
)
```

Pageviews come from the `pageviews()` plugin, which follows every SPA router through the
Navigation API or the History API. There is no router hook to add.

For revenue, add `payment_id` (1–255 characters) to the properties next to `revenue` and `currency`: the payment provider's id of the payment. For Stripe pass the Checkout Session id on the success page or the PaymentIntent id from a webhook, for example `client.track("order completed", { revenue: 49, currency: "EUR", payment_id: sessionId })`. MIRA FIVE merges the event with the payment it imports from your connected Stripe account, so the sale counts once.

Verify it: open the app (not `localhost`, or pass `trackLocalhost: true`) and look for
`POST https://collect.mirafive.io/v1/batch/mf_…` in the network tab answering `202`, then
for the pageview in the source's live view in MIRA FIVE.

### Server rendering

`createMira()` needs a browser, so the server render passes `client={undefined}`. Hooks
then use an inert client whose calls do nothing:

```tsx
// module scope of a file both the server and the browser load
const mira =
  typeof window === "undefined"
    ? undefined
    : createMira({ key: import.meta.env.VITE_MIRAFIVE_KEY, plugins: [pageviews()] })

<MiraProvider client={mira}>
```

## Consent & privacy

- Default mode: `consentless` (set on `createMira`). It stores nothing, sets no cookies,
  keeps no ids and needs no consent banner. `mode: "full"` adds an anonymous id, a session
  id and your user id, and needs the `identity()` plugin and a consent answer.
- Pass a consent answer with `useMira().consent(true)` or
  `useMira().consent({ statistics })` from your consent
  manager's callback. Before an answer nothing is stored.
- Statistics is the only consent purpose. The old `experiments` and `targeting` keys are accepted and ignored.
- Do Not Track, Global Privacy Control, `window.__mirafive_ignore` and prerendering send
  nothing. The browser SDK enforces this; these bindings add no path around it.
- This package reads and stores nothing itself.

## API reference

- `<MiraProvider client={mira}>`: makes the client available to the hooks.
  `client` is a `Mira` from `createMira()`, or `undefined` while rendering on a server.
- `useMira<Events>(): Mira<Events>`: the client. During a server render it is an inert
  stand-in: calls do nothing and `flush()` resolves.
- `useTrackOnMount(name, properties?)`: tracks one event when the component mounts, with
  the properties of its first render. Sent once under StrictMode.
- `type MiraProviderProps`.

Both hooks throw when no `<MiraProvider>` is above it.

## Framework / runtime notes

- The module starts with `"use client"`, so it works from React Server Components setups
  as a client module.
- StrictMode: no double events (`useTrackOnMount` keeps its state in a ref).

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Nothing arrives | Local hosts are off by default (`trackLocalhost: true`); Do Not Track or GPC is on; the host is wrong; the origin is not allowed on the source. |
| `403 secret_key_in_path` / `website_key_as_bearer` | The key kinds are swapped: browsers use the website key, servers the secret key. |
| `403 origin_not_allowed` | Add the site's origin to the source in MIRA FIVE. |
| "render <MiraProvider> above hooks" | A hook runs outside the provider. |

## For AI agents

Copy-paste setup prompt:

```text
Add MIRA FIVE analytics to this React app with @mirafive/sdk-react.
1. Install @mirafive/sdk-react and @mirafive/sdk-browser with the project's package manager.
   (Next.js: use @mirafive/sdk-next instead. TanStack Start: @mirafive/sdk-tanstack.)
2. Put the source's website key in the public env var of the bundler, e.g.
   VITE_MIRAFIVE_KEY for Vite. Never put MIRAFIVE_SECRET_KEY in browser code.
3. In the client entry (runs once, browser only):
     import { createMira } from "@mirafive/sdk-browser"
     import { pageviews } from "@mirafive/sdk-browser/pageviews"
     import { MiraProvider } from "@mirafive/sdk-react"
     const mira = createMira({ key: import.meta.env.VITE_MIRAFIVE_KEY, plugins: [pageviews()] })
   and wrap the app in <MiraProvider client={mira}>. Track with useMira().track(name, props)
   or useTrackOnMount(name, props). Do not add router hooks for pageviews: pageviews() covers them.
4. Keep the default consentless mode: it needs no banner. Only if the site already has a consent
   manager and wants ids: add identity() from "@mirafive/sdk-browser/identity", pass mode: "full",
   and call useMira().consent({ statistics }) from its callback.
5. Verify: load a page (not localhost, or pass trackLocalhost: true) and check the network tab for
   POST https://collect.mirafive.io/v1/batch/<key> answering 202; report what you changed.
Do not add other analytics libraries, cookies or consent banners.
```

Facts for agents:

- Imports: `import { MiraProvider, useMira, useTrackOnMount } from "@mirafive/sdk-react"`.
  The client comes from `createMira` in `@mirafive/sdk-browser`; plugins from its
  subpaths (`/pageviews`, `/identity`, `/autocapture`, `/search`). No default exports.
- Env vars: the public website key per bundler (`VITE_MIRAFIVE_KEY`,
  `NEXT_PUBLIC_MIRAFIVE_KEY`, `PUBLIC_MIRAFIVE_KEY`), `MIRAFIVE_HOST` (optional, default
  `https://collect.mirafive.io`). `MIRAFIVE_SECRET_KEY` is for server code only
  (`@mirafive/sdk-server`) and must never be imported into a component.
- Never ship `MIRAFIVE_SECRET_KEY` to a browser bundle; a secret key in a browser is
  refused and marked exposed.
- `mode: "full"` needs `identity()`.
- Server rendering: `client={undefined}` on the server.
- Nothing throws for transport reasons; failures are dropped with a `[mirafive] …`
  console warning on local hosts only.
- Verify an install: the network tab shows `POST …/v1/batch/{key}` answering `202`
  with `"accepted": n`; the event then appears in the source's live view.
- Wire contract: [mirafive/protocol](https://github.com/mirafive/protocol).

## License

[MIT](LICENSE) © 2026 Cloo GmbH

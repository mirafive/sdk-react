# @mirafive/sdk-react

React bindings for the MIRA FIVE browser SDK: a provider, feature-flag hooks that render
the same on the server and in hydration, and a mount tracker. Privacy-first analytics and
feature flags from MIRA FIVE, hosted in the EU.

## Size

| Import | min + gzip |
|---|---|
| `@mirafive/sdk-react` | 0.73 kB |

Measured with its peers (`react`, `@mirafive/sdk-browser`) external: this is what the
package adds on top of the browser SDK. What you do not import is not shipped
(`sideEffects: false`). No transport and no flag evaluator of its own: events and flags
come from `@mirafive/sdk-browser`.

## Install

```sh
npm install @mirafive/sdk-react @mirafive/sdk-browser
# or: bun add / pnpm add / yarn add
```

Peers: `react` ≥ 18.3 (18 and 19), `@mirafive/sdk-browser` ^0.5.0. ESM only. Using Next.js
or TanStack Start? Use [`@mirafive/sdk-next`](https://github.com/mirafive/sdk-next) or
[`@mirafive/sdk-tanstack`](https://github.com/mirafive/sdk-tanstack): they create the
client for you and add the server side.

## Quickstart

```tsx
// main.tsx: runs once, in the browser
import { createMira } from "@mirafive/sdk-browser"
import { flags } from "@mirafive/sdk-browser/flags"
import { pageviews } from "@mirafive/sdk-browser/pageviews"
import { MiraProvider, useFlag, useMira } from "@mirafive/sdk-react"
import { createRoot } from "react-dom/client"

const mira = createMira({
  key: import.meta.env.VITE_MIRAFIVE_KEY, // the source's website key, mf_…
  plugins: [pageviews(), flags()]
})

function Checkout() {
  const client = useMira()
  const newCheckout = useFlag("new-checkout", false)

  return (
    <button onClick={() => client.track("checkout_started", { plan: "pro" })}>
      {newCheckout === true ? "Buy now" : "Checkout"}
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

Verify it: open the app (not `localhost`, or pass `trackLocalhost: true`) and look for
`POST https://events.mirafive.io/v1/batch/mf_…` in the network tab answering `202`, then
for the pageview in the source's live view in MIRA FIVE.

### Server rendering

`createMira()` needs a browser, so a server render passes `client={undefined}`. Hand the
provider the flag answers your server rendered, and every flag hook returns exactly those
during the server render and during hydration, so both render the same markup:

```tsx
<MiraProvider client={typeof window === "undefined" ? undefined : mira} bootstrap={bootstrap}>
```

`bootstrap` is a `FlagBootstrap` object, or the `<script id="mirafive-flags">` block that
`UserFlags.bootstrap()` from `@mirafive/sdk-server/flags` returns. Render that block into
the page too, before the app's scripts, so the browser SDK starts from the same answers.
After hydration the hooks read the browser SDK and re-render when flags change.

## Consent & privacy

- Default mode: `consentless` (set on `createMira`). It stores nothing, sets no cookies,
  keeps no ids and needs no consent banner. `mode: "full"` adds an anonymous id, a session
  id and your user id, and needs the `identity()` plugin and a consent answer.
- Pass a consent answer with `useMira().consent(true)` or
  `useMira().consent({ statistics, experiments, targeting })` from your consent
  manager's callback. Before an answer nothing is stored.
- Do Not Track, Global Privacy Control, `window.__mirafive_ignore` and prerendering send
  nothing. The browser SDK enforces this; these bindings add no path around it.
- This package reads and stores nothing itself.

## API reference

- `<MiraProvider client={mira} bootstrap?={…}>`: makes the client available to the hooks.
  `client` is a `Mira` from `createMira()`, or `undefined` while rendering on a server.
  `bootstrap` is a `FlagBootstrap` or the bootstrap block string; hooks read only it
  during a server render and hydration.
- `useMira<Events>(): Mira<Events>`: the client. During a server render it is an inert
  stand-in: calls do nothing and reads return their fallback.
- `useFlag(key, fallback: string | boolean): string | boolean`: the variant, or
  `true`/`false` for an on/off flag. Counts an exposure where the browser SDK would.
- `useFlagConfig<T>(key, fallback: T): T`: the remote-config value of the flag's variant.
- `useTrackOnMount(name, properties?)`: tracks one event when the component mounts, with
  the properties of its first render. Sent once under StrictMode.
- `type MiraProviderProps`, `type FlagBootstrap`.

Every hook throws when no `<MiraProvider>` is above it.

## Framework / runtime notes

- Flag hooks use `useSyncExternalStore`: the server snapshot is the bootstrap, the
  browser snapshot is the SDK's answer, and they re-render on `onFlags`.
- A flag hook answers its fallback in the browser unless the client has the `flags()`
  plugin. With a bootstrap and no `flags()`, the value falls back right after hydration.
- Inline fallbacks (`useFlagConfig("limits", { max: 3 })`) are safe: the store compares
  the SDK's answer, never your fallback object.
- The module starts with `"use client"`, so it works from React Server Components setups
  as a client module.
- StrictMode: no double events (`useTrackOnMount` keeps its state in a ref), and one
  flag exposure per page load (the browser SDK deduplicates).

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Nothing arrives | Local hosts are off by default (`trackLocalhost: true`); Do Not Track or GPC is on; the host is wrong; the origin is not allowed on the source. |
| `403 secret_key_in_path` / `website_key_as_bearer` | The key kinds are swapped: browsers use the website key, servers the secret key. |
| `403 origin_not_allowed` | Add the site's origin to the source in MIRA FIVE. |
| A flag always returns its fallback | The client has no `flags()` plugin; the flag is not in this source's flags or not marked for the website; consent for experiments is missing; the document has not loaded yet. |
| Hydration mismatch on a flag | The server and the browser passed different `bootstrap` values, or none on one side. Pass the same one to both. |
| "render <MiraProvider> above hooks" | A hook runs outside the provider. |

## For AI agents

Copy-paste setup prompt:

```text
Add MIRA FIVE analytics and feature flags to this React app with @mirafive/sdk-react.
1. Install @mirafive/sdk-react and @mirafive/sdk-browser with the project's package manager.
   (Next.js: use @mirafive/sdk-next instead. TanStack Start: @mirafive/sdk-tanstack.)
2. Put the source's website key in the public env var of the bundler, e.g.
   VITE_MIRAFIVE_KEY for Vite. Never put MIRAFIVE_SECRET_KEY in browser code.
3. In the client entry (runs once, browser only):
     import { createMira } from "@mirafive/sdk-browser"
     import { pageviews } from "@mirafive/sdk-browser/pageviews"
     import { flags } from "@mirafive/sdk-browser/flags"
     import { MiraProvider } from "@mirafive/sdk-react"
     const mira = createMira({ key: import.meta.env.VITE_MIRAFIVE_KEY, plugins: [pageviews(), flags()] })
   and wrap the app in <MiraProvider client={mira}>. Read flags with
   useFlag(key, fallback) / useFlagConfig(key, fallback), track with useMira().track(name, props)
   or useTrackOnMount(name, props). Do not add router hooks for pageviews: pageviews() covers them.
4. Keep the default consentless mode: it needs no banner. Only if the site already has a consent
   manager and wants ids: add identity() from "@mirafive/sdk-browser/identity", pass mode: "full",
   and call useMira().consent({ statistics, experiments, targeting }) from its callback.
5. Verify: load a page (not localhost, or pass trackLocalhost: true) and check the network tab for
   POST https://events.mirafive.io/v1/batch/<key> answering 202; report what you changed.
Do not add other analytics libraries, cookies or consent banners.
```

Facts for agents:

- Imports: `import { MiraProvider, useMira, useFlag, useFlagConfig, useTrackOnMount } from "@mirafive/sdk-react"`.
  The client comes from `createMira` in `@mirafive/sdk-browser`; plugins from its
  subpaths (`/pageviews`, `/flags`, `/identity`, `/autocapture`, `/search`,
  `/experiments`). No default exports.
- Env vars: the public website key per bundler (`VITE_MIRAFIVE_KEY`,
  `NEXT_PUBLIC_MIRAFIVE_KEY`, `PUBLIC_MIRAFIVE_KEY`), `MIRAFIVE_HOST` (optional, default
  `https://events.mirafive.io`). `MIRAFIVE_SECRET_KEY` is for server code only
  (`@mirafive/sdk-server`) and must never be imported into a component.
- Never ship `MIRAFIVE_SECRET_KEY` to a browser bundle; a secret key in a browser is
  refused and marked exposed.
- Flag hooks need the `flags()` plugin on the client; `mode: "full"` needs `identity()`.
- Server rendering: `client={undefined}` on the server and the same `bootstrap` on both
  sides, or flag hooks show fallbacks until hydration ends.
- Nothing throws for transport reasons; failures are dropped with a `[mirafive] …`
  console warning on local hosts only.
- Verify an install: the network tab shows `POST …/v1/batch/{key}` answering `202`
  with `"accepted": n`; the event then appears in the source's live view.
- Wire contract: [mirafive/protocol](https://github.com/mirafive/protocol).

## License

[MIT](LICENSE) © 2026 Cloo GmbH

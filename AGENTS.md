# Agents working in mirafive/sdk-react

`@mirafive/sdk-react`: React bindings (provider, flag hooks, mount tracker) over
`@mirafive/sdk-browser`. Part of the MIRA FIVE SDK family; the wire contract, flag
semantics and public API live in [mirafive/protocol](https://github.com/mirafive/protocol)
(PROTOCOL.md, FLAGS.md, API.md).

## Commands

```sh
bun install --frozen-lockfile
bun run check            # format, lint, typecheck, test, build, publint, attw, size-limit
bun run test             # vitest (happy-dom, @testing-library/react, react-dom/server)
bun run size             # size-limit against the limit in package.json (peers external)
```

## Local dependencies

`@mirafive/sdk-browser` is a `file:../sdk-browser` devDependency plus an `overrides` entry
until it is published; the peer range stays `^0.5.0`. Build `../sdk-browser` first if its
`dist/` is missing. Once 0.5.0 is on npm, switch the devDependency to `^0.5.0` and drop
`overrides`.

## Rules

- API.md is the contract for this package's public surface. Do not add, rename or
  remove exports without changing API.md first.
- Thin by design: no transport, no flag evaluator, no router integration. Everything goes
  through the `Mira` client; pageviews come from sdk-browser's `pageviews()` plugin.
- Server render and hydration read only the `bootstrap` prop, never the client or the DOM;
  otherwise the two renders can differ. `test/react.test.tsx` hydrates real server markup.
- `"use client"` must stay the first line of `dist/index.js`.
- Bundle size is the headline goal: ≤ 1.0 kB min + gzip with peers external. No runtime
  dependencies.
- `sideEffects: false` must stay true.
- A secret key never reaches browser code.
- Comments only for a non-obvious constraint, one or two lines.
- Do not run git write commands unless asked; the maintainer commits.

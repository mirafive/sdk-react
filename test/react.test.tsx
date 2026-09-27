import { createMira, type Mira } from "@mirafive/sdk-browser"
import { flags } from "@mirafive/sdk-browser/flags"
import { act, cleanup, render } from "@testing-library/react"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MiraProvider, useFlag, useFlagConfig, useMira, useTrackOnMount } from "../src/index.ts"

const KEY = "mf_ab12cd34_0123456789abcdefghijklmnop"
const w = window as unknown as Window & { happyDOM: { setURL(url: string): void }; __mirafive_boot?: unknown }

// A block as UserFlags.bootstrap() writes it, escapes included.
const blockHtml = (at: number): string =>
  `<script type="application/json" id="mirafive-flags">${JSON.stringify({
    v: 1,
    at,
    values: { "new-checkout": ["on"], pricing: ["b", { price: 12, note: "<b>" }], hero: ["bold"] }
  }).replace(
    /[<>&]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`
  )}</script>`

const Checkout = (): React.ReactElement => {
  const on = useFlag("new-checkout", false)
  const hero = useFlag("hero", "plain")
  const { price } = useFlagConfig("pricing", { price: 10 })

  return (
    <p>
      {String(on)} {hero} {price}
    </p>
  )
}

const clients: Mira[] = []
const fetchMock = vi.fn<typeof fetch>()

const browserClient = (): Mira => {
  const client = createMira({ key: KEY, plugins: [flags()] })

  clients.push(client)
  return client
}

beforeEach(() => {
  w.happyDOM.setURL("https://shop.example/checkout")
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.destroy())
  document.body.innerHTML = ""
  fetchMock.mockReset()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("server render and hydration", () => {
  it("renders the bootstrap on the server and hydrates to the same markup", async () => {
    const block = blockHtml(Date.now())
    const html = renderToString(
      <MiraProvider client={undefined} bootstrap={block}>
        <Checkout />
      </MiraProvider>
    )

    expect(html).toContain("true<!-- --> <!-- -->bold<!-- --> <!-- -->12")

    document.body.innerHTML = `${block}<div id="root">${html}</div>`

    const root = document.getElementById("root")!
    const recoverable = vi.fn()
    const errors = vi.spyOn(console, "error")
    const client = browserClient()

    await act(async () => {
      hydrateRoot(
        root,
        <MiraProvider client={client} bootstrap={block}>
          <Checkout />
        </MiraProvider>,
        { onRecoverableError: recoverable }
      )
    })

    expect(recoverable).not.toHaveBeenCalled()
    expect(errors).not.toHaveBeenCalled()
    expect(root.textContent).toBe("true bold 12")
    // The block is fresh: the browser SDK answers from it without fetching.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("hydrates with the bootstrap, then re-renders when the browser loads newer flags", async () => {
    const block = blockHtml(Date.now() - 120_000)
    const answer = Promise.withResolvers<Response>()

    fetchMock.mockReturnValue(answer.promise)

    const html = renderToString(
      <MiraProvider client={undefined} bootstrap={block}>
        <Checkout />
      </MiraProvider>
    )

    document.body.innerHTML = `${block}<div id="root">${html}</div>`

    const root = document.getElementById("root")!
    const recoverable = vi.fn()

    await act(async () => {
      hydrateRoot(
        root,
        <MiraProvider client={browserClient()} bootstrap={block}>
          <Checkout />
        </MiraProvider>,
        { onRecoverableError: recoverable }
      )
    })

    expect(root.textContent).toBe("true bold 12")
    expect(fetchMock.mock.calls[0]?.[0] as string).toBe(
      `https://events.mirafive.io/v1/flags/${KEY}?view=values`
    )

    await act(async () => {
      answer.resolve(
        Response.json({
          v: 1,
          at: Date.now(),
          values: { "new-checkout": ["off"], pricing: ["a", { price: 9 }], hero: ["calm"] }
        })
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(recoverable).not.toHaveBeenCalled()
    expect(root.textContent).toBe("false calm 9")
  })

  it("answers fallbacks without a bootstrap and gives an inert client on the server", () => {
    let read: unknown
    const Reader = (): null => {
      const mira = useMira()

      mira.track("rendered")
      read = mira.flag("anything", "fallback")
      return null
    }

    const html = renderToString(
      <MiraProvider client={undefined}>
        <Checkout />
        <Reader />
      </MiraProvider>
    )

    expect(html).toContain("false<!-- --> <!-- -->plain<!-- --> <!-- -->10")
    expect(read).toBe("fallback")
  })

  it("accepts a bootstrap object", () => {
    const html = renderToString(
      <MiraProvider
        client={undefined}
        bootstrap={{ v: 1, at: Date.now(), values: { "new-checkout": ["off"] } }}
      >
        <Checkout />
      </MiraProvider>
    )

    expect(html).toContain("false")
  })
})

const fake = () => {
  const listeners = new Set<() => void>()
  const values: Record<string, string | boolean> = {}
  const client = {
    track: vi.fn(),
    flag: (key: string, fallback: unknown) => values[key] ?? fallback,
    config: (_key: string, fallback: unknown) => fallback,
    onFlags: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }

  return {
    client: client as unknown as Mira,
    track: client.track,
    listeners,
    set: (key: string, value: string | boolean) => {
      values[key] = value
      listeners.forEach((listener) => listener())
    }
  }
}

const Page = ({ step }: { step: number }): null => {
  useTrackOnMount("checkout_viewed", { step })
  return null
}

describe("bootstrap age and identity", () => {
  it("ignores a bootstrap older than 7 days, as the browser SDK does", () => {
    const html = renderToString(
      <MiraProvider client={undefined} bootstrap={blockHtml(Date.now() - 8 * 86_400_000)}>
        <Checkout />
      </MiraProvider>
    )

    expect(html).toContain("false<!-- --> <!-- -->plain<!-- --> <!-- -->10")
  })

  it("does not re-render after hydration when the browser's config equals the bootstrap's", async () => {
    const block = blockHtml(Date.now())
    let renders = 0
    const Pricing = (): React.ReactElement => {
      renders += 1
      return <b>{useFlagConfig("pricing", { price: 10 }).price}</b>
    }
    const html = renderToString(
      <MiraProvider client={undefined} bootstrap={block}>
        <Pricing />
      </MiraProvider>
    )

    document.body.innerHTML = `${block}<div id="root">${html}</div>`
    renders = 0

    const root = document.getElementById("root")!

    await act(async () => {
      hydrateRoot(
        root,
        <MiraProvider client={browserClient()} bootstrap={block}>
          <Pricing />
        </MiraProvider>
      )
    })

    expect(root.textContent).toBe("12")
    expect(renders).toBe(1)
  })

  it("gives an inert client whose onFlags and flush behave like sdk-browser's stubs", async () => {
    let client: Mira | undefined
    const Reader = (): null => {
      client = useMira()
      return null
    }

    renderToString(
      <MiraProvider client={undefined}>
        <Reader />
      </MiraProvider>
    )

    const unsubscribe = client!.onFlags(() => {})

    expect(typeof unsubscribe).toBe("function")
    expect(() => unsubscribe()).not.toThrow()
    await expect(client!.flush()).resolves.toBeUndefined()
    expect(client!.config("limits", { max: 3 })).toEqual({ max: 3 })
  })
})

describe("in the browser", () => {
  it("re-renders when flags change and unsubscribes on unmount", () => {
    const { client, set, listeners } = fake()
    const view = render(
      <MiraProvider client={client}>
        <Checkout />
      </MiraProvider>
    )

    expect(view.container.textContent).toBe("false plain 10")

    act(() => set("new-checkout", true))
    expect(view.container.textContent).toBe("true plain 10")

    view.unmount()
    expect(listeners.size).toBe(0)
  })

  it("keeps an inline config fallback without re-rendering forever", () => {
    let renders = 0
    const Config = (): React.ReactElement => {
      renders += 1
      return <b>{useFlagConfig("limits", { max: 3 }).max}</b>
    }

    const view = render(
      <MiraProvider client={browserClient()}>
        <Config />
      </MiraProvider>
    )

    expect(view.container.textContent).toBe("3")
    expect(renders).toBeLessThan(4)
  })

  it("tracks on mount once under StrictMode", () => {
    const { client, track } = fake()
    const view = render(
      <StrictMode>
        <MiraProvider client={client}>
          <Page step={1} />
        </MiraProvider>
      </StrictMode>
    )

    view.rerender(
      <StrictMode>
        <MiraProvider client={client}>
          <Page step={2} />
        </MiraProvider>
      </StrictMode>
    )

    expect(track).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith("checkout_viewed", { step: 1 })
  })

  it("returns the client from useMira", () => {
    const { client } = fake()
    let seen: unknown
    const Reader = (): null => {
      seen = useMira()
      return null
    }

    render(
      <MiraProvider client={client}>
        <Reader />
      </MiraProvider>
    )

    expect(seen).toBe(client)
  })

  it("throws outside a provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    expect(() => render(<Checkout />)).toThrow("<MiraProvider>")
  })
})

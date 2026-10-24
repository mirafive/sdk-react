import type { Mira } from "@mirafive/sdk-browser"
import { act, cleanup, render } from "@testing-library/react"
import { StrictMode } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

import { MiraProvider, useMira, useTrackOnMount } from "../src/index.ts"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const fake = () => {
  const client = { track: vi.fn() }

  return { client: client as unknown as Mira, track: client.track }
}

const Page = ({ step }: { step: number }): null => {
  useTrackOnMount("checkout_viewed", { step })
  return null
}

describe("server render", () => {
  it("gives an inert client whose calls do nothing and whose flush resolves", async () => {
    let client: Mira | undefined
    const Reader = (): null => {
      client = useMira()
      client.track("rendered")
      return null
    }

    renderToString(
      <MiraProvider client={undefined}>
        <Reader />
      </MiraProvider>
    )

    await expect(client!.flush()).resolves.toBeUndefined()
  })

  it("does not track on mount without a client", () => {
    expect(() =>
      renderToString(
        <MiraProvider client={undefined}>
          <Page step={1} />
        </MiraProvider>
      )
    ).not.toThrow()
  })
})

describe("in the browser", () => {
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

  it("tracks when the client arrives after the first render", () => {
    const { client, track } = fake()
    const view = render(
      <MiraProvider client={undefined}>
        <Page step={1} />
      </MiraProvider>
    )

    expect(track).not.toHaveBeenCalled()

    act(() =>
      view.rerender(
        <MiraProvider client={client}>
          <Page step={1} />
        </MiraProvider>
      )
    )

    expect(track).toHaveBeenCalledTimes(1)
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

    expect(() => render(<Page step={1} />)).toThrow("<MiraProvider>")
  })
})

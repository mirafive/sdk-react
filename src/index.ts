"use client"

import type { EventMap, FlagBootstrap, Json, Mira, Properties } from "@mirafive/sdk-browser"
import {
  createContext,
  createElement,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore
} from "react"

export type { FlagBootstrap } from "@mirafive/sdk-browser"

export interface MiraProviderProps {
  /** The client from `createMira()`; `undefined` while rendering on a server. */
  // oxlint-disable-next-line typescript/no-explicit-any -- a client of any event map
  client: Mira<any> | undefined
  /**
   * The flag answers the server rendered: a `FlagBootstrap`, or the block `UserFlags.bootstrap()`
   * returns. Hooks read only this during the server render and hydration, so both match.
   */
  bootstrap?: FlagBootstrap | string | undefined
  children?: ReactNode
}

interface Store {
  client: Mira | undefined
  values: FlagBootstrap["values"] | undefined
}

const Context = createContext<Store | undefined>(undefined)

// Stands in for the fallback inside the store, so a fallback written inline never breaks snapshot identity.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a sentinel no answer can equal
const none = {} as never
const noop = (): void => {}

// Answers like a client without plugins: calls do nothing and reads return their fallback.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- every member is the same stub
const inert = new Proxy({} as Mira, {
  get: (_, name) => (name === "then" ? undefined : (...args: unknown[]) => args[1])
})

const valuesOf = (bootstrap: MiraProviderProps["bootstrap"]): Store["values"] => {
  try {
    const parsed: FlagBootstrap | undefined =
      typeof bootstrap === "string" ? JSON.parse(bootstrap.replace(/^[^{]*|[^}]*$/g, "")) : bootstrap

    return parsed?.v === 1 ? parsed.values : undefined
  } catch {
    return undefined
  }
}

export const MiraProvider = ({ client, bootstrap, children }: MiraProviderProps): ReactElement => {
  const values = useMemo(() => valuesOf(bootstrap), [bootstrap])
  const store = useMemo(() => ({ client, values }), [client, values])

  return createElement(Context.Provider, { value: store }, children)
}

const useStore = (): Store => {
  const store = useContext(Context)

  if (!store) {
    throw new Error("[mirafive] render <MiraProvider> above hooks from @mirafive/sdk-react")
  }

  return store
}

/** The client. While rendering on a server it is an inert stand-in whose calls do nothing. */
export const useMira = <Events extends EventMap = EventMap>(): Mira<Events> => useStore().client ?? inert

const useAnswer = (key: string, config: boolean): unknown => {
  const { client, values } = useStore()
  const subscribe = useCallback((listener: () => void) => client?.onFlags(listener) ?? noop, [client])

  const rendered = (): unknown => {
    const answer = values?.[key]

    return !answer
      ? none
      : config
        ? (answer[1] ?? none)
        : answer[0] === "on" || (answer[0] !== "off" && answer[0])
  }

  return useSyncExternalStore(
    subscribe,
    () => (client ? (config ? client.config(key, none) : client.flag(key, none)) : rendered()),
    rendered
  )
}

/** The variant, or `true`/`false` for an on/off flag. `fallback` until flags are known. */
export const useFlag = (key: string, fallback: string | boolean): string | boolean => {
  const answer = useAnswer(key, false)

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a flag answer is a variant or a boolean
  return answer === none ? fallback : (answer as string | boolean)
}

/** The remote-config value of the flag's variant, or `fallback`. */
export const useFlagConfig = <T = Json>(key: string, fallback: T): T => {
  const answer = useAnswer(key, true)

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the caller names the config's type
  return answer === none ? fallback : (answer as T)
}

/** Tracks one event when the component mounts, with the properties of its first render. */
export const useTrackOnMount = (name: string, properties?: Properties): void => {
  const { client } = useStore()
  const pending = useRef<{ name: string; properties: Properties | undefined } | undefined>({
    name,
    properties
  })

  // StrictMode runs this twice on one mount; the ref survives, so the event is sent once.
  useEffect(() => {
    if (client && pending.current) {
      client.track(pending.current.name, pending.current.properties)
      pending.current = undefined
    }
  }, [client])
}

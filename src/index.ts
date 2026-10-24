"use client"

import type { EventMap, Mira, Properties } from "@mirafive/sdk-browser"
import {
  createContext,
  createElement,
  type ReactElement,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef
} from "react"

export interface MiraProviderProps {
  /** The client from `createMira()`; `undefined` while rendering on a server. */
  // oxlint-disable-next-line typescript/no-explicit-any -- a client of any event map
  client: Mira<any> | undefined
  children?: ReactNode
}

interface Store {
  client: Mira | undefined
}

const Context = createContext<Store | undefined>(undefined)

// Answers like sdk-browser's stubs for missing plugins: calls do nothing, reads return their fallback.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- every member is a stub
const inert = new Proxy({} as Mira, {
  get: (_, name) =>
    name === "then" ? undefined : name === "flush" ? () => Promise.resolve() : (...args: unknown[]) => args[1]
})

export const MiraProvider = ({ client, children }: MiraProviderProps): ReactElement => {
  const store = useMemo(() => ({ client }), [client])

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

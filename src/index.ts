"use client";
import {
  createMira,
  createNoopMira,
  type EventMap,
  type Mira,
  type MiraOptions,
} from "@mirafive/web";
/**
 * `@mirafive/react`: MIRA FIVE for React. One provider and a few hooks; everything else is
 * `@mirafive/web`, which follows the consent banner and captures pageviews on its own.
 *
 * ```tsx
 * <MiraProvider publicKey="mira_pk_…">
 *   <App />
 * </MiraProvider>
 *
 * const mira = useMira();
 * mira.track("signup_started", { plan: "pro" });
 * ```
 */
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";

export type {
  AutocaptureOptions,
  ConsentChoice,
  EventMap,
  IdentifyOptions,
  Mira,
  MiraOptions,
  SurveyInput,
} from "@mirafive/web";

// oxlint-disable-next-line typescript/no-explicit-any -- a client of any event map
type AnyMira = Mira<any>;

const Context = createContext<AnyMira | undefined>(undefined);
const noop = createNoopMira();
const warned = new Set<string>();

/** Configuration mistakes are worth one line each in the console, never a crash. */
export function warnOnce(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(`MIRA FIVE: ${message}`);
}

let shared: { client: AnyMira; key: string } | undefined;

/**
 * The page's one client, created on first use in the browser. StrictMode, remounts and several
 * providers all get the same instance, so nothing is counted twice.
 */
export function sharedMira<Events extends EventMap = EventMap>(options: MiraOptions): Mira<Events> {
  if (shared) {
    if (shared.key !== options.key) {
      warnOnce("the public key changed after the client was created; the first key stays");
    }
    return shared.client as Mira<Events>;
  }
  const client = createMira<Events>(options);
  shared = { client, key: options.key };
  return client;
}

/** `key` is reserved by React, so the provider takes the public key as `publicKey`. */
export interface MiraProviderProps extends Omit<Partial<MiraOptions>, "key"> {
  /** The project's public key (`mira_pk_…`). */
  publicKey?: string;
  /** A client you made with `createMira()`. Without it, one is made from the other props. */
  client?: AnyMira;
  children?: ReactNode;
}

/**
 * Makes the client available to `useMira()`. Renders on a server without doing anything there;
 * the client starts in the browser.
 */
export function MiraProvider({
  client,
  publicKey,
  children,
  ...options
}: MiraProviderProps): ReactElement {
  let value = client;
  if (!value && typeof window !== "undefined") {
    if (publicKey) value = sharedMira({ ...options, key: publicKey });
    else warnOnce("no public key: pass publicKey (mira_pk_…) to <MiraProvider>. Nothing is sent.");
  }
  return createElement(Context.Provider, { value }, children);
}

/**
 * The client. On a server, or without a provider, a stand-in whose calls do nothing, so
 * components never need a guard.
 */
export function useMira<Events extends EventMap = EventMap>(): Mira<Events> {
  const client = useContext(Context);
  if (!client && typeof window !== "undefined") {
    warnOnce("useMira() is used outside <MiraProvider>; its calls do nothing");
  }
  return (client ?? noop) as Mira<Events>;
}

/**
 * Tracks one event when the component mounts, with the properties of its first render. Sent
 * once per mount, also under StrictMode.
 */
export function useTrackOnMount<
  Events extends EventMap = EventMap,
  Name extends keyof Events & string = keyof Events & string,
>(name: Name, properties?: Events[Name]): void {
  const mira = useMira<Events>();
  const pending = useRef<{ name: Name; properties?: Events[Name] } | undefined>({
    name,
    properties,
  });
  useEffect(() => {
    if (!pending.current) return;
    mira.track(pending.current.name, pending.current.properties);
    pending.current = undefined;
  }, [mira]);
}

/**
 * Keeps MIRA FIVE in step with your auth state: identifies when a user signs in (or the id
 * changes) and resets when they sign out, so the next person on a shared device starts fresh.
 *
 * ```tsx
 * useIdentify(session?.user.id, { plan: session?.user.plan });
 * ```
 */
export function useIdentify(
  userId: string | null | undefined,
  traits?: Record<string, unknown>,
): void {
  const mira = useMira();
  const last = useRef<string | undefined>(undefined);
  const latestTraits = useRef(traits);
  // Effects run in order: the identify below always sees this render's traits.
  useEffect(() => {
    latestTraits.current = traits;
  });
  useEffect(() => {
    const id = userId ?? undefined;
    if (id === last.current) return;
    if (id) mira.identify(id, latestTraits.current);
    else if (last.current) mira.reset();
    last.current = id;
  }, [mira, userId]);
}

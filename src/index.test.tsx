import { describe, expect, spyOn, test } from "bun:test";

import { renderToString } from "react-dom/server";

import { MiraProvider, useIdentify, useMira, useTrackOnMount } from "./index";

function Page() {
  const mira = useMira<{ signup_started: { plan: "pro" } }>();
  mira.track("signup_started", { plan: "pro" });
  useTrackOnMount("viewed_page");
  useIdentify("user_1", { plan: "pro" });
  return <p>{mira.anonymousId ?? "no id"}</p>;
}

describe("server rendering", () => {
  test("renders with a provider and gives a client that does nothing", () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    const html = renderToString(
      <MiraProvider publicKey="mira_pk_test">
        <Page />
      </MiraProvider>,
    );
    expect(html).toBe("<p>no id</p>");
    // No window: no client, and nothing worth a warning.
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test("renders without a provider too", () => {
    expect(renderToString(<Page />)).toBe("<p>no id</p>");
  });

  test("passes a client made by the app through", () => {
    const calls: string[] = [];
    const client = { ...createRecorder(calls) };
    function Track() {
      useMira().track("from_render");
      return null;
    }
    renderToString(
      <MiraProvider client={client}>
        <Track />
      </MiraProvider>,
    );
    expect(calls).toEqual(["from_render"]);
  });
});

function createRecorder(calls: string[]) {
  const nothing = () => {};
  return {
    init: nothing,
    page: nothing,
    track: (name: string) => void calls.push(name),
    survey: nothing,
    identify: nothing,
    group: nothing,
    consent: nothing,
    setLocation: nothing,
    reset: nothing,
    flush: () => Promise.resolve(),
    status: { analytics: "unknown", marketing: "unknown" } as const,
    anonymousId: undefined,
  };
}

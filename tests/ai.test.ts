import { afterEach, describe, expect, it, vi } from "vitest";

import { AI_MODEL, draftWithClaude } from "@/lib/ai";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("draftWithClaude", () => {
  it("does not call out without a key", async () => {
    vi.stubEnv("AI_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await draftWithClaude({ system: "s", prompt: "p" })).toEqual({ ok: false, reason: "no-key" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts a Messages API request and returns the text", async () => {
    const fetchSpy = vi.fn(async () =>
      reply({
        model: AI_MODEL,
        stop_reason: "end_turn",
        content: [
          { type: "thinking", thinking: "" },
          { type: "text", text: "First line [ClinVar]." },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const result = await draftWithClaude({ system: "the system", prompt: "the case", apiKey: "test-key" });
    expect(result).toEqual({ ok: true, text: "First line [ClinVar].", model: AI_MODEL });

    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "x-api-key": "test-key",
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "server-side-fallback-2026-07-01",
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "claude-opus-5",
      output_config: { effort: "low" },
      fallbacks: "default",
      system: "the system",
      messages: [{ role: "user", content: "the case" }],
    });
  });

  it("treats a refusal, an error status and an empty reply as failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply({ stop_reason: "refusal", content: [] })));
    expect(await draftWithClaude({ system: "s", prompt: "p", apiKey: "k" })).toEqual({ ok: false, reason: "refusal" });

    vi.stubGlobal("fetch", vi.fn(async () => reply({ error: { type: "overloaded_error" } }, 529)));
    expect(await draftWithClaude({ system: "s", prompt: "p", apiKey: "k" })).toEqual({ ok: false, reason: "error" });

    vi.stubGlobal("fetch", vi.fn(async () => reply({ stop_reason: "end_turn", content: [] })));
    expect(await draftWithClaude({ system: "s", prompt: "p", apiKey: "k" })).toEqual({ ok: false, reason: "empty" });
  });

  it("gives up when the model is slower than the timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
          }),
      ),
    );
    const result = await draftWithClaude({ system: "s", prompt: "p", apiKey: "k", timeoutMs: 20 });
    expect(result).toEqual({ ok: false, reason: "timeout" });
  });

  it("never throws, even when the network fails outright", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("fetch failed");
    }));
    expect(await draftWithClaude({ system: "s", prompt: "p", apiKey: "k" })).toEqual({ ok: false, reason: "error" });
  });
});

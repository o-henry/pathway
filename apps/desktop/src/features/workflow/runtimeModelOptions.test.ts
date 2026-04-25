import { describe, expect, it } from "vitest";
import { findRuntimeModelOption, RUNTIME_MODEL_OPTIONS } from "./runtimeModelOptions";

describe("runtimeModelOptions", () => {
  it("exposes only Codex GPT-5.5 in the shared model menu options", () => {
    expect(RUNTIME_MODEL_OPTIONS).toEqual([
      {
        value: "GPT-5.5",
        label: "GPT-5.5",
        allowsReasonLevel: true,
        executor: "codex",
        turnModel: "GPT-5.5",
      },
    ]);
  });

  it("falls back to Codex GPT-5.5 for removed runtime labels", () => {
    expect(findRuntimeModelOption("WEB / STEEL")).toMatchObject({
      label: "GPT-5.5",
      executor: "codex",
      turnModel: "GPT-5.5",
      allowsReasonLevel: true,
    });
  });
});

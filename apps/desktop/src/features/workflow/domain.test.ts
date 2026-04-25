import { describe, expect, it } from "vitest";
import { DEFAULT_TURN_MODEL, toTurnModelDisplayName, toTurnModelEngineId } from "./domain";

describe("workflow model defaults", () => {
  it("defaults new turn nodes to GPT-5.5", () => {
    expect(DEFAULT_TURN_MODEL).toBe("GPT-5.5");
  });

  it("maps GPT-5.5 display names to the real engine id while keeping GPT-5.5 as the default", () => {
    expect(toTurnModelDisplayName("gpt-5.5")).toBe("GPT-5.5");
    expect(toTurnModelEngineId("GPT-5.5")).toBe("gpt-5.5");
  });
});

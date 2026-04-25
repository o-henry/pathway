import type { TurnExecutor } from "./domain";

export type RuntimeModelOption = {
  value: string;
  label: string;
  allowsReasonLevel: boolean;
  executor: TurnExecutor;
  turnModel?: string;
};

export const RUNTIME_MODEL_OPTIONS: ReadonlyArray<RuntimeModelOption> = [
  {
    value: "GPT-5.5",
    label: "GPT-5.5",
    allowsReasonLevel: true,
    executor: "codex",
    turnModel: "GPT-5.5",
  },
];

export const DEFAULT_RUNTIME_MODEL_VALUE = RUNTIME_MODEL_OPTIONS[0].value;

export function findRuntimeModelOption(value: string): RuntimeModelOption {
  return RUNTIME_MODEL_OPTIONS.find((option) => option.value === value) ?? RUNTIME_MODEL_OPTIONS[0];
}

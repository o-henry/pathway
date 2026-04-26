from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

from lifemap_api.config import Settings
from lifemap_api.infrastructure.llm_providers import CodexCliProvider


def test_codex_provider_enables_web_search_by_default(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_run(command, *, input, text, capture_output, timeout, check):  # noqa: ANN001
        del input, text, capture_output, timeout, check
        captured["command"] = command
        output_path = Path(command[command.index("--output-last-message") + 1])
        output_path.write_text(json.dumps({"ok": True}), encoding="utf-8")
        return SimpleNamespace(returncode=0, stdout="", stderr="")

    monkeypatch.setattr("subprocess.run", fake_run)
    provider = CodexCliProvider(Settings())

    result = provider.generate_structured_json(
        messages=[{"role": "user", "content": "return ok"}],
        json_schema={
            "type": "object",
            "properties": {"ok": {"type": "boolean"}},
            "required": ["ok"],
        },
        schema_name="test_schema",
    )

    assert json.loads(result) == {"ok": True}
    command = captured["command"]
    assert isinstance(command, list)
    assert "--search" in command
    assert command[0:3] == ["codex", "--search", "exec"]


def test_codex_provider_can_disable_web_search(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_run(command, *, input, text, capture_output, timeout, check):  # noqa: ANN001
        del input, text, capture_output, timeout, check
        captured["command"] = command
        output_path = Path(command[command.index("--output-last-message") + 1])
        output_path.write_text(json.dumps({"ok": True}), encoding="utf-8")
        return SimpleNamespace(returncode=0, stdout="", stderr="")

    monkeypatch.setattr("subprocess.run", fake_run)
    provider = CodexCliProvider(
        Settings(LIFEMAP_CODEX_WEB_SEARCH_ENABLED=False)
    )

    provider.generate_structured_json(
        messages=[{"role": "user", "content": "return ok"}],
        json_schema={
            "type": "object",
            "properties": {"ok": {"type": "boolean"}},
            "required": ["ok"],
        },
        schema_name="test_schema",
    )

    command = captured["command"]
    assert isinstance(command, list)
    assert "--search" not in command

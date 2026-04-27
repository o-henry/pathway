from __future__ import annotations

import json
import os
from pathlib import Path
from types import SimpleNamespace

from lifemap_api.config import Settings
from lifemap_api.infrastructure.llm_providers import CodexCliProvider


def test_codex_provider_enables_web_search_by_default(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_run(command, *, input, text, capture_output, env, timeout, check):  # noqa: ANN001
        del input, text, capture_output, check
        captured["command"] = command
        captured["env"] = env
        captured["timeout"] = timeout
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
    assert isinstance(captured["env"], dict)
    assert captured["timeout"] == 180.0


def test_codex_provider_can_disable_web_search(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_run(command, *, input, text, capture_output, env, timeout, check):  # noqa: ANN001
        del input, text, capture_output, check
        captured["command"] = command
        captured["env"] = env
        captured["timeout"] = timeout
        output_path = Path(command[command.index("--output-last-message") + 1])
        output_path.write_text(json.dumps({"ok": True}), encoding="utf-8")
        return SimpleNamespace(returncode=0, stdout="", stderr="")

    monkeypatch.setattr("subprocess.run", fake_run)
    provider = CodexCliProvider(Settings(LIFEMAP_CODEX_WEB_SEARCH_ENABLED=False))

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
    assert command[0:2] == ["codex", "exec"]
    assert captured["timeout"] == 180.0


def test_codex_provider_disables_web_search_for_goal_intake(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_run(command, *, input, text, capture_output, env, timeout, check):  # noqa: ANN001
        del input, text, capture_output, check
        captured["command"] = command
        captured["env"] = env
        captured["timeout"] = timeout
        output_path = Path(command[command.index("--output-last-message") + 1])
        output_path.write_text(json.dumps({"ok": True}), encoding="utf-8")
        return SimpleNamespace(returncode=0, stdout="", stderr="")

    monkeypatch.setattr("subprocess.run", fake_run)
    provider = CodexCliProvider(Settings())

    provider.generate_structured_json(
        messages=[{"role": "user", "content": "return ok"}],
        json_schema={
            "type": "object",
            "properties": {"ok": {"type": "boolean"}},
            "required": ["ok"],
        },
        schema_name="pathway_goal_analysis",
    )

    command = captured["command"]
    assert isinstance(command, list)
    assert "--search" not in command
    assert command[0:2] == ["codex", "exec"]
    assert captured["timeout"] == 180.0


def test_codex_provider_does_not_cut_off_graph_bundle_generation(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_run(command, *, input, text, capture_output, env, timeout, check):  # noqa: ANN001
        del input, text, capture_output, check
        captured["command"] = command
        captured["env"] = env
        captured["timeout"] = timeout
        output_path = Path(command[command.index("--output-last-message") + 1])
        output_path.write_text(json.dumps({"ok": True}), encoding="utf-8")
        return SimpleNamespace(returncode=0, stdout="", stderr="")

    monkeypatch.setattr("subprocess.run", fake_run)
    provider = CodexCliProvider(Settings())

    provider.generate_structured_json(
        messages=[{"role": "user", "content": "return ok"}],
        json_schema={
            "type": "object",
            "properties": {"ok": {"type": "boolean"}},
            "required": ["ok"],
        },
        schema_name="life_map_graph_bundle",
    )

    command = captured["command"]
    assert isinstance(command, list)
    assert "--search" in command
    assert captured["timeout"] is None


def test_codex_provider_augments_subprocess_path_with_local_node_bins(
    monkeypatch,
    tmp_path: Path,
) -> None:
    captured: dict[str, object] = {}
    nvm_bin = tmp_path / ".nvm" / "versions" / "node" / "v99.0.0" / "bin"
    nvm_bin.mkdir(parents=True)
    (nvm_bin / "codex").write_text("#!/bin/sh\n", encoding="utf-8")

    def fake_run(command, *, input, text, capture_output, env, timeout, check):  # noqa: ANN001
        del input, text, capture_output, timeout, check
        captured["command"] = command
        captured["env"] = env
        output_path = Path(command[command.index("--output-last-message") + 1])
        output_path.write_text(json.dumps({"ok": True}), encoding="utf-8")
        return SimpleNamespace(returncode=0, stdout="", stderr="")

    monkeypatch.setattr("subprocess.run", fake_run)
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.setenv("PATH", "/usr/bin")

    provider = CodexCliProvider(Settings())
    provider.generate_structured_json(
        messages=[{"role": "user", "content": "return ok"}],
        json_schema={
            "type": "object",
            "properties": {"ok": {"type": "boolean"}},
            "required": ["ok"],
        },
        schema_name="test_schema",
    )

    env = captured["env"]
    assert isinstance(env, dict)
    assert str(nvm_bin) in env["PATH"].split(os.pathsep)

# Security Checklist

## 1. Secrets

- [ ] No API keys in code.
- [ ] No tokens in tests.
- [ ] No private URLs/cookies/session headers committed.
- [ ] `.env` ignored.
- [ ] `.env.example` contains placeholders only.
- [ ] Pydantic settings load backend config from env/secrets files.
- [ ] Frontend public env vars contain no secrets.
- [ ] `gitleaks` configured and runnable.
- [ ] `pre-commit` configured.

## 2. Local data

- [ ] `data/local.db` ignored.
- [ ] `data/lancedb/` ignored.
- [ ] `data/uploads/` ignored.
- [ ] logs ignored.
- [ ] exports ignored by default unless user explicitly moves them.
- [ ] no telemetry by default.

## 3. Logging

- [ ] Raw prompts with personal data are not logged by default.
- [ ] Raw retrieved documents are not logged by default.
- [ ] Errors redact secrets and private input.
- [ ] Debug logging must be opt-in.

## 4. Source ingestion

- [ ] Manual ingestion is available.
- [ ] URL ingestion requires explicit user action.
- [ ] robots/terms policy state is stored.
- [ ] blocked sources do not fetch content.
- [ ] no auth-wall, paywall, captcha, anti-bot bypass.
- [ ] rate limiting exists for automated fetching.

## 5. LLM providers

- [ ] Local Ollama works without external API keys.
- [ ] OpenAI provider is optional.
- [ ] External provider use is clearly visible in settings.
- [ ] User can disable external providers.
- [ ] Provider errors do not leak secrets.

## 6. Dependencies

- [ ] lockfiles committed.
- [ ] dependency audit command documented.
- [ ] package versions pinned or constrained.
- [ ] unused dependencies removed.

## 7. Testing

- [ ] unit tests for graph validation.
- [ ] unit tests for source policy.
- [ ] unit tests for config loading.
- [ ] fixture-based tests for RAG.
- [ ] e2e test for creating and viewing a map.

## 8. GitHub settings, if repo is pushed

- [ ] enable secret scanning if available.
- [ ] enable push protection if available.
- [ ] protect main branch if needed.
- [ ] avoid uploading local `data/` directory.

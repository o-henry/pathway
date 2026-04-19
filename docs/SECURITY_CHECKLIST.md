# Security Checklist

## 1. Secrets

- [x] No API keys in code.
- [x] No tokens in tests.
- [x] No private URLs/cookies/session headers committed.
- [x] `.env` ignored.
- [x] `.env.example` contains placeholders only.
- [x] Pydantic settings load backend config from env/secrets files.
- [x] Frontend public env vars contain no secrets.
- [x] `gitleaks` configured and runnable.
- [x] `pre-commit` configured.

## 2. Local data

- [x] `data/local.db` ignored.
- [x] `data/lancedb/` ignored.
- [x] `data/uploads/` ignored.
- [x] Logs ignored.
- [x] Exports are user-downloaded files and not committed by default.
- [x] No telemetry by default.

## 3. Logging

- [x] Raw prompts with personal data are not logged by default.
- [x] Raw retrieved documents are not logged by default.
- [x] Errors use generic API detail messages and do not echo secrets.
- [x] Debug logging remains opt-in.

## 4. Source ingestion

- [x] Manual ingestion is available.
- [x] URL ingestion requires explicit user action.
- [x] Robots/terms policy state is stored in URL preview response.
- [x] Blocked sources do not fetch content.
- [x] No auth-wall, paywall, captcha, anti-bot bypass.
- [ ] Rate limiting exists for automated fetching.

## 5. LLM providers

- [x] Local Ollama works without external API keys.
- [x] OpenAI provider is optional.
- [x] External provider use is clearly env-driven.
- [x] User can disable external providers by not configuring them.
- [x] Provider errors do not intentionally leak secrets.

## 6. Dependencies

- [x] Lockfiles committed.
- [x] Dependency audit/secret scan command documented.
- [x] Package versions pinned or constrained through workspace manifests.
- [ ] Unused dependencies removed.

## 7. Testing

- [x] Unit tests for graph validation.
- [x] Unit tests for source policy.
- [x] Unit tests for config loading and repository boundaries.
- [x] Fixture-based tests for RAG and revisions.
- [x] E2E test for creating a goal, generating a map, and accepting a revision.

## 8. GitHub settings, if repo is pushed

- [ ] Enable secret scanning if available.
- [ ] Enable push protection if available.
- [ ] Protect `main` branch if needed.
- [x] Avoid uploading local `data/` directory.

## 9. Remaining risks

- The frontend graph engine chunk is still large, even after lazy loading.
- URL content fetching is still intentionally incomplete; only policy preview is live.
- Production deployment adapter selection is still deferred.

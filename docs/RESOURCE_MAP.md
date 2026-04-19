# Resource Map for Codex

This file maps implementation areas to external resources.
Codex may consult these resources when implementing.

## Codex operation

- AGENTS.md / Codex custom instructions: https://developers.openai.com/codex/ and https://developers.openai.com/codex/prompting
- ExecPlan style planning: https://github.com/openai/codex/blob/main/codex-rs/AGENTS.md and OpenAI Codex prompting guidance
- OpenAI prompting: https://platform.openai.com/docs/guides/prompting
- OpenAI prompt generation / meta-prompts: https://platform.openai.com/docs/guides/prompt-generation/prompt-generation
- OpenAI GPT-5 frontend guidance: https://cookbook.openai.com/examples/gpt-5/gpt-5_frontend

## Prompt and design quality research

- Anthropic prompt engineering overview: https://docs.anthropic.com/en/docs/prompt-engineering
- Anthropic XML tags: https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags
- Anthropic prompt chaining: https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/chain-prompts
- Anthropic long-context tips: https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/long-context-tips
- Anthropic success criteria / eval framing: https://docs.anthropic.com/en/docs/test-and-evaluate/define-success
- Google Gemini prompt best practices: https://ai.google.dev/guide/prompt_best_practices
- Google Vertex prompting strategies: https://cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/prompt-design-strategies
- Google Gemini 3 prompting guide: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/gemini-3-prompting-guide
- Vertex prompt optimizer: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/prompt-optimizer

## Frontend and graph UI

- SvelteKit docs: https://svelte.dev/docs/kit/introduction
- Svelte Flow: https://svelteflow.dev/
- Rough.js: https://roughjs.com/
- ELK.js: https://github.com/kieler/elkjs
- Vitest: https://vitest.dev/guide/
- Playwright: https://playwright.dev/

Deferred/fallback:

- React Flow: https://reactflow.dev/
- tldraw: https://github.com/tldraw/tldraw
- Excalidraw: https://github.com/excalidraw/excalidraw
- Cytoscape.js: https://js.cytoscape.org/

## Backend

- FastAPI: https://fastapi.tiangolo.com/
- SQLModel: https://sqlmodel.tiangolo.com/
- SQLAlchemy: https://docs.sqlalchemy.org/
- Pydantic Settings: https://docs.pydantic.dev/latest/concepts/pydantic_settings/
- uv: https://docs.astral.sh/uv/
- Ruff: https://github.com/astral-sh/ruff
- pytest: https://docs.pytest.org/en/stable/
- NetworkX DAG algorithms: https://networkx.org/documentation/stable/reference/algorithms/dag.html

## Local AI and RAG

- Ollama embeddings: https://docs.ollama.com/capabilities/embeddings
- LanceDB: https://lancedb.github.io/lancedb/
- LlamaIndex query engine concepts: https://developers.llamaindex.ai/python/framework/module_guides/deploying/query_engine/
- DSPy: https://dspy.ai/

## Crawling and extraction

- Crawl4AI: https://github.com/unclecode/crawl4ai
- Lightpanda browser: https://github.com/lightpanda-io/browser
- Scrapy: https://github.com/scrapy/scrapy
- Scrapling: https://github.com/D4Vinci/Scrapling
- Trafilatura: https://github.com/adbar/trafilatura
- SearXNG: https://github.com/searxng/searxng
- Common Crawl: https://commoncrawl.org/overview
- Google robots.txt guidance: https://developers.google.com/search/docs/crawling-indexing/robots/intro
- Reddit Data API Terms: https://redditinc.com/policies/data-api-terms

## Security

- OWASP Secrets Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- Gitleaks: https://github.com/gitleaks/gitleaks
- pre-commit: https://pre-commit.com/
- GitHub secret scanning / push protection: https://docs.github.com/en/code-security/secret-scanning

## Papers and concepts

- RAG original paper: https://arxiv.org/abs/2005.11401
- GraphRAG paper: https://arxiv.org/abs/2404.16130
- HyDE paper: https://arxiv.org/abs/2212.10496
- Self-RAG paper: https://arxiv.org/abs/2310.11511
- Self-Refine: https://arxiv.org/abs/2303.17651
- Reflexion: https://arxiv.org/abs/2303.11366
- Multi-agent survey: https://arxiv.org/abs/2402.01680
- DSPy paper: https://arxiv.org/abs/2310.03714
- Automatic Prompt Optimization / ProTeGi: https://arxiv.org/abs/2305.03495

## How to use these resources

Use official docs first for implementation details.
Use papers for design concepts, not as direct implementation requirements.
Prefer simple implementation over framework sprawl.

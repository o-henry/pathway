<script lang="ts">
  import type { GeneratedMapResponse } from '$lib/api/types';
  import CheckInRevisionPanel from '$lib/components/CheckInRevisionPanel.svelte';
  import GenerateMapPanel from '$lib/components/GenerateMapPanel.svelte';
  import LandingHero from '$lib/components/LandingHero.svelte';
  import SourceLibraryPanel from '$lib/components/SourceLibraryPanel.svelte';
  import StaticLifeMap from '$lib/components/lifemap/StaticLifeMap.svelte';
  import { exampleGraphBundle } from '$lib/fixtures/exampleGraphBundle';
  import type { GraphBundle } from '$lib/graph/types';

  let activeBundle = $state<GraphBundle>(exampleGraphBundle);
  let currentMap = $state<GeneratedMapResponse | null>(null);

  const roadmap = [
    {
      title: 'Dynamic graph ontology',
      body: '목표마다 다른 노드 타입을 갖는 GraphBundle 기반 구조가 이미 적용되어 있습니다.'
    },
    {
      title: 'Evidence-aware generation',
      body: '사용자 노트와 허용된 소스에서 가져온 근거를 RAG로 붙여서 지도 생성에 실제로 반영합니다.'
    },
    {
      title: 'Check-in driven revisions',
      body: '실제 진행 기록을 바탕으로 proposal diff를 만들고 새 snapshot으로 수락하는 revision flow가 적용되어 있습니다.'
    },
    {
      title: 'Quality + export packaging',
      body: '다음 단계에서는 export/import, workspace polish, packaging, chunk split 정리를 진행합니다.'
    }
  ];
</script>

<svelte:head>
  <title>Life Map</title>
  <meta
    name="description"
    content="Local-first scenario mapping workspace for goals, constraints, choices, and revisions."
  />
</svelte:head>

<div class="page">
  <LandingHero />
  <GenerateMapPanel
    onGenerated={(map) => {
      currentMap = map;
      activeBundle = map.graph_bundle;
    }}
  />
  <SourceLibraryPanel />
  <CheckInRevisionPanel
    {currentMap}
    onAccepted={(map) => {
      currentMap = map;
      activeBundle = map.graph_bundle;
    }}
  />
  <StaticLifeMap bundle={activeBundle} />

  <section class="roadmap">
    <div class="section-header">
      <p class="eyebrow">Build trajectory</p>
      <h2>Phase-by-phase로 쪼개서 context rot를 방지합니다</h2>
    </div>

    <div class="grid">
      {#each roadmap as item (item.title)}
        <article>
          <h3>{item.title}</h3>
          <p>{item.body}</p>
        </article>
      {/each}
    </div>
  </section>
</div>

<style>
  :global(body) {
    margin: 0;
    background:
      radial-gradient(circle at top left, rgba(255, 228, 211, 0.9), transparent 28%),
      radial-gradient(circle at top right, rgba(208, 232, 255, 0.7), transparent 24%),
      linear-gradient(180deg, #fff8ef 0%, #fffef9 100%);
    color: #2f2330;
    font-family:
      "Avenir Next", "Nunito", "Pretendard Variable", "Pretendard", system-ui, sans-serif;
  }

  .page {
    display: grid;
    gap: 3rem;
    min-height: 100vh;
    padding: 3rem 1.5rem 4rem;
  }

  .roadmap {
    display: grid;
    gap: 1.5rem;
  }

  .section-header {
    display: grid;
    gap: 0.65rem;
  }

  .eyebrow {
    margin: 0;
    color: #8a5562;
    font-size: 0.9rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h2,
  h3,
  p {
    margin: 0;
  }

  h2 {
    font-size: clamp(1.6rem, 2vw, 2.2rem);
  }

  .grid {
    display: grid;
    gap: 1rem;
  }

  article {
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.68);
    box-shadow: 0 10px 28px rgba(106, 72, 86, 0.07);
    padding: 1.2rem 1.25rem;
  }

  article h3 {
    margin-bottom: 0.45rem;
    font-size: 1.05rem;
  }

  article p {
    color: #554651;
    line-height: 1.6;
  }

  @media (min-width: 900px) {
    .page {
      padding-inline: 3rem;
    }

    .grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
</style>

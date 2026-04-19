<script lang="ts">
  const bullets = [
    '목표와 제약을 입력하면 여러 선택 경로를 펼쳐봅니다.',
    '근거와 가정을 분리한 로컬 시나리오 맵을 유지합니다.',
    '체크인 이후에도 경로를 다시 계산하는 개인용 라이프 가이드입니다.'
  ];
</script>

<section class="hero">
  <div class="copy">
    <p class="eyebrow">Local-first Life Map</p>
    <h1>선택의 가지를 그려주는 개인용 시나리오 맵</h1>
    <p class="lede">
      Life Map은 미래를 예언하지 않습니다. 대신 지금의 조건과 목표를 바탕으로
      가능한 경로, 리스크, 전환점을 한 장의 지도처럼 펼쳐 보여줍니다.
    </p>

    <ul>
      {#each bullets as bullet (bullet)}
        <li>{bullet}</li>
      {/each}
    </ul>
  </div>

  <div class="card">
    <div class="badge">Phase 0</div>
    <h2>Bootstrapped safely</h2>
    <p>
      현재 단계에서는 루트 설정, 보안 가드레일, 기본 UI, 헬스체크 API만 준비합니다.
      그래프 생성과 RAG는 이후 phase에서 연결됩니다.
    </p>
  </div>
</section>

<style>
  .hero {
    display: grid;
    gap: 1.5rem;
  }

  .copy {
    display: grid;
    gap: 1rem;
  }

  .eyebrow {
    margin: 0;
    color: #8a5562;
    font-size: 0.9rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1,
  h2,
  p,
  li {
    margin: 0;
  }

  h1 {
    font-size: clamp(2.2rem, 4vw, 4rem);
    line-height: 0.98;
  }

  .lede {
    max-width: 62ch;
    color: #4f3e49;
    font-size: 1.05rem;
    line-height: 1.6;
  }

  ul {
    display: grid;
    gap: 0.75rem;
    padding-left: 1.2rem;
    color: #43353f;
  }

  .card {
    border: 2px dashed rgba(103, 77, 86, 0.4);
    border-radius: 28px;
    background: rgba(255, 247, 240, 0.9);
    box-shadow: 0 12px 32px rgba(88, 56, 72, 0.08);
    padding: 1.5rem;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: fit-content;
    margin-bottom: 0.75rem;
    border-radius: 999px;
    background: #ffe3b9;
    color: #6d4832;
    font-size: 0.78rem;
    font-weight: 700;
    padding: 0.35rem 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  @media (min-width: 900px) {
    .hero {
      align-items: start;
      grid-template-columns: 1.5fr 0.9fr;
    }
  }
</style>

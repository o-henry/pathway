<script lang="ts">
  const bullets = [
    '목표를 먼저 받고, 그 목표에 진짜 영향을 주는 resource lens만 다시 묻습니다.',
    '조사 근거와 가정, 닫힌 분기와 손실을 같은 그래프 표면 위에 같이 둡니다.',
    '상태 업데이트 이후에는 과거 계획을 지키기보다 현재 조건에 맞춰 Pathway를 다시 엽니다.'
  ];
</script>

<section class="hero">
  <p class="eyebrow">Pathway / adaptive graph workspace</p>
  <h1>목표에서 시작해 현재 조건에 맞는 경로를 구조적으로 비교합니다</h1>
  <p class="lede">
    미래를 예언하는 대신, 지금의 시간과 예산, 에너지와 제약이 어디에서 분기를 바꾸는지
    시각적으로 붙잡는 로컬 워크스페이스를 지향합니다.
  </p>

  <div class="bullet-stack">
    {#each bullets as bullet (bullet)}
      <p>{bullet}</p>
    {/each}
  </div>
</section>

<style>
  .hero {
    display: grid;
    gap: 0.85rem;
    border: 1px solid var(--pathway-line-strong);
    border-radius: var(--pathway-panel-radius);
    background: var(--pathway-panel);
    box-shadow: var(--pathway-shadow);
    padding: 1rem;
  }

  .eyebrow,
  h1,
  p {
    margin: 0;
  }

  .eyebrow {
    color: var(--pathway-accent-strong);
    font-size: 0.76rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1 {
    font-size: clamp(1.7rem, 2.8vw, 2.8rem);
    line-height: 0.94;
    letter-spacing: -0.035em;
    max-width: 10ch;
  }

  .lede,
  .bullet-stack p {
    color: var(--pathway-muted);
    line-height: 1.62;
  }

  .bullet-stack {
    display: grid;
    gap: 0.68rem;
  }

  .bullet-stack p {
    border-left: 2px solid rgba(23, 68, 77, 0.24);
    padding-left: 0.7rem;
  }
</style>

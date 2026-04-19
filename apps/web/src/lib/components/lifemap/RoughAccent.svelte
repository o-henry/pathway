<script lang="ts">
  let {
    stroke = '#536272',
    width = 80,
    height = 16
  }: {
    stroke?: string;
    width?: number;
    height?: number;
  } = $props();

  const mainPath = $derived(
    `M2 ${height - 4} C ${Math.round(width * 0.3)} 2, ${Math.round(width * 0.55)} ${height - 2}, ${width - 2} 3`
  );
  const echoPath = $derived(
    `M5 ${height - 2} C ${Math.round(width * 0.32)} 5, ${Math.round(width * 0.58)} ${height + 1}, ${width - 6} 6`
  );
</script>

<svg
  class="accent"
  aria-hidden="true"
  width={width}
  height={height}
  viewBox={`0 0 ${width} ${height}`}
  fill="none"
>
  <path
    d={mainPath}
    stroke={stroke}
    stroke-width="1.65"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d={echoPath}
    stroke={stroke}
    stroke-opacity="0.45"
    stroke-width="1.1"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-dasharray="6 8"
  />
</svg>

<style>
  .accent {
    width: 100%;
    height: 16px;
    pointer-events: none;
    overflow: visible;
  }
</style>

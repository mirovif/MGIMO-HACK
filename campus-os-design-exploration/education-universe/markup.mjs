export const educationUniverseMarkup = `
<section id="education-universe" class="education-universe" aria-labelledby="eu-title" data-education-universe>
  <header class="eu-intro">
    <h2 id="eu-title">Образовательная вселенная</h2>
    <p>Демонстрационные данные РЭУ им. Г. В. Плеханова</p>
  </header>
  <div class="eu-scene">
    <canvas data-universe-canvas aria-hidden="true"></canvas>
    <div class="eu-tooltip" data-universe-tooltip aria-hidden="true" hidden></div>
    <div class="eu-zoom" role="group" aria-label="Масштаб карты" data-universe-zoom hidden>
      <button type="button" data-zoom-step="-1" aria-label="Отдалить карту"><span aria-hidden="true">−</span></button>
      <button type="button" data-zoom-step="1" aria-label="Приблизить карту"><span aria-hidden="true">+</span></button>
    </div>
  </div>
  <div class="eu-actions">
    <p class="eu-status" role="status" data-universe-status>Загружаем каталог…</p>
    <button type="button" data-universe-retry hidden>Повторить загрузку</button>
    <button type="button" data-universe-map hidden>Открыть 3D-карту</button>
  </div>
  <nav class="eu-navigation" aria-label="Уровни образовательной вселенной">
    <button type="button" data-universe-back hidden><span aria-hidden="true">←</span> Назад</button>
    <ol class="eu-breadcrumbs" data-universe-breadcrumbs hidden></ol>
  </nav>
  <div class="eu-index" data-universe-panel></div>
</section>
`;

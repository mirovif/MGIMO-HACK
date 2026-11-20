import { navigation, header, videoMarkup, startPage } from './shared.mjs';
import { bookletMarkup, mountBooklet } from '../education-universe/booklet.mjs';
import { mountEducationUniverse } from '../education-universe/universe.mjs';
import { storyMarkup, mountStory } from './05-story.mjs';
import { kametaMarkup, mountKameta } from './05-kameta.mjs';
import { teamMarkup, mountTeam } from './05-team.mjs';

const siteName = 'UTRET';
const utretNavigation = navigation
  .filter(([id]) => id === 'university' || id === 'education')
  .map(([id, label]) => [id === 'education' ? 'education-universe' : id, label]);

document.body.innerHTML = `
  <header class="relief-hero" id="top">
    ${header(siteName, utretNavigation, '/lks')}
    <div class="relief-stage">
      <div class="relief-film">
        ${videoMarkup({ src: '../assets/campus-still-fast.webp', width: 960, height: 540 })}
      </div>
      <h1 class="relief-title">
        <span><span>Учёба</span></span>
        <span><span>выходит</span></span><br class="relief-mobile-break">
        <span><span>за рамки</span></span>
        <span><span>аудитории</span></span>
      </h1>
      ${bookletMarkup()}
    </div>
  </header>

  <main id="content" tabindex="-1">
    ${storyMarkup}
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

    <figure id="universe-explainer" class="relief-universe-explainer relief-wrap">
      <figcaption>В UTRET <em>наглядный граф</em> показывает, как связаны факультеты, направления, программы и учебные дисциплины.</figcaption>
      <div class="relief-universe-illustration">
        <img src="../assets/universe-example.webp" width="1774" height="887" loading="lazy" decoding="async"
          alt="Граф от факультета и направления до программы «Цифровая торговля и маркетплейсы» и её дисциплин.">
      </div>
    </figure>

    <section id="university" class="relief-intro relief-wrap" aria-labelledby="relief-intro-title">
      <h2 id="relief-intro-title">Навигация</h2>
      <div class="relief-intro-copy">
        <p><strong>Не знаешь, как добраться до нужной аудитории?</strong> UTRET построит маршрут между корпусами, покажет расстояние и время в пути, а также подскажет, куда идти. Даже в незнакомом университете найти нужное место станет проще.</p>
      </div>
      <figure class="relief-route-preview">
        <img src="../assets/navigation-route.webp" width="321" height="375" loading="lazy" decoding="async"
          alt="Маршрут между корпусами кампуса. В пути 4 минуты, расстояние 239 метров.">
      </figure>
      <span class="relief-route-trace" aria-hidden="true"></span>
    </section>

    ${kametaMarkup}
    ${teamMarkup}
  </main>`;

mountBooklet(document.querySelector('#student-id'));
mountStory(document.querySelector('#campus'));
mountKameta(document.querySelector('#kameta'));
mountTeam(document.querySelector('#team'));
mountEducationUniverse(document.querySelector('[data-education-universe]'));
startPage({ videoSource: '../assets/campus-fast.mp4' });

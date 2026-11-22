import { navigation, header, videoMarkup, startPage } from './shared.mjs';
import { campusMapUrl } from '../content.mjs';
import { bookletMarkup, mountBooklet } from '../education-universe/booklet.mjs';
import { educationUniverseMarkup } from '../education-universe/markup.mjs';
import { mountEducationUniverse } from '../education-universe/universe.mjs';
import { storyMarkup, mountStory } from './05-story.mjs';
import { kametaMarkup, mountKameta } from './05-kameta.mjs';
import { teamMarkup, mountTeam } from './05-team.mjs';

const siteName = 'UTRET';
const directToMap = location.hash === '#education-universe';
const deferRouteImage = directToMap && typeof IntersectionObserver === 'function';
const utretNavigation = navigation
  .filter(([id]) => id === 'university' || id === 'education')
  .map(([id, label]) => id === 'education' ? ['education-universe', label] : [id, 'Карта РЭУ']);

document.body.innerHTML = `
  <header class="relief-hero" id="top">
    ${header(siteName, utretNavigation, '/lks')}
    <div class="relief-stage">
      <div class="relief-film">
        ${videoMarkup({
          src: '../assets/campus-still-fast.webp', width: 960, height: 540,
          deferPoster: directToMap,
        })}
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
    ${educationUniverseMarkup}

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
        <p><strong>Как добраться до аудитории?</strong> Найди корпус, вход или кабинет на интерактивной карте РЭУ и проложи маршрут между нужными точками.</p>
        <a class="relief-action" href="${campusMapUrl}" target="_blank" rel="noopener noreferrer">Открыть карту РЭУ</a>
      </div>
      <figure class="relief-route-preview">
        <img ${deferRouteImage ? 'data-src' : 'src'}="../assets/navigation-route.webp" width="321" height="375" loading="lazy" decoding="async" fetchpriority="low"
          alt="Маршрут между корпусами кампуса. В пути 4 минуты, расстояние 239 метров.">
      </figure>
      <span class="relief-route-trace" aria-hidden="true"></span>
    </section>

    ${kametaMarkup}
    ${teamMarkup}
  </main>
  <footer class="relief-wrap relief-footer">UTRET — неофициальный конкурсный прототип.</footer>`;

mountBooklet(document.querySelector('#student-id'));
mountStory(document.querySelector('#campus'));
mountKameta(document.querySelector('#kameta'));
mountTeam(document.querySelector('#team'));
mountEducationUniverse(document.querySelector('[data-education-universe]'));
if (deferRouteImage) {
  const image = document.querySelector('.relief-route-preview img');
  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    image.src = image.dataset.src;
    observer.disconnect();
  }, { rootMargin: '250px' });
  observer.observe(image);
}
startPage({ videoSource: '../assets/campus-fast.mp4' });

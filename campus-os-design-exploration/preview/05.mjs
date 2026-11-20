import { site, picture, date, header, videoMarkup, startPage } from './shared.mjs';
import { bookletMarkup, mountBooklet } from '../education-universe/booklet.mjs';

const { identity, education, news, events, highlights } = site;
const siteName = 'UTRET';

document.body.innerHTML = `
  <header class="relief-hero" id="top">
    ${header(siteName)}
    <div class="relief-stage">
      <div class="relief-film">${videoMarkup()}</div>
      <h1 class="relief-title">
        <span><span>Учёба</span></span>
        <span><span>выходит</span></span><br class="relief-mobile-break">
        <span><span>за рамки</span></span>
        <span><span>аудитории.</span></span>
      </h1>
      ${bookletMarkup()}
    </div>
  </header>

  <main id="content" tabindex="-1">
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
      <p class="eu-status" role="status" data-universe-status>Загружаем каталог…</p>
      <nav class="eu-navigation" aria-label="Уровни образовательной вселенной">
        <button type="button" data-universe-back hidden><span aria-hidden="true">←</span> Назад</button>
        <ol class="eu-breadcrumbs" data-universe-breadcrumbs hidden></ol>
      </nav>
      <div class="eu-index" data-universe-panel></div>
    </section>
    <section id="university" class="relief-intro relief-wrap" aria-labelledby="relief-intro-title">
      <figure class="relief-portal">
        ${picture('courtyard')}
      </figure>
      <div class="relief-intro-copy">
        <h2 id="relief-intro-title">${identity.title}</h2>
        <p>${identity.body}</p>
      </div>
    </section>

    <section id="education" class="relief-education" aria-labelledby="relief-education-title">
      <div class="relief-wrap">
        <h2 id="relief-education-title">${education.title}</h2>
        <div class="relief-education-layout">
          <div class="relief-programs">
            ${education.programs.map(program => `
              <article>
                <p class="relief-meta">${program.level}</p>
                <h3>${program.title}</h3>
                <p>${program.body}</p>
              </article>
            `).join('')}
          </div>
          <article class="relief-life">
            <figure>${picture('workshop')}</figure>
            <div>
              <h3>${education.life.title}</h3>
              <p>${education.life.body}</p>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section id="news" class="relief-news relief-wrap" aria-labelledby="relief-news-title">
      <div class="relief-news-reading">
        <h2 id="relief-news-title">${news.title}</h2>
        <div class="relief-news-reading-list">
          ${news.items.map(item => `
            <article>
              <p class="relief-meta">${item.category} · ${date(item)}</p>
              <h3>${item.title}</h3>
              <p>${item.body}</p>
            </article>
          `).join('')}
        </div>
      </div>
      <figure class="relief-news-figure">${picture('glass')}</figure>
    </section>

    <section id="events" class="relief-events relief-wrap" aria-labelledby="relief-events-title">
      <h2 id="relief-events-title">${events.title}</h2>
      <ol>
        ${events.items.map(item => `
          <li>
            <time datetime="${item.datetime}" aria-label="${item.date}">
              <span>${item.day}</span><span>${item.month}</span>
            </time>
            <article>
              <h3>${item.title}</h3>
              <p>${item.body}</p>
              <p class="relief-meta">${item.time} · ${item.place}</p>
            </article>
          </li>
        `).join('')}
      </ol>
    </section>

    <section class="relief-workshop relief-wrap" id="campus" aria-labelledby="relief-workshop-title">
      <figure>${picture('atrium')}</figure>
      <div>
        <h2 id="relief-workshop-title">${highlights.title}</h2>
        <p>${highlights.body}</p>
        <p class="relief-meta">${highlights.note}</p>
      </div>
    </section>
  </main>

  <footer class="relief-footer">
    <div class="relief-wrap relief-footer-info">
      <p>${site.disclaimer}</p>
      <a href="#top">К началу <span aria-hidden="true">↑</span></a>
    </div>
    <a class="relief-footer-mark" href="#top" aria-label="${siteName}, к началу страницы">${siteName}</a>
  </footer>`;

for (const link of document.querySelectorAll('.preview-header a[href="#education"]')) {
  link.hash = 'education-universe';
}
mountBooklet(document.querySelector('#student-id'));
startPage();

const universe = document.querySelector('[data-education-universe]');
const loadUniverse = new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting) return;
  loadUniverse.disconnect();
  import('../education-universe/universe.mjs').then(({ mountEducationUniverse }) => {
    mountEducationUniverse(universe);
  }).catch((error) => {
    universe.querySelector('[data-universe-status]').textContent = 'Не удалось загрузить каталог. Обновите страницу.';
    console.error('Education Universe:', error);
  });
}, { rootMargin: '550px 0px' });
loadUniverse.observe(universe);

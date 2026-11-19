import { date, header, picture, site, startPage, videoMarkup } from './shared.mjs';

const { identity, education, news, events, highlights } = site;

function slicedImage(name, extraClass = '') {
  return '<figure class="kinetic-slats ' + extraClass + '">'
    + picture(name, 'kinetic-slat-base')
    + '<div class="kinetic-slat-layers" aria-hidden="true">'
    + ['first', 'second', 'third', 'fourth'].map(part => picture(name, 'kinetic-slat-' + part)).join('')
    + '</div></figure>';
}

const sectionTitle = (title) => '<h2 class="kinetic-section-title"><span>' + title + '</span></h2>';

document.body.innerHTML = `
  <header id="top" class="kinetic-hero">
    ${header()}
    <div class="kinetic-stage">
      <div class="kinetic-stage-fold" aria-hidden="true"></div>
      ${videoMarkup()}
      <div class="kinetic-stage-front" aria-hidden="true"></div>
      <h1 class="kinetic-title">
        <span class="kinetic-title-line"><span>Учёба</span></span>
        <span class="kinetic-title-line"><span>выходит</span></span>
        <span class="kinetic-title-line"><span>за рамки</span></span>
        <span class="kinetic-title-line"><span>аудитории.</span></span>
      </h1>
    </div>
  </header>
  <main id="content">
    <section class="kinetic-intro kinetic-container" id="university">
      <div class="kinetic-intro-copy">
        ${sectionTitle(identity.title)}
        <p>${identity.body}</p>
      </div>
      ${slicedImage('courtyard')}
    </section>
    <section class="kinetic-education" id="education">
      <div class="kinetic-education-fold" aria-hidden="true"></div>
      <div class="kinetic-container">
        ${sectionTitle(education.title)}
        <div class="kinetic-programs">
          ${education.programs.map(program => `
            <article class="kinetic-program">
              <p class="kinetic-meta">${program.level}</p>
              <h3>${program.title}</h3>
              <p class="kinetic-program-description">${program.body}</p>
            </article>
          `).join('')}
        </div>
        <article class="kinetic-life">
          <figure class="kinetic-life-photo">${picture('workshop')}</figure>
          <div>
            <h3>${education.life.title}</h3>
            <p>${education.life.body}</p>
          </div>
        </article>
      </div>
    </section>
    <section class="kinetic-news kinetic-container" id="news">
      ${sectionTitle(news.title)}
      <div class="kinetic-news-grid">
        ${news.items.map((item, index) => `
          <article class="kinetic-story">
            ${index === 0 ? `<figure class="kinetic-news-photo">${picture('glass')}</figure>` : ''}
            <div>
              <p class="kinetic-meta">${item.category} <span aria-hidden="true">/</span> ${date(item)}</p>
              <h3>${item.title}</h3>
              <p>${item.body}</p>
            </div>
          </article>
        `).join('')}
      </div>
    </section>
    <section class="kinetic-events kinetic-container" id="events">
      ${sectionTitle(events.title)}
      <ol class="kinetic-event-list">
        ${events.items.map(item => `
          <li class="kinetic-event">
            <time class="kinetic-event-date" datetime="${item.datetime}" aria-label="${item.date}">
              <span>${item.day}</span><span>${item.month}</span>
            </time>
            <article>
              <p class="kinetic-meta">${item.time} · ${item.place}</p>
              <h3>${item.title}</h3>
              <p>${item.body}</p>
            </article>
          </li>
        `).join('')}
      </ol>
    </section>
    <section class="kinetic-workshop kinetic-container" id="campus">
      <div>
        ${sectionTitle(highlights.title)}
        <p>${highlights.body}</p>
        <p class="kinetic-meta">${highlights.note}</p>
      </div>
      ${slicedImage('atrium', 'kinetic-finale-photo')}
    </section>
  </main>
  <footer class="kinetic-footer">
    <a class="kinetic-footer-logo" href="#top">Campus OS</a>
    <p>${site.disclaimer}</p>
    <a class="kinetic-top-link" href="#top">К началу <span aria-hidden="true">↗</span></a>
  </footer>
`;

startPage();

const stage = document.querySelector('.kinetic-stage');
const pointerMotion = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
let pointerFrame = 0;

function updateFold(event) {
  if (!pointerMotion.matches || pointerFrame) return;
  pointerFrame = requestAnimationFrame(() => {
    pointerFrame = 0;
    const frame = stage.getBoundingClientRect();
    stage.style.setProperty('--pointer-x', ((event.clientX - frame.left) / frame.width - .5).toFixed(3));
    stage.style.setProperty('--pointer-y', ((event.clientY - frame.top) / frame.height - .5).toFixed(3));
  });
}

function resetFold() {
  cancelAnimationFrame(pointerFrame);
  pointerFrame = 0;
  stage.style.removeProperty('--pointer-x');
  stage.style.removeProperty('--pointer-y');
}

stage.addEventListener('pointermove', updateFold, { passive: true });
stage.addEventListener('pointerleave', resetFold);
pointerMotion.addEventListener('change', resetFold);

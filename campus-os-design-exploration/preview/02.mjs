import {
  site, picture, date, header, videoMarkup, startPage,
} from './shared.mjs';
import { mountOptic } from './02-optics.mjs';

const { identity, education, news, events, highlights } = site;
const programList = education.programs.map((program, index) => `
  <details class="optic-program" name="programs"${index === 0 ? ' open' : ''}>
    <summary>
      <span>${program.title}</span>
      <small>${program.level}</small>
    </summary>
    <p>${program.body}</p>
  </details>`).join('');

document.body.insertAdjacentHTML('afterbegin', `
  <header id="top" class="optic-shell">
    ${header()}
    <div class="hero optic-hero">
      <h1 class="optic-title">
        <span><span>Учёба выходит</span></span>
        <span><span>за рамки</span></span>
        <span><span>аудитории.</span></span>
      </h1>
      <div class="optic-stage">
        ${videoMarkup()}
        <div class="optic-lens hero-lens" aria-hidden="true">
          <canvas></canvas>
        </div>
      </div>
    </div>
  </header>

  <main id="content" tabindex="-1">
    <section class="optic-intro optic-wrap" id="university" aria-labelledby="optic-intro-title">
      <div class="optic-intro-copy">
        <h2 id="optic-intro-title">${identity.title}</h2>
        <p>${identity.body}</p>
      </div>
      <figure class="optic-intro-view optic-photo">
        ${picture('courtyard')}
        <div class="optic-lens intro-lens" aria-hidden="true"><canvas></canvas></div>
      </figure>
    </section>

    <section class="optic-education optic-wrap" id="education" aria-labelledby="optic-education-title">
      <div class="optic-syllabus">
        <h2 id="optic-education-title">${education.title}</h2>
        ${programList}
      </div>
      <article class="optic-life">
        <figure class="optic-photo">${picture('workshop')}</figure>
        <h3>${education.life.title}</h3>
        <p>${education.life.body}</p>
      </article>
    </section>

    <section class="optic-news" id="news" aria-labelledby="optic-news-title">
      <div class="optic-news-landscape">
        <figure class="optic-photo">${picture('glass')}</figure>
        <h2 id="optic-news-title">${news.title}</h2>
      </div>
      <div class="optic-news-list optic-wrap">
        ${news.items.map(item => `
          <article class="optic-story">
            <p class="optic-meta">${item.category}<span aria-hidden="true">·</span>${date(item)}</p>
            <h3>${item.title}</h3>
            <p>${item.body}</p>
          </article>`).join('')}
      </div>
    </section>

    <section class="optic-events optic-wrap" id="events" aria-labelledby="optic-events-title">
      <h2 id="optic-events-title">${events.title}</h2>
      <ol>
        ${events.items.map(item => `
          <li class="optic-event">
            <time datetime="${item.datetime}" class="optic-event-date" aria-label="${item.date}">
              <span>${item.day}</span><span>${item.month}</span>
            </time>
            <div>
              <h3>${item.title}</h3>
              <p>${item.body}</p>
            </div>
            <p class="optic-event-place"><span>${item.time}</span><span>${item.place}</span></p>
          </li>`).join('')}
      </ol>
    </section>

    <section class="optic-campus optic-wrap" id="campus" aria-labelledby="optic-campus-title">
      <figure class="optic-photo">${picture('atrium')}</figure>
      <div class="optic-campus-copy">
        <h2 id="optic-campus-title">${highlights.title}</h2>
        <p>${highlights.body}</p>
        <p class="optic-meta">${highlights.note}</p>
      </div>
    </section>
  </main>

  <footer class="optic-footer optic-wrap">
    <a href="#top" class="optic-footer-brand">Campus OS</a>
    <p>${site.disclaimer}</p>
    <a href="#top" class="optic-back-top">К началу <span aria-hidden="true">↑</span></a>
  </footer>
`);

startPage();

const stage = document.querySelector('.optic-stage');
const facade = document.querySelector('.optic-intro-view');
mountOptic(stage.querySelector('.optic-lens'), stage.querySelector('.hero-media'), () => {
  const video = stage.querySelector('video');
  return video.classList.contains('is-playing') ? video : stage.querySelector('.hero-poster');
});
mountOptic(facade.querySelector('.optic-lens'), facade, () => facade.querySelector('img'));

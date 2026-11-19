import { date, header, picture, site, startPage, videoMarkup } from './shared.mjs';

const { identity, education, news, events, highlights } = site;
const [lead, ...briefs] = news.items;
const heading = (text) => `<h2 class="ed-heading"><span>${text}</span></h2>`;
const article = (item) => `
  <article>
    <p class="ed-meta">${item.category} <span>·</span> ${date(item)}</p>
    <h3>${item.title}</h3>
    <p>${item.body}</p>
  </article>`;

document.body.insertAdjacentHTML('afterbegin', `
  <header id="top" class="ed-hero">
    ${header()}
    <div class="ed-cover">
      <h1>
        <span class="ed-title-line"><span>Учёба выходит</span></span>
        <span class="ed-title-line"><span>за рамки</span></span>
        <span class="ed-title-line"><em>аудитории.</em></span>
      </h1>
      <div class="ed-film">${videoMarkup()}</div>
    </div>
  </header>
  <main id="content">
    <section id="university" class="ed-intro">
      <figure class="ed-reveal">${picture('courtyard')}</figure>
      <div>
        ${heading(identity.title)}
        <p>${identity.body}</p>
      </div>
    </section>
    <section id="education" class="ed-education">
      ${heading(education.title)}
      <div class="ed-programs">
        ${education.programs.map((program) => `
          <article>
            <p class="ed-meta">${program.level}</p>
            <h3>${program.title}</h3>
            <p>${program.body}</p>
          </article>`).join('')}
      </div>
      <article class="ed-life">
        <figure class="ed-reveal">${picture('workshop')}</figure>
        <div>
          <h3>${education.life.title}</h3>
          <p>${education.life.body}</p>
        </div>
      </article>
    </section>
    <section id="news" class="ed-news">
      ${heading(news.title)}
      <div class="ed-news-spread">
        <div class="ed-news-lead">
          <figure class="ed-reveal">${picture('glass')}</figure>
          ${article(lead)}
        </div>
        <div class="ed-news-briefs">${briefs.map(article).join('')}</div>
      </div>
    </section>
    <section id="events" class="ed-events">
      ${heading(events.title)}
      <ol>
        ${events.items.map((item) => `
          <li>
            <time class="ed-date" datetime="${item.datetime}"><span>${item.day}</span> ${item.month}</time>
            <div>
              <h3>${item.title}</h3>
              <p>${item.body}</p>
              <p class="ed-meta">${item.time} · ${item.place}</p>
            </div>
          </li>`).join('')}
      </ol>
    </section>
    <section id="campus" class="ed-campus">
      <figure class="ed-reveal">${picture('atrium')}</figure>
      <div>
        ${heading(highlights.title)}
        <p>${highlights.body}</p>
        <p class="ed-meta">${highlights.note}</p>
      </div>
    </section>
  </main>
  <footer class="ed-footer">
    <a href="#top" class="ed-footer-mark">Campus OS</a>
    <p>${site.disclaimer}</p>
    <a href="#top" class="ed-to-top">К началу <span aria-hidden="true">↑</span></a>
  </footer>
`);

startPage();

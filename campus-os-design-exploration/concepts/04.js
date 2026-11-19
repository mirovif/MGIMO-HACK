export default function renderPoster({ site, hero, footer, picture, date }) {
  const { identity, education, news, events, highlights } = site;

  return `
    <header class="hero poster-hero">
      ${hero('<span>Учёба выходит</span> <span>за рамки <mark>аудитории.</mark></span>')}
    </header>
    <main id="content" class="poster">
      <section class="poster-intro" id="university">
        <div class="poster-intro-copy">
          <h2>${identity.title}</h2>
          <p>${identity.body}</p>
        </div>
        <figure class="poster-intro-image">${picture("courtyard")}</figure>
      </section>
      <section class="poster-education" id="education">
        <div class="poster-inner">
          <h2>${education.title}</h2>
          <div class="poster-education-rack">
            <div class="poster-programs">
              ${education.programs.map(program => `
                <article>
                  <div class="poster-meta">${program.level}</div>
                  <h3>${program.title}</h3>
                  <p>${program.body}</p>
                </article>
              `).join("")}
            </div>
            <article class="poster-life">
              <figure>${picture("workshop")}</figure>
              <div>
                <h3>${education.life.title}</h3>
                <p>${education.life.body}</p>
              </div>
            </article>
          </div>
        </div>
      </section>
      <section class="poster-news" id="news">
        <header class="poster-news-mast">
          <h2>${news.title}</h2>
          <figure>${picture("glass")}</figure>
        </header>
        <div class="poster-news-columns">
          ${news.items.map(item => `
            <article>
              <p class="poster-meta">${item.category} <span aria-hidden="true">/</span> ${date(item)}</p>
              <h3>${item.title}</h3>
              <p>${item.body}</p>
            </article>
          `).join("")}
        </div>
      </section>
      <section class="poster-events poster-inner" id="events">
        <h2>${events.title}</h2>
        <ol class="poster-event-postings">
          ${events.items.map(item => `
            <li>
              <time datetime="${item.datetime}" class="poster-event-date" aria-label="${item.date}">
                <span>${item.day}</span><span>${item.month}</span>
              </time>
              <article>
                <h3>${item.title}</h3>
                <p>${item.body}</p>
              </article>
              <p class="poster-event-location">
                <span>${item.time}</span>
                <span>${item.place}</span>
              </p>
            </li>
          `).join("")}
        </ol>
      </section>
      <section class="poster-campus" id="campus">
        <figure>${picture("atrium")}</figure>
        <div class="poster-campus-copy">
          <h2>${highlights.title}</h2>
          <p>${highlights.body}</p>
          <p class="poster-campus-note">${highlights.note}</p>
        </div>
      </section>
    </main>
    <footer class="site-footer poster-footer">${footer()}</footer>`;
}

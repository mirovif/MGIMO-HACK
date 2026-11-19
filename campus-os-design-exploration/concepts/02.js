export default function renderEditorial({ site, hero, footer, picture, date }) {
  const { identity, education, news, events, highlights } = site;
  const [lead, ...notes] = news.items;

  return `
    <header class="hero editorial-hero">
      ${hero('<span>Учёба выходит</span> <span>за рамки <em>аудитории.</em></span>')}
    </header>
    <main id="content" class="editorial">
      <section class="editorial-intro editorial-page" id="university">
        <div class="editorial-intro-copy">
          <h2>${identity.title}</h2>
          <p>${identity.body}</p>
        </div>
        <figure class="editorial-intro-portrait">
          ${picture("atrium")}
        </figure>
      </section>
      <section class="editorial-education" id="education">
        <div class="editorial-education-title">
          <h2>${education.title}</h2>
          <figure>${picture("workshop")}</figure>
        </div>
        <div class="editorial-curriculum">
          <div class="editorial-programs">
            ${education.programs.map(program => `
              <article>
                <p class="editorial-meta">${program.level}</p>
                <h3>${program.title}</h3>
                <p>${program.body}</p>
              </article>
            `).join("")}
          </div>
          <article class="editorial-life">
            <h3>${education.life.title}</h3>
            <p>${education.life.body}</p>
          </article>
        </div>
      </section>
      <section class="editorial-news editorial-page" id="news">
        <h2>${news.title}</h2>
        <div class="editorial-news-spread">
          <article class="editorial-news-lead">
            <figure>${picture("courtyard")}</figure>
            <div>
              <p class="editorial-meta">${lead.category} <i aria-hidden="true"></i> ${date(lead)}</p>
              <h3>${lead.title}</h3>
              <p>${lead.body}</p>
            </div>
          </article>
          <div class="editorial-news-notes">
            ${notes.map(item => `
              <article>
                <p class="editorial-meta">${item.category} <i aria-hidden="true"></i> ${date(item)}</p>
                <h3>${item.title}</h3>
                <p>${item.body}</p>
              </article>
            `).join("")}
          </div>
        </div>
      </section>
      <section class="editorial-events editorial-page" id="events">
        <h2>${events.title}</h2>
        <ol>
          ${events.items.map(item => `
            <li>
              <div class="editorial-event-date">${date(item)}</div>
              <article>
                <h3>${item.title}</h3>
                <p>${item.body}</p>
              </article>
              <p class="editorial-event-place">
                <span>${item.time}</span>
                <span>${item.place}</span>
              </p>
            </li>
          `).join("")}
        </ol>
      </section>
      <section class="editorial-campus editorial-page" id="campus">
        <figure>${picture("garden")}</figure>
        <div class="editorial-campus-copy">
          <h2>${highlights.title}</h2>
          <p>${highlights.body}</p>
          <p class="editorial-campus-note">${highlights.note}</p>
        </div>
      </section>
    </main>
    <footer class="site-footer editorial-footer">${footer()}</footer>`;
}

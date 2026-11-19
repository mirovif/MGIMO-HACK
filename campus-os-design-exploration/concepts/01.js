export default function render({ site, hero, footer, picture, date }) {
  const { identity, education, news, events, highlights } = site;
  const [feature, ...newsIndex] = news.items;

  return `
    <header class="hero architectural-hero">
      ${hero('<span>Учёба выходит</span> <span>за рамки аудитории.</span>')}
    </header>
    <main id="content">
      <section id="university" class="blueprint introduction" aria-labelledby="identity-heading">
        <div class="wide-grid intro-text">
          <h2 id="identity-heading">${identity.title}</h2>
          <p>${identity.body}</p>
        </div>
        <figure>${picture('glass')}</figure>
      </section>
      <section id="education" class="blueprint curriculum" aria-labelledby="education-heading">
        <h2 id="education-heading">${education.title}</h2>
        <ul class="program-register">
          ${education.programs.map((program) => `
            <li>
              <span class="program-level">${program.level}</span>
              <h3>${program.title}</h3>
              <p>${program.body}</p>
            </li>`).join('')}
        </ul>
        <div class="student-life wide-grid">
          <div>
            <h3>${education.life.title}</h3>
            <p>${education.life.body}</p>
          </div>
          ${picture('atrium')}
        </div>
      </section>
      <section id="news" class="blueprint news-register" aria-labelledby="news-heading">
        <h2 id="news-heading">${news.title}</h2>
        <div class="news-layout">
          <article class="news-lead">
            ${picture('courtyard')}
            <div class="story-meta"><span>${feature.category}</span>${date(feature)}</div>
            <h3>${feature.title}</h3>
            <p>${feature.body}</p>
          </article>
          <div class="news-index">
            ${newsIndex.map((item) => `
              <article>
                <div class="story-meta"><span>${item.category}</span>${date(item)}</div>
                <h3>${item.title}</h3>
                <p>${item.body}</p>
              </article>`).join('')}
          </div>
        </div>
      </section>
      <section id="events" class="technical-calendar" aria-labelledby="events-heading">
        <div class="blueprint">
          <h2 id="events-heading">${events.title}</h2>
          <ol>
            ${events.items.map((item) => `
              <li>
                <time class="event-date" datetime="${item.datetime}"><strong>${item.day}</strong><span>${item.month}</span></time>
                <div><h3>${item.title}</h3><p>${item.body}</p></div>
                <p class="event-location"><span>${item.time}</span> <span>${item.place}</span></p>
              </li>`).join('')}
          </ol>
        </div>
      </section>
      <section id="campus" class="blueprint workshop-feature" aria-labelledby="campus-heading">
        <div class="workshop-copy">
          <h2 id="campus-heading">${highlights.title}</h2>
          <p>${highlights.body}</p>
          <p class="workshop-hours">${highlights.note}</p>
        </div>
        ${picture('workshop')}
      </section>
    </main>
    <footer class="site-footer">${footer()}</footer>`;
}

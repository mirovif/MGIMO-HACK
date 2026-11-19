export default function nightAtlas({ site, hero, footer, picture, date }) {
  const { identity, education, news, events, highlights } = site;
  const programs = education.programs.map((program) => `
    <article class="atlas-program">
      <p class="atlas-caption">${program.level}</p>
      <h3>${program.title}</h3>
      <p>${program.body}</p>
    </article>
  `).join('');
  const stories = news.items.map((story) => `
    <article class="atlas-story">
      <p class="atlas-caption atlas-story-date">${date(story)}</p>
      <div class="atlas-story-text">
        <h3>${story.title}</h3>
        <p>${story.body}</p>
      </div>
      <p class="atlas-caption atlas-category">${story.category}</p>
    </article>
  `).join('');
  const schedule = events.items.map((event) => `
    <article class="atlas-event">
      <time class="atlas-event-date" datetime="${event.datetime}">
        <span class="atlas-event-day">${event.day}</span>
        <span class="atlas-caption">${event.month}</span>
      </time>
      <div class="atlas-event-copy">
        <h3>${event.title}</h3>
        <p>${event.body}</p>
        <p class="atlas-caption atlas-event-place">${event.time} · ${event.place}</p>
      </div>
    </article>
  `).join('');

  return `
    <header class="hero atlas-hero">
      ${hero('<span>Учёба выходит</span> <span>за рамки аудитории.</span>')}
    </header>
    <main id="content" class="atlas-main">
      <section id="university" class="atlas-intro">
        <div class="atlas-intro-copy">
          <h2>${identity.title}</h2>
          <p>${identity.body}</p>
        </div>
        <div class="atlas-intro-photo">${picture('atrium')}</div>
      </section>

      <section id="education" class="atlas-education">
        <div class="atlas-education-entries">
          <h2>${education.title}</h2>
          <div class="atlas-program-list">${programs}</div>
        </div>
        <article class="atlas-life">
          <div class="atlas-life-photo">${picture('workshop')}</div>
          <div class="atlas-life-copy">
            <h3>${education.life.title}</h3>
            <p>${education.life.body}</p>
          </div>
        </article>
      </section>

      <section id="news" class="atlas-news">
        <h2>${news.title}</h2>
        <div class="atlas-news-list">${stories}</div>
      </section>

      <section id="events" class="atlas-events">
        <h2>${events.title}</h2>
        <div class="atlas-event-list">${schedule}</div>
      </section>

      <section id="campus" class="atlas-campus">
        <div class="atlas-campus-copy">
          <h2>${highlights.title}</h2>
          <p>${highlights.body}</p>
        </div>
        <figure class="atlas-campus-figure">
          ${picture('courtyard')}
          <figcaption class="atlas-caption">${highlights.note}</figcaption>
        </figure>
      </section>
    </main>
    <footer class="site-footer atlas-footer">${footer()}</footer>
  `;
}

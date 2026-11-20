const members = [
  {
    name: 'Имя Фамилия',
    role: 'Разработка',
    university: '[Название университета]',
    contribution: 'Интерфейс и логика студенческого кабинета.',
    achievements: '[Достижения и регалии]',
    photoSrc: '',
  },
  {
    name: 'Имя Фамилия',
    role: 'Дизайн',
    university: '[Название университета]',
    contribution: 'Визуальная система и навигация.',
    achievements: '[Достижения и регалии]',
    photoSrc: '',
  },
  {
    name: 'Имя Фамилия',
    role: 'Исследования',
    university: '[Название университета]',
    contribution: 'Студенческие сценарии и обратная связь.',
    achievements: '[Достижения и регалии]',
    photoSrc: '',
  },
];

const htmlEntities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escapeHtml = (value) => value.replace(/[&<>"]/g, (character) => htmlEntities[character]);

function memberMarkup({ name, role, university, contribution, achievements, photoSrc }) {
  return `
    <li class="relief-team-member">
      <div class="relief-team-portrait" data-team-reveal aria-hidden="true">
        ${photoSrc ? `<img src="${escapeHtml(photoSrc)}" alt="" loading="lazy" decoding="async">` : ''}
      </div>
      <div class="relief-team-member-info" data-team-reveal>
        <h3>${escapeHtml(name)}</h3>
        <p class="relief-team-role">${escapeHtml(role)}</p>
        <p class="relief-team-university">${escapeHtml(university)}</p>
        ${contribution ? `<p class="relief-team-contribution">${escapeHtml(contribution)}</p>` : ''}
        ${achievements ? `<p class="relief-team-achievements">${escapeHtml(achievements)}</p>` : ''}
      </div>
    </li>`;
}

export const teamMarkup = `
  <section class="relief-team relief-wrap" id="team" aria-labelledby="relief-team-title">
    <header class="relief-team-intro">
      <h2 id="relief-team-title" data-team-reveal>Люди за <span>UTRET.</span></h2>
      <div class="relief-team-copy" data-team-reveal>
        <p>Мы студенты разных университетов, которых объединила одна идея: сделать взаимодействие с университетом проще и интереснее.</p>
        <p>UTRET начался с желания пересмотреть привычный студенческий кабинет. Мы объединили разработку, дизайн и собственный студенческий опыт, чтобы создать то, чем хотели бы пользоваться сами.</p>
      </div>
    </header>
    <ul class="relief-team-members" role="list">
      ${members.map(memberMarkup).join('')}
    </ul>
  </section>`;

export function mountTeam(section) {
  if (!section || typeof IntersectionObserver !== 'function') return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      entry.target.setAttribute('data-team-visible', '');
    }
  }, { rootMargin: '40px 0px' });

  for (const target of section.querySelectorAll('[data-team-reveal]')) {
    observer.observe(target);
  }
}

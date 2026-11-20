const members = [
  {
    name: 'Шварц Артемий',
    photoSrc: '../assets/team-artemiy.webp',
    bio: [
      'Стажёр-разработчик в Сбере',
      'Стажёр-исследователь в Сколтехе',
      'Студент РЭУ им. Г. В. Плеханова, ВШФ',
    ],
  },
  {
    name: 'Максим Чибисов',
    photoSrc: '../assets/team-maxim.webp',
    bio: [
      'Студент программы «ТОП-ИИ», РЭУ им. Г. В. Плеханова',
      'Стажёр-разработчик в Сбере',
      'Студент Школы 21',
    ],
  },
  {
    name: 'Иван Мирошкин',
    photoSrc: '../assets/team-ivan.webp',
    bio: [
      'Студент программы «ТОП-ИИ», РЭУ им. Г. В. Плеханова',
      'Руководитель Data Science Club',
      'Стажёр-разработчик в Сбере',
      'Студент Школы 21',
    ],
  },
];

const htmlEntities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escapeHtml = (value) => value.replace(/[&<>"]/g, (character) => htmlEntities[character]);

function memberMarkup({ name, photoSrc, bio }) {
  return `
    <li class="relief-team-member">
      <div class="relief-team-portrait" data-team-reveal aria-hidden="true">
        ${photoSrc ? `<img src="${escapeHtml(photoSrc)}" alt="" loading="lazy" decoding="async">` : ''}
      </div>
      <div class="relief-team-member-info" data-team-reveal>
        <h3>${escapeHtml(name)}</h3>
        <ul class="relief-team-bio" role="list">
          ${bio.map((detail) => `<li>${escapeHtml(detail)}</li>`).join('')}
        </ul>
      </div>
    </li>`;
}

export const teamMarkup = `
  <section class="relief-team relief-wrap" id="team" aria-labelledby="relief-team-title">
    <header class="relief-team-intro">
      <h2 id="relief-team-title" data-team-reveal>Люди за <span>UTRET.</span></h2>
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

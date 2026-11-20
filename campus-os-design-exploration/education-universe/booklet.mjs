const ticketFields = [
  ['Владелец:', 'Ты'],
  ['Пункт назначения:', 'Твоя мечта'],
  ['Дата отправления:', 'Сегодня'],
  ['Срок действия:', 'Без ограничений'],
];

const lifeGrades = [
  ['Настроение', 'Зачёт'],
  ['Уверенность в себе', 'Зачёт'],
  ['Готовность побеждать', 'Зачёт'],
  ['Гениальные идеи в 3 ночи', 'Отлично'],
  ['Умение не сдаваться', 'Зачёт'],
  ['Прокрастинация', 'Пересдача'],
  ['Вера в себя', 'Автомат'],
];

function entryMarkup(entries) {
  return entries.map(([label, value]) =>
    `<div class="student-id-entry"><dt>${label}</dt><dd>${value}</dd></div>`
  ).join('');
}

function identityPage() {
  return `
    <div class="student-id-paper student-id-identity">
      <strong class="student-id-paper-title">Билет в будущее</strong>
      <div class="student-id-form">
        <div class="student-id-silhouette"></div>
        <dl class="student-id-fields">${entryMarkup(ticketFields)}</dl>
      </div>
      <p class="student-id-motto"><strong>Создавай своё будущее.</strong><br>Маршрут выбираешь ты.</p>
    </div>`;
}

function gradesPage() {
  return `
    <div class="student-id-paper student-id-gradebook">
      <strong class="student-id-paper-title">Зачёты по жизни</strong>
      <dl class="student-id-grades">${entryMarkup(lifeGrades)}</dl>
      <p class="student-id-verdict">Решение комиссии: <strong>к большому будущему допущен.</strong></p>
    </div>`;
}

export function bookletMarkup() {
  return `
    <div id="student-id" class="student-id-experience" role="img" aria-label="Студенческий билет с разворотом «Билет в будущее» и «Зачёты по жизни»">
      <div class="student-id-stage" aria-hidden="true">
        <div class="student-id-scene">
          <div class="student-id-model">
            <div class="student-id-back student-id-leather">
              ${gradesPage()}
            </div>
            <div class="student-id-spine"></div>
            <div class="student-id-cover">
              <div class="student-id-front student-id-leather">
                <span class="student-id-stamp">Студенческий билет</span>
              </div>
              <div class="student-id-reverse student-id-leather">
                ${identityPage()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

export function mountBooklet(section) {
  if (section && CSS.supports('animation-timeline: view()') &&
      CSS.supports('animation-range: exit-crossing 0% exit-crossing 48%')) {
    section.dataset.scrollMotion = '';
  }
}

const fields = ['Фамилия', 'Имя', 'Отчество', 'Факультет', 'Форма обучения'];

function identityPage() {
  return `
    <div class="student-id-paper student-id-identity">
      <strong class="student-id-paper-title">Студенческий билет <span>№ <i></i></span></strong>
      <div class="student-id-form">
        <div class="student-id-photo">
          <div class="student-id-silhouette"></div>
          <span>М. П.</span>
        </div>
        <div class="student-id-fields">
          ${fields.map((field) => `<div class="student-id-entry"><span>${field}</span><i></i></div>`).join('')}
          <div class="student-id-entry"><span>Дата выдачи</span><i></i><span>20</span><i></i><span>г.</span></div>
        </div>
      </div>
    </div>`;
}

function renewalPage() {
  const block = `
    <div class="student-id-renewal-entry">
      <div class="student-id-entry"><span>Продлён по</span><i></i><span>20</span><i></i><span>г.</span></div>
      <div class="student-id-entry"><span>Декан</span><i></i><span>М. П.</span></div>
    </div>`;
  return `
    <div class="student-id-paper student-id-renewal">
      <strong class="student-id-paper-title">Продлён</strong>
      ${block.repeat(3)}
    </div>`;
}

export function bookletMarkup() {
  return `
    <div id="student-id" class="student-id-experience" role="img" aria-label="Макет студенческого билета">
      <div class="student-id-stage" aria-hidden="true">
        <div class="student-id-scene">
          <div class="student-id-model">
            <div class="student-id-back student-id-leather">
              ${renewalPage()}
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

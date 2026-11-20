export const kametaMarkup = `
  <section id="kameta" class="relief-kameta relief-wrap" aria-labelledby="relief-kameta-title">
    <h2 id="relief-kameta-title">Знакомься, <span>Камета</span></h2>
    <div class="relief-kameta-art" role="img" aria-label="Лавандовый робот Камета с орбитальным кольцом">
      <div class="relief-kameta-character">
        <img class="relief-kameta-body" src="../assets/kameta.webp" width="1122" height="1402"
          alt="" loading="lazy" decoding="async">
        <img class="relief-kameta-arm" src="../assets/kameta.webp" width="1122" height="1402"
          alt="" loading="lazy" decoding="async">
      </div>
    </div>
    <p>Камета - ИИ-помощник UTRET, который поможет разобраться в университетских вопросах. Он ориентируется во внутренней структуре вуза, его правилах и документах. Не знаешь, как получить справку, куда подать заявление или к кому обратиться? Просто спроси Камету, и он подскажет, что делать.</p>
  </section>`;

export function mountKameta(section) {
  if (typeof IntersectionObserver !== 'function') return;

  const art = section.querySelector('.relief-kameta-art');
  const arm = art.querySelector('.relief-kameta-arm');
  const motion = matchMedia('(prefers-reduced-motion: no-preference)');
  let greeted = false;

  function stopGreeting() {
    art.classList.remove('is-greeting');
  }

  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) {
      greeted = false;
      stopGreeting();
    } else if (!greeted && motion.matches && entry.intersectionRatio >= .35) {
      greeted = true;
      art.classList.add('is-greeting');
    }
  }, { threshold: [0, .35] });

  arm.addEventListener('animationend', stopGreeting);
  motion.addEventListener('change', stopGreeting);
  const images = Array.from(art.querySelectorAll('img'), image => image.decode?.());
  Promise.all(images).then(() => observer.observe(art), () => {});
}

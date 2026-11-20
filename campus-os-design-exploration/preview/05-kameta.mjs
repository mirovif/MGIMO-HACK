export const kametaMarkup = `
  <section id="kameta" class="relief-kameta relief-wrap" aria-labelledby="relief-kameta-title">
    <h2 id="relief-kameta-title">Знакомься, <span>Комета</span></h2>
    <div class="relief-kameta-art" role="img" aria-label="Лавандовый робот Комета с орбитальным кольцом">
      <div class="relief-kameta-character">
        <img class="kameta-body" src="../assets/kameta.webp" width="1122" height="1402"
          alt="" loading="lazy" decoding="async">
        <img class="kameta-arm" src="../assets/kameta.webp" width="1122" height="1402"
          alt="" loading="lazy" decoding="async">
      </div>
    </div>
    <div class="relief-kameta-copy">
      <p>Комета подскажет, где заказать справку, найти расписание пересдач или связаться с деканатом. К ответам по материалам РЭУ он прикладывает ссылку на источник.</p>
      <a class="relief-action" href="/lks#app/assistant">Спросить Комету</a>
    </div>
  </section>`;

export function mountKameta(section) {
  if (typeof IntersectionObserver !== 'function') return;

  const art = section.querySelector('.relief-kameta-art');
  const arm = art.querySelector('.kameta-arm');
  const motion = matchMedia('(prefers-reduced-motion: no-preference)');
  let greeted = false;

  function stopGreeting() {
    art.classList.remove('kameta-wave');
  }

  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) {
      greeted = false;
      stopGreeting();
    } else if (!greeted && motion.matches && entry.intersectionRatio >= .35) {
      greeted = true;
      art.classList.add('kameta-wave');
    }
  }, { threshold: [0, .35] });

  arm.addEventListener('animationend', stopGreeting);
  motion.addEventListener('change', stopGreeting);
  const images = Array.from(art.querySelectorAll('img'), image => image.decode?.());
  Promise.all(images).then(() => observer.observe(art), () => {});
}

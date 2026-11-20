export const storyMarkup = `
  <section id="campus" class="relief-story" aria-labelledby="relief-story-title">
    <div class="relief-story-pin relief-wrap">
      <h2 id="relief-story-title" class="relief-story-title relief-story-panel">
        <span data-story-cue>UTRET.</span>
        <span data-story-cue>Это вселенная.</span>
      </h2>
      <div class="relief-story-panel relief-story-copy" data-story-cue>
        <h3>У каждого университета своя система.</h3>
        <p>Свои факультеты, направления, программы и дисциплины. UTRET создан так, чтобы его можно было адаптировать под структуру любого вуза.</p>
      </div>
      <div class="relief-story-panel relief-story-copy" data-story-cue>
        <h3>Мы сделали её видимой.</h3>
        <p>Вместо бесконечных списков и сложной навигации здесь интерактивная карта. Направления, программы и предметы связаны в единую систему, которую можно исследовать.</p>
      </div>
      <div class="relief-story-panel relief-story-finale" data-story-cue>
        <h3><span>Теперь университет можно не&nbsp;только изучать.</span> <span>По нему можно перемещаться.</span></h3>
      </div>
    </div>
  </section>`;

// Each exit ends before the next block enters. Only the two title lines share the screen.
const cueRanges = [
  { enter: [-.105, -.01], exit: [.197, .24] },
  { enter: [.038, .109], exit: [.197, .24] },
  { enter: [.24, .287], exit: [.402, .449] },
  { enter: [.449, .497], exit: [.629, .677] },
  { enter: [.677, .729] },
];

function easeBetween(progress, [start, end]) {
  const t = Math.max(0, Math.min(1, (progress - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

export function mountStory(story) {
  if (typeof IntersectionObserver !== 'function') return;

  const pin = story.querySelector('.relief-story-pin');
  const cues = [...story.querySelectorAll('[data-story-cue]')];
  const panels = story.querySelectorAll('.relief-story-panel');
  const motion = matchMedia('(prefers-reduced-motion: no-preference)');
  const wide = matchMedia('screen and (min-width: 801px) and (min-height: 37.5em)');
  const previousOpacity = [];
  let frame = 0;

  function draw() {
    frame = 0;
    const bounds = story.getBoundingClientRect();
    const scrollDistance = bounds.height - pin.offsetHeight;
    const progress = -bounds.top / scrollDistance;

    cueRanges.forEach(({ enter, exit }, index) => {
      const opacity = easeBetween(progress, enter) * (exit ? 1 - easeBetween(progress, exit) : 1);
      if (opacity === previousOpacity[index]) return;
      cues[index].style.setProperty('--story-reveal', opacity);
      previousOpacity[index] = opacity;
    });
  }

  function scheduleDraw() {
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function stopDrawing() {
    window.removeEventListener('scroll', scheduleDraw);
    cancelAnimationFrame(frame);
    frame = 0;
  }

  const watchStory = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      window.addEventListener('scroll', scheduleDraw, { passive: true });
      scheduleDraw();
    } else {
      stopDrawing();
    }
  });

  const watchPanels = new IntersectionObserver((entries, observer) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px' });

  function applyLayout() {
    watchStory.disconnect();
    watchPanels.disconnect();
    stopDrawing();
    window.removeEventListener('resize', scheduleDraw);

    if (!motion.matches) {
      delete story.dataset.storyMode;
    } else if (wide.matches) {
      story.dataset.storyMode = 'sticky';
      draw();
      watchStory.observe(story);
      window.addEventListener('resize', scheduleDraw, { passive: true });
    } else {
      story.dataset.storyMode = 'flow';
      for (const panel of panels) watchPanels.observe(panel);
    }
  }

  motion.addEventListener('change', applyLayout);
  wide.addEventListener('change', applyLayout);
  applyLayout();
}

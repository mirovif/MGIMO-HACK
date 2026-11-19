import { navigation, site } from './content.mjs';

const requested = new URL(location.href).searchParams.get('concept');
const concept = /^0[1-5]$/.test(requested) ? requested : '01';
document.body.dataset.concept = concept;

const editorialMedia = {
  atrium: [1536, 1024, 'Студенты обсуждают проект в атриуме'],
  workshop: [1536, 1024, 'Студенты собирают макет в мастерской'],
  courtyard: [575, 400, 'Геометрия фасада кампуса'],
  glass: [1280, 720, 'Стеклянный корпус кампуса'],
  garden: [1046, 391, 'Соцветия гортензии в саду'],
};

const links = () => navigation.map(([id, label]) => `<a href="#${id}">${label}</a>`).join('');

function hero(headlineMarkup) {
  return `
    <div class="hero-media" aria-hidden="true">
      <img class="hero-poster" src="./assets/campus-still.webp" width="1280" height="720" alt="" fetchpriority="high">
      <video class="hero-video" muted autoplay loop playsinline preload="none" tabindex="-1" disablepictureinpicture></video>
    </div>
    <a class="skip-link" href="#content">К содержанию</a>
    <div class="site-header">
      <a class="wordmark" href="#top" aria-label="Campus OS, к началу страницы">Campus<span> OS</span></a>
      <nav class="desktop-nav" aria-label="Основная навигация">${links()}</nav>
      <button class="account-link" type="button" aria-disabled="true">Личный кабинет</button>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-nav">Меню</button>
      <nav id="mobile-nav" class="mobile-nav" aria-label="Навигация по разделам" hidden>${links()}</nav>
    </div>
    <h1 class="hero-title">${headlineMarkup}</h1>`;
}

function footer() {
  return `
    <div class="footer-inner">
      <a class="footer-wordmark" href="#top">Campus OS</a>
      <p class="footer-disclaimer">${site.disclaimer}</p>
      <a class="footer-top" href="#top">К началу</a>
    </div>`;
}

function picture(name, extraClass = '') {
  const [width, height, alt] = editorialMedia[name];
  return `<img class="editorial-image ${extraClass}" src="./assets/${name}.webp" width="${width}" height="${height}" alt="${alt}" fetchpriority="low" decoding="async">`;
}

function date(item) {
  return `<time datetime="${item.datetime}">${item.date}</time>`;
}

function loadTheme() {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `./concepts/${concept}.css`;
  const loaded = new Promise((resolve, reject) => {
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', reject, { once: true });
  });
  document.head.append(link);
  return loaded;
}

function mediaPlayback() {
  const video = document.querySelector('.hero-video');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const showPoster = () => video.classList.remove('is-playing');

  function applyMotionPreference() {
    if (reducedMotion.matches) {
      showPoster();
      video.pause();
      video.removeAttribute('src');
      video.load();
      return;
    }

    video.muted = true;
    video.src = './assets/campus.mp4';
    video.play().catch(showPoster);
  }

  video.addEventListener('playing', () => {
    if (!reducedMotion.matches) video.classList.add('is-playing');
  });
  video.addEventListener('error', showPoster);
  reducedMotion.addEventListener('change', applyMotionPreference);
  applyMotionPreference();
}

function navigationMenu() {
  const trigger = document.querySelector('.menu-toggle');
  const mobile = document.querySelector('#mobile-nav');
  const desktopQuery = matchMedia('(min-width: 801px)');

  function setOpen(open) {
    trigger.setAttribute('aria-expanded', String(open));
    trigger.textContent = open ? 'Закрыть' : 'Меню';
    mobile.hidden = !open;
  }

  trigger.addEventListener('click', () => setOpen(mobile.hidden));
  mobile.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link) return;
    setOpen(false);
    const target = document.getElementById(link.hash.slice(1));
    target.tabIndex = -1;
    target.focus({ preventScroll: true });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !mobile.hidden) {
      setOpen(false);
      trigger.focus();
    }
  });
  desktopQuery.addEventListener('change', ({ matches }) => {
    if (matches) setOpen(false);
  });
}

try {
  const [{ default: render }] = await Promise.all([
    import(`./concepts/${concept}.js`),
    loadTheme(),
  ]);
  document.body.insertAdjacentHTML('afterbegin', render({ site, hero, footer, picture, date }));
  document.querySelector('.hero').id = 'top';
  document.querySelector('#content').tabIndex = -1;
  navigationMenu();
  mediaPlayback();

  const fragmentTarget = document.getElementById(location.hash.slice(1));
  if (fragmentTarget) fragmentTarget.scrollIntoView();
} catch (error) {
  console.error(error);
  const status = document.createElement('p');
  status.className = 'load-error';
  status.textContent = 'Не удалось открыть концепт. Обновите страницу.';
  document.body.append(status);
}

import { navigation, site } from '../content.mjs';

export { navigation, site };

const media = {
  courtyard: [575, 400, 'Геометрия фасада кампуса'],
  workshop: [1536, 1024, 'Студенты собирают макет в мастерской'],
  glass: [1280, 720, 'Стеклянный корпус кампуса'],
  atrium: [1536, 1024, 'Студенты обсуждают проект в атриуме'],
  garden: [1046, 391, 'Соцветия гортензии в саду'],
};

export function picture(name, extraClass = '') {
  const [width, height, alt] = media[name];
  return `<img class="editorial-image ${extraClass}" src="../assets/${name}.webp" width="${width}" height="${height}" alt="${alt}" decoding="async" loading="lazy">`;
}

export function date({ datetime, date: label }) {
  return `<time datetime="${datetime}">${label}</time>`;
}

export function navigationLinks(items = navigation) {
  return items.map(([id, label]) => `<a href="#${id}">${label}</a>`).join('');
}

export function header(siteName, items = navigation, cabinetUrl) {
  const links = navigationLinks(items);
  const cabinet = cabinetUrl
    ? `<a class="account-link" href="${cabinetUrl}">Личный кабинет</a>`
    : '<button class="account-link" type="button" aria-disabled="true">Личный кабинет</button>';
  return `
    <a class="skip-link" href="#content">К содержанию</a>
    <div class="preview-header">
      <a class="wordmark" href="#top" aria-label="${siteName ?? 'Campus OS'}, к началу страницы">${siteName ?? 'Campus<span> OS</span>'}</a>
      <nav class="desktop-nav" aria-label="Основная навигация">${links}</nav>
      ${cabinet}
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-nav">Меню</button>
      <nav id="mobile-nav" class="mobile-nav" aria-label="Навигация по разделам" hidden>${links}</nav>
    </div>`;
}

export function videoMarkup({ src = '../assets/campus-still.webp', width = 1280, height = 720 } = {}) {
  return `
    <div class="hero-media" aria-hidden="true">
      <img class="hero-poster" src="${src}" width="${width}" height="${height}" alt="" fetchpriority="high">
      <video class="hero-video" muted autoplay loop playsinline preload="none" tabindex="-1" disablepictureinpicture></video>
    </div>`;
}

function startVideo(source) {
  const video = document.querySelector('.hero-video');
  const poster = video.parentElement.querySelector('.hero-poster');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const showPoster = () => video.classList.remove('is-playing');
  let heroVisible = false;
  let posterReady = false;

  function resumeVisibleVideo() {
    if (!posterReady || !heroVisible || document.hidden || reducedMotion.matches ||
        !video.paused || video.error || document.documentElement.hasAttribute('data-preview-inactive')) return;
    if (!video.hasAttribute('src')) video.src = source;
    video.play().catch(() => {
      if (video.paused) showPoster();
    });
  }

  function applyMotionPreference() {
    if (reducedMotion.matches) {
      showPoster();
      video.pause();
      video.removeAttribute('src');
      video.load();
      return;
    }

    resumeVisibleVideo();
  }

  video.addEventListener('playing', () => {
    if (!reducedMotion.matches) video.classList.add('is-playing');
  });
  video.addEventListener('pause', () => {
    if (video.paused) showPoster();
  });
  video.addEventListener('error', showPoster);
  reducedMotion.addEventListener('change', applyMotionPreference);
  new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting && entry.intersectionRatio >= .1;
    resumeVisibleVideo();
  }, { threshold: .1 }).observe(video.parentElement);
  document.addEventListener('visibilitychange', resumeVisibleVideo);
  document.addEventListener('campus-preview-visibility', resumeVisibleVideo);
  window.addEventListener('pageshow', resumeVisibleVideo);

  video.muted = true;
  poster.decode().catch(() => {}).then(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      posterReady = true;
      resumeVisibleVideo();
    }));
  });
}

function startMenu() {
  const trigger = document.querySelector('.menu-toggle');
  const menu = document.querySelector('#mobile-nav');
  const desktop = matchMedia('(min-width: 801px)');

  function setOpen(open) {
    trigger.setAttribute('aria-expanded', String(open));
    trigger.textContent = open ? 'Закрыть' : 'Меню';
    menu.hidden = !open;
  }

  trigger.addEventListener('click', () => setOpen(menu.hidden));
  menu.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const target = document.getElementById(link.hash.slice(1));
    if (!target) return;
    setOpen(false);
    target.tabIndex = -1;
    target.focus({ preventScroll: true });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) {
      event.preventDefault();
      setOpen(false);
      trigger.focus();
    }
  });
  desktop.addEventListener('change', ({ matches }) => {
    if (matches) setOpen(false);
  });
}

export function startPage({ videoSource = '../assets/campus.mp4' } = {}) {
  document.getElementById('content').tabIndex = -1;
  startMenu();
  startVideo(videoSource);
  document.getElementById(location.hash.slice(1))?.scrollIntoView();
}

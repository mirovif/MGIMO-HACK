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

export function header(siteName, items = navigation) {
  const links = navigationLinks(items);
  return `
    <a class="skip-link" href="#content">К содержанию</a>
    <div class="preview-header">
      <a class="wordmark" href="#top" aria-label="${siteName ?? 'Campus OS'}, к началу страницы">${siteName ?? 'Campus<span> OS</span>'}</a>
      <nav class="desktop-nav" aria-label="Основная навигация">${links}</nav>
      <button class="account-link" type="button" aria-disabled="true">Личный кабинет</button>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-nav">Меню</button>
      <nav id="mobile-nav" class="mobile-nav" aria-label="Навигация по разделам" hidden>${links}</nav>
    </div>`;
}

export function videoMarkup() {
  return `
    <div class="hero-media" aria-hidden="true">
      <img class="hero-poster" src="../assets/campus-still.webp" width="1280" height="720" alt="" fetchpriority="high">
      <video class="hero-video" muted autoplay loop playsinline preload="none" tabindex="-1" disablepictureinpicture></video>
    </div>`;
}

function startVideo() {
  const video = document.querySelector('.hero-video');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const showPoster = () => video.classList.remove('is-playing');
  let heroVisible = false;

  function playVideo() {
    if (reducedMotion.matches || !video.paused || video.error) return;
    video.play().catch(() => {
      if (video.paused) showPoster();
    });
  }

  function resumeVisibleVideo() {
    if (!heroVisible || document.hidden || document.documentElement.hasAttribute('data-preview-inactive')) return;
    playVideo();
  }

  function applyMotionPreference() {
    if (reducedMotion.matches) {
      showPoster();
      video.pause();
      video.removeAttribute('src');
      video.load();
      return;
    }

    video.muted = true;
    video.src = '../assets/campus.mp4';
    playVideo();
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
  applyMotionPreference();
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

export function startPage() {
  document.getElementById('content').tabIndex = -1;
  startMenu();
  startVideo();
  document.getElementById(location.hash.slice(1))?.scrollIntoView();
}

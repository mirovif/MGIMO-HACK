const variants = [
  ['01', 'Оригинал', '../home.html?concept=04', ['#2E2D2B', '#FAFAF6', '#FEF10C', '#18313A', '#F6E8CF']],
  ['02', 'Оптический зал', './02.html', ['#F3F7FF', '#CFDBF7', '#315CE8', '#20336E', '#829DDA']],
  ['03', 'Архитектурный журнал', './03.html', ['#F3E7D8', '#701D2E', '#A84C45', '#D9BAA8', '#38242D']],
  ['04', 'Сдвиг', './04.html', ['#F9E6D3', '#F2AB82', '#F95032', '#A82C24', '#432D2D']],
  ['05', 'Графитовый рельеф', './05.html', ['#141C26', '#384552', '#AEBDCB', '#BBCEDF', '#F4F3EF']],
];

const comparison = document.querySelector('#comparison');
const tablist = document.querySelector('.tabs');
const stage = document.querySelector('#stage');
const palette = document.querySelector('#palette');
const paletteTrigger = document.querySelector('#palette-trigger');
const restore = document.querySelector('#restore');
const fullscreen = document.querySelector('#fullscreen');
const variantName = document.querySelector('#variant-name');

tablist.innerHTML = variants.map(([id, name]) =>
  `<button type="button" role="tab" id="tab-${id}" aria-controls="panel-${id}" aria-label="${id} — ${name}" title="${name}">${id}</button>`
).join('');

stage.innerHTML = variants.map(([id]) =>
  `<section role="tabpanel" id="panel-${id}" aria-labelledby="tab-${id}"></section>`
).join('');

palette.innerHTML = variants.map(([id, name, , colors]) => `
  <article>
    <h2>${id} · ${name}</h2>
    <ul class="swatches">${colors.map((hex) =>
      `<li><span style="--swatch: ${hex}" aria-hidden="true"></span>${hex}</li>`
    ).join('')}</ul>
  </article>`).join('');

const tabs = [...tablist.children];
const panels = [...stage.children];
let activeIndex;

function locationIndex() {
  const id = new URL(location.href).searchParams.get('style');
  return Math.max(0, variants.findIndex(([variant]) => variant === id));
}

function syncEffectVisibility(panel, frame = panel.firstElementChild) {
  if (panel.id === 'panel-01' || !frame?.contentDocument?.documentElement) return;
  const doc = frame.contentDocument;
  doc.documentElement.toggleAttribute('data-preview-inactive', panel.inert);
  doc.dispatchEvent(new Event('campus-preview-visibility'));
}

function activate(index, updateURL = false) {
  const [id, name, url] = variants[index];
  const panel = panels[index];

  tabs.forEach((tab, position) => {
    const selected = position === index;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    panels[position].inert = !selected;
    if (selected) panels[position].removeAttribute('aria-hidden');
    else panels[position].setAttribute('aria-hidden', 'true');
    palette.children[position].classList.toggle('is-current', selected);
    syncEffectVisibility(panels[position]);
  });

  if (!panel.firstElementChild) {
    const frame = document.createElement('iframe');
    frame.title = `Campus OS · ${id} — ${name}`;
    frame.allow = 'autoplay; fullscreen';
    frame.src = url;
    frame.addEventListener('load', () => {
      frame.contentWindow.addEventListener('keydown', reopenOnEscape);
      syncEffectVisibility(panel, frame);
    });
    panel.append(frame);
  }

  if (updateURL && index !== activeIndex) {
    const next = new URL(location.href);
    next.searchParams.set('style', id);
    history.pushState(null, '', next);
  }
  variantName.textContent = name;
  activeIndex = index;
}

function setPalette(open) {
  palette.hidden = !open;
  paletteTrigger.setAttribute('aria-expanded', String(open));
}

function setControls(visible) {
  if (!visible) setPalette(false);
  comparison.hidden = !visible;
  restore.hidden = visible;
  (visible ? tabs[activeIndex] : restore).focus({ preventScroll: true });
}

function reopenOnEscape(event) {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  if (comparison.hidden && !document.fullscreenElement) {
    setControls(true);
  } else if (!palette.hidden) {
    setPalette(false);
    paletteTrigger.focus();
  }
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activate(index, true));
  tab.addEventListener('keydown', (event) => {
    const destinations = {
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      ArrowRight: (index + 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    };
    const next = destinations[event.key];
    if (next === undefined) return;
    event.preventDefault();
    activate(next, true);
    tabs[next].focus();
  });
});

paletteTrigger.addEventListener('click', () => setPalette(palette.hidden));
document.addEventListener('pointerdown', (event) => {
  if (!palette.hidden && !comparison.contains(event.target)) setPalette(false);
});
document.querySelector('#hide').addEventListener('click', () => setControls(false));

fullscreen.addEventListener('click', async () => {
  try {
    if (document.fullscreenEnabled) await document.documentElement.requestFullscreen();
  } catch {
    // The reading view also works where the fullscreen API is unavailable.
  }
  setControls(false);
});

restore.addEventListener('click', async () => {
  if (document.fullscreenElement) await document.exitFullscreen();
  setControls(true);
});

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && comparison.hidden) setControls(true);
});
document.addEventListener('keydown', reopenOnEscape);
window.addEventListener('popstate', () => activate(locationIndex()));
activate(locationIndex());

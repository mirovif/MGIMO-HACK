(() => {
  'use strict';

  const catalog = window.REFERENCE_CATALOG;
  const styles = window.REFERENCE_STYLES;
  const analyses = window.REFERENCE_ANALYSIS || {};
  const byId = new Map(catalog.map((reference) => [reference.id, reference]));
  const stylesById = new Map(styles.map((style) => [style.id, style]));
  const get = (id) => document.getElementById(id);
  const gallery = get('gallery');
  const filters = get('style-filters');
  const search = get('search');
  const searchClear = get('search-clear');
  const collectionTitle = get('collection-title');
  const resultCount = get('result-count');
  const emptyState = get('empty-state');
  const emptyTitle = get('empty-title');
  const emptyCopy = get('empty-copy');
  const emptyReset = get('empty-reset');
  const savedCount = get('saved-count');
  const viewer = get('viewer');
  const viewerMedia = get('viewer-media');
  const viewerTitle = get('viewer-title');
  const viewerDescription = get('viewer-description');
  const viewerStyle = get('viewer-style');
  const viewerTags = get('viewer-tags');
  const viewerDetails = get('viewer-details');
  const viewerAnalysis = get('viewer-analysis');
  const viewerTypography = get('viewer-typography');
  const viewerFontType = get('viewer-font-type');
  const viewerPalette = get('viewer-palette');
  const viewerPaletteNote = get('viewer-palette-note');
  const viewerComposition = get('viewer-composition');
  const viewerTechniques = get('viewer-techniques');
  const viewerPrompt = get('viewer-prompt');
  const viewerFontSource = get('viewer-font-source');
  const copyStatus = get('viewer-copy-status');
  const viewerPosition = get('viewer-position');
  const viewerPrevious = get('viewer-prev');
  const viewerNext = get('viewer-next');
  const viewerOriginal = get('viewer-original');
  const viewerSource = get('viewer-source');
  const viewerSave = get('viewer-save');
  const viewerZoom = get('viewer-zoom');
  const navLinks = document.querySelectorAll('#collection-nav [data-view]');
  const savedKey = 'design-inspiration-library:saved';
  const referencePlural = new Intl.PluralRules('ru');
  const referenceNouns = {one: 'референс', few: 'референса', many: 'референсов', other: 'референса'};

  const styleAliases = {
    minimalism: 'минимализм минималистичный',
    editorial: 'редакционный журнальный верстка вёрстка типографика',
    brutalism: 'брутализм бруталистский необрутализм',
    glassmorphism: 'глассморфизм стекло прозрачность размытие',
    futurism: 'футуризм футуристический технологии tech',
    cinematic: 'кинематографичный кино иммерсивный',
    organic: 'органика природный натуральный',
    retro: 'ретро винтаж vintage',
    maximalism: 'максимализм',
    collage: 'коллаж фотомонтаж',
    typography: 'типографика шрифтовой дизайн',
  };

  function normalize(text) {
    return text.toLocaleLowerCase('ru').normalize('NFKD')
      .replace(/\p{M}+/gu, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }

  const searchIndex = new Map(catalog.map((reference) => {
    const style = stylesById.get(reference.style);
    const analysis = analyses[reference.id];
    const text = [
      reference.title, reference.description, reference.style, style?.label,
      styleAliases[reference.style], style?.aliases, ...(reference.tags || []),
      analysis?.fontType, analysis?.typography, ...(analysis?.techniques || []),
    ];
    return [reference.id, normalize(text.filter(Boolean).join(' '))];
  }));

  let saved = new Set();
  try {
    const stored = JSON.parse(localStorage.getItem(savedKey) || '[]');
    if (Array.isArray(stored)) saved = new Set(stored.filter((id) => byId.has(id)));
  } catch {
    // The collection remains usable when browser storage is unavailable.
  }

  let view = 'all';
  let activeStyle = 'all';
  let visibleReferences = [];
  let viewerReferences = [];
  let viewerIndex = 0;
  let viewerTrigger;
  let zoomed = false;

  const iconPaths = {
    bookmark: 'M6 5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v15l-6-4-6 4z',
    expand: 'M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4',
    play: 'M9 5.5v13l10-6.5z',
  };

  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.65');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', iconPaths[name]);
    svg.append(path);
    return svg;
  }

  function element(tag, className, label) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (label) node.textContent = label;
    return node;
  }

  function setStyle(node, reference) {
    const style = stylesById.get(reference.style);
    node.textContent = style?.label || reference.style;
    node.style.setProperty('--style-color', style?.color || 'currentColor');
  }

  function updateSaveButton(button, reference) {
    const isSaved = saved.has(reference.id);
    button.setAttribute('aria-pressed', String(isSaved));
    button.setAttribute('aria-label', `Избранное: ${reference.title}`);
    button.title = isSaved ? 'Убрать из избранного' : 'В избранное';
  }

  function toggleSaved(reference, button) {
    const previousIndex = visibleReferences.indexOf(reference);
    if (saved.has(reference.id)) saved.delete(reference.id);
    else saved.add(reference.id);

    try {
      localStorage.setItem(savedKey, JSON.stringify([...saved]));
    } catch {
      // Keep the selection for the current tab even if it cannot be persisted.
    }

    updateSaveButton(button, reference);
    if (savedCount) {
      savedCount.textContent = String(saved.size);
      savedCount.hidden = saved.size === 0;
    }

    if (view === 'saved') {
      render();
      if (!viewer.open) {
        const nextIndex = Math.min(previousIndex, gallery.children.length - 1);
        const targetButton = gallery.children[nextIndex]?.querySelector('.card-save');
        (targetButton || emptyReset).focus({preventScroll: true});
      }
    } else {
      const cardSave = cards.get(reference.id)?.querySelector('.card-save');
      if (cardSave && cardSave !== button) updateSaveButton(cardSave, reference);
    }
  }

  function makeCard(reference, index) {
    const card = element('article', 'reference-card');
    card.dataset.id = reference.id;
    const media = element('div', 'card-media');
    const open = element('button', 'card-open');
    open.type = 'button';
    open.setAttribute('aria-label', `Открыть ${reference.title}`);
    open.style.aspectRatio = `${reference.width} / ${reference.height}`;

    if (reference.thumbnail || reference.kind !== 'video') {
      const image = element('img', 'card-image');
      image.alt = '';
      image.width = reference.width;
      image.height = reference.height;
      image.loading = index < 4 ? 'eager' : 'lazy';
      image.decoding = 'async';
      image.src = reference.thumbnail || reference.src;
      open.append(image);
    }

    const viewIcon = element('span', 'card-view-icon');
    const isVideo = reference.kind === 'video';
    if (isVideo) {
      card.classList.add('reference-card--video');
      viewIcon.classList.add('is-video');
      const videoLabel = element('span', 'card-video-label', 'Видео');
      videoLabel.setAttribute('aria-hidden', 'true');
      open.append(videoLabel);
      open.setAttribute('aria-label', `Открыть видео «${reference.title}»`);
    }
    viewIcon.append(icon(isVideo ? 'play' : 'expand'));
    open.append(viewIcon);

    const save = element('button', 'card-save');
    save.type = 'button';
    save.append(icon('bookmark'));
    media.append(open, save);

    const caption = element('div', 'card-caption');
    const title = element('h3', 'card-title', reference.title);
    const style = element('span', 'card-style');
    setStyle(style, reference);
    caption.append(title, style);
    card.append(media, caption);

    open.addEventListener('click', () => openViewer(reference, visibleReferences, open));
    save.addEventListener('click', () => toggleSaved(reference, save));
    return card;
  }

  const cards = new Map();

  function layoutGallery() {
    if (gallery.hidden) return;
    const gridStyles = getComputedStyle(gallery);
    const separation = Number.parseFloat(gridStyles.getPropertyValue('--masonry-gap')) || 20;
    const activeCards = [...gallery.children];
    const heights = activeCards.map((card) => card.getBoundingClientRect().height);
    activeCards.forEach((card, index) => {
      card.style.gridRowEnd = `span ${Math.ceil(heights[index] + separation)}`;
    });
  }

  let galleryWidth;
  const galleryObserver = new ResizeObserver(([entry]) => {
    if (entry.contentRect.width === galleryWidth) return;
    galleryWidth = entry.contentRect.width;
    layoutGallery();
  });
  galleryObserver.observe(gallery);
  document.fonts?.ready.then(layoutGallery);

  const filterButtons = new Map();

  function buildFilters() {
    const list = [{id: 'all', label: 'Все стили'}, ...styles];
    list.forEach((style) => {
      const button = element('button', 'style-filter');
      button.type = 'button';
      button.dataset.style = style.id;
      if (style.description) button.title = style.description;
      const label = element('span', 'filter-label', style.label);
      const count = element('span', 'filter-count');

      if (style.color) {
        const dot = element('span', 'style-dot');
        button.style.setProperty('--style-color', style.color);
        dot.setAttribute('aria-hidden', 'true');
        button.append(dot);
      }

      button.append(label, count);
      button.addEventListener('click', () => {
        activeStyle = style.id;
        render();
      });
      filterButtons.set(style.id, {button, count});
      filters.append(button);
    });
  }

  function render() {
    const terms = normalize(search.value).split(' ').filter(Boolean);
    document.body.dataset.searching = String(terms.length > 0);
    const matching = catalog.filter((reference) => {
      if (view === 'saved' && !saved.has(reference.id)) return false;
      return terms.every((term) => searchIndex.get(reference.id).includes(term));
    });
    visibleReferences = activeStyle === 'all' ? matching : matching.filter((reference) => reference.style === activeStyle);

    const counts = new Map();
    matching.forEach(({style}) => counts.set(style, (counts.get(style) || 0) + 1));
    filterButtons.forEach(({button, count}, id) => {
      button.setAttribute('aria-pressed', String(id === activeStyle));
      count.textContent = String(id === 'all' ? matching.length : counts.get(id) || 0);
    });

    const total = visibleReferences.length;
    searchClear.hidden = !search.value;
    if (savedCount) {
      savedCount.textContent = String(saved.size);
      savedCount.hidden = saved.size === 0;
    }
    resultCount.textContent = `${total} ${referenceNouns[referencePlural.select(total)]}`;

    const fragment = document.createDocumentFragment();
    visibleReferences.forEach((reference, index) => {
      if (!cards.has(reference.id)) cards.set(reference.id, makeCard(reference, index));
      const card = cards.get(reference.id);
      updateSaveButton(card.querySelector('.card-save'), reference);
      fragment.append(card);
    });
    gallery.replaceChildren(fragment);
    gallery.hidden = total === 0;
    emptyState.hidden = total > 0;

    if (!total) {
      const noSavedCards = view === 'saved' && saved.size === 0;
      emptyTitle.textContent = noSavedCards ? 'В избранном пока пусто' : 'Референсы не найдены';
      emptyCopy.textContent = noSavedCards
        ? 'Нажмите на иконку закладки на карточке, чтобы добавить её сюда.'
        : 'Попробуйте изменить запрос или выбрать другой стиль.';
      emptyReset.textContent = noSavedCards ? 'Открыть коллекцию' : 'Сбросить фильтры';
    }

    layoutGallery();
  }

  function setCollection(nextView) {
    if (nextView !== view) {
      view = nextView;
      search.value = '';
      activeStyle = 'all';
    }
    document.body.dataset.view = view;
    if (collectionTitle) collectionTitle.textContent = view === 'saved' ? 'Избранное' : 'Коллекция';
    navLinks.forEach((link) => {
      link.setAttribute('aria-pressed', String(link.dataset.view === view));
    });
    render();
  }

  function setZoom(nextState) {
    zoomed = nextState;
    viewerMedia.classList.toggle('is-actual-size', zoomed);
    if (!viewerZoom) return;
    viewerZoom.setAttribute('aria-pressed', String(zoomed));
    viewerZoom.title = zoomed ? 'Уместить на экране' : 'Показать в размере 1:1';
    if (zoomed) {
      requestAnimationFrame(() => viewerMedia.scrollTo({
        left: Math.max(0, (viewerMedia.scrollWidth - viewerMedia.clientWidth) / 2),
        top: Math.max(0, (viewerMedia.scrollHeight - viewerMedia.clientHeight) / 2),
      }));
    } else {
      viewerMedia.scrollTo(0, 0);
    }
  }

  function showAnalysis(reference) {
    const analysis = analyses[reference.id];
    viewerAnalysis.hidden = !analysis;
    copyStatus.textContent = '';
    if (!analysis) return;

    viewerFontType.textContent = analysis.fontType;
    viewerTypography.textContent = analysis.typography;
    viewerPalette.replaceChildren(...analysis.palette.map((color) => {
      const item = element('li');
      const swatch = element('span', 'palette-swatch');
      swatch.style.backgroundColor = color;
      swatch.setAttribute('aria-hidden', 'true');
      item.append(swatch, element('code', '', color));
      return item;
    }));
    viewerPaletteNote.textContent = reference.kind === 'video'
      ? 'Оттенки по кадру предпросмотра.'
      : 'Оттенки по изображению.';
    viewerComposition.textContent = analysis.composition;
    viewerPrompt.textContent = analysis.prompt.join(' ');
    viewerTechniques.replaceChildren(...analysis.techniques.map((technique) => {
      const item = element('li');
      const separator = technique.indexOf(' — ');
      if (separator === -1) {
        item.textContent = technique;
      } else {
        item.append(element('strong', '', technique.slice(0, separator)), technique.slice(separator));
      }
      return item;
    }));
    viewerFontSource.hidden = !analysis.fontSource;
    if (analysis.fontSource) {
      viewerFontSource.href = analysis.fontSource.url;
      viewerFontSource.textContent = analysis.fontSource.label;
    } else {
      viewerFontSource.removeAttribute('href');
      viewerFontSource.textContent = '';
    }
  }

  async function copyPrompt() {
    const reference = viewerReferences[viewerIndex];
    const text = viewerPrompt.textContent;
    try {
      await navigator.clipboard.writeText(text);
      if (viewer.open && viewerReferences[viewerIndex] === reference) {
        copyStatus.textContent = 'Промпт скопирован';
      }
    } catch {
      if (!viewer.open || viewerReferences[viewerIndex] !== reference) return;
      const range = document.createRange();
      range.selectNodeContents(viewerPrompt);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      copyStatus.textContent = 'Текст выделен. Скопируйте его через меню браузера.';
    }
  }

  function showReference() {
    const reference = viewerReferences[viewerIndex];
    const isVideo = reference.kind === 'video';
    const media = element(isVideo ? 'video' : 'img', 'viewer-artwork');

    if (isVideo) {
      media.controls = true;
      media.playsInline = true;
      media.preload = 'metadata';
      if (reference.thumbnail) media.poster = reference.thumbnail;
      media.setAttribute('aria-label', reference.title);
    } else {
      media.alt = reference.title;
      media.width = reference.width;
      media.height = reference.height;
    }
    media.addEventListener('error', () => {
      if (viewerMedia.firstElementChild !== media) return;
      const message = element('p', 'media-error', 'Не удалось загрузить файл. Откройте оригинал по ссылке ниже.');
      message.setAttribute('role', 'status');
      viewerMedia.replaceChildren(message);
      if (viewerZoom) viewerZoom.hidden = true;
      setZoom(false);
    });
    media.src = reference.src;
    viewerMedia.replaceChildren(media);
    if (viewerZoom) viewerZoom.hidden = isVideo;
    setZoom(false);
    viewerTitle.textContent = reference.title;
    viewerDescription.textContent = reference.description;
    showAnalysis(reference);
    viewerDetails.scrollTop = 0;
    viewer.scrollTop = 0;
    setStyle(viewerStyle, reference);
    viewerTags.replaceChildren(...(reference.tags || []).map((tag) => element('li', 'viewer-tag', tag)));
    viewerPosition.textContent = `${viewerIndex + 1} / ${viewerReferences.length}`;
    viewerPrevious.disabled = viewerIndex === 0;
    viewerNext.disabled = viewerIndex === viewerReferences.length - 1;
    viewerOriginal.href = reference.src;
    if (viewerSource) {
      viewerSource.hidden = !reference.sourceUrl;
      if (reference.sourceUrl) viewerSource.href = reference.sourceUrl;
      else viewerSource.removeAttribute('href');
    }
    updateSaveButton(viewerSave, reference);
  }

  function openViewer(reference, references, source) {
    viewerReferences = [...references];
    viewerIndex = viewerReferences.indexOf(reference);
    viewerTrigger = source;
    showReference();
    viewer.showModal();
    get('viewer-close').focus();
  }

  function moveViewer(offset) {
    const nextIndex = viewerIndex + offset;
    if (nextIndex < 0 || nextIndex >= viewerReferences.length) return;
    viewerIndex = nextIndex;
    showReference();
  }

  const libraryHeader = get('library-header') || get('library');
  navLinks.forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    setCollection(link.dataset.view);
    libraryHeader?.scrollIntoView({block: 'start'});
  }));

  document.querySelectorAll('[data-featured]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const reference = byId.get(button.dataset.featured);
      if (!reference) return;
      event.preventDefault();
      openViewer(reference, catalog, button);
    });
  });

  search.addEventListener('input', () => {
    const wasSearching = document.body.dataset.searching === 'true';
    render();
    if (!wasSearching && document.body.dataset.searching === 'true') {
      libraryHeader?.scrollIntoView({block: 'start', behavior: 'instant'});
    }
  });
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') libraryHeader?.scrollIntoView({block: 'start'});
  });
  searchClear.addEventListener('click', () => {
    search.value = '';
    render();
    search.focus();
  });
  emptyReset.addEventListener('click', () => {
    search.value = '';
    activeStyle = 'all';
    setCollection(view === 'saved' && !saved.size ? 'all' : view);
    filterButtons.get('all').button.focus({preventScroll: true});
  });

  get('viewer-close').addEventListener('click', () => viewer.close());
  get('viewer-copy').addEventListener('click', copyPrompt);
  viewerPrevious.addEventListener('click', () => moveViewer(-1));
  viewerNext.addEventListener('click', () => moveViewer(1));
  viewerSave.addEventListener('click', () => toggleSaved(viewerReferences[viewerIndex], viewerSave));
  viewerZoom?.addEventListener('click', () => setZoom(!zoomed));
  let backdropPressed = false;
  viewer.addEventListener('pointerdown', (event) => {
    backdropPressed = event.target === viewer;
  });
  viewer.addEventListener('click', (event) => {
    if (event.target === viewer && backdropPressed) viewer.close();
  });
  viewer.addEventListener('close', () => {
    viewerMedia.replaceChildren();
    const focusTarget = viewerTrigger?.isConnected ? viewerTrigger : filterButtons.get('all').button;
    focusTarget.focus({preventScroll: true});
  });

  document.addEventListener('keydown', (event) => {
    if (viewer.open) {
      if (event.target instanceof HTMLMediaElement || zoomed) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        moveViewer(event.key === 'ArrowLeft' ? -1 : 1);
      }
      return;
    }

    const editing = event.target.matches('input, select, textarea, [contenteditable]');
    const searchShortcut = (event.key === '/' && !editing && !event.altKey && !event.ctrlKey && !event.metaKey)
      || (event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey));
    if (searchShortcut) {
      event.preventDefault();
      search.focus();
    }
  });

  buildFilters();
  setCollection('all');
})();

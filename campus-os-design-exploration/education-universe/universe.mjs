import { loadGraph } from './graph.mjs';

const labels = {
  school: 'Высшая школа или факультет',
  direction: 'Направление подготовки',
  program: 'Образовательная программа',
  subject: 'Дисциплина',
};

const listLabels = {
  degree: 'Школы и факультеты',
  school: 'Направления подготовки',
  direction: 'Образовательные программы',
  program: 'Дисциплины',
  subject: 'Программы с этой дисциплиной',
};

const escape = (text) => String(text).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

function nodeButton(node) {
  const code = node.type === 'direction' ? `<span class="eu-code">${escape(node.code)}</span>` : '';
  return `<li><button type="button" data-universe-node="${escape(node.id)}">${code}<span>${escape(node.label)}</span><span class="eu-link-arrow" aria-hidden="true">↗</span></button></li>`;
}

function sourceLink(graph, node, viaProgramId) {
  const url = graph.sourceOf(node.id, viaProgramId);
  if (!url) return '';
  const label = node.sourceType === 'official_department_page' ? 'Страница подразделения РЭУ' : 'Источник · РЭУ';
  return `<a class="eu-source" href="${escape(url)}" target="_blank" rel="noopener noreferrer">${label} <span aria-hidden="true">↗</span></a>`;
}

function panelContent(graph, path, contextual) {
  const node = path[path.length - 1];
  const program = path.find((item) => item.type === 'program');
  const overview = node.type === 'degree';
  const related = node.type === 'subject' ? graph.sharedPrograms(node.id) : graph.children(node.id);
  const parent = path[path.length - 2];
  const programNote = node.type === 'program'
    ? `<p class="eu-note">${node.isCompleteCurriculum === true ? 'Дисциплины из опубликованного учебного плана.' : 'В источнике может быть представлен неполный список дисциплин.'}</p>`
    : '';
  const relatedList = related.length
    ? `<ul class="eu-list">${related.map(nodeButton).join('')}</ul>`
    : '<p class="eu-note">В источнике сведения отсутствуют.</p>';
  const relatedLabel = `${listLabels[node.type]} <span>${related.length}</span>`;
  const relations = contextual
    ? `<details class="eu-related-details"><summary>${relatedLabel}</summary>${relatedList}</details>`
    : `<div class="eu-related"><h4>${relatedLabel}</h4>${relatedList}</div>`;
  return `
    <header class="eu-panel-head">
      <p class="eu-kind">${overview ? 'Каталог · РЭУ им. Г. В. Плеханова' : labels[node.type]}</p>
      <h3 id="eu-selection-title" tabindex="-1">${escape(node.label)}</h3>
      ${node.code && node.type === 'direction' ? `<p class="eu-note eu-code">${escape(node.code)}</p>` : ''}
      ${parent && ['direction', 'program'].includes(node.type) ? `<p class="eu-note">${escape(parent.label)}</p>` : ''}
      ${programNote}
      ${overview ? '' : sourceLink(graph, node, program?.id)}
      ${contextual ? '<p class="eu-note">Демонстрационные данные РЭУ им. Г. В. Плеханова</p>' : ''}
    </header>
    ${relations}`;
}

export function mountEducationUniverse(section) {
  const canvas = section.querySelector('[data-universe-canvas]');
  const panel = section.querySelector('[data-universe-panel]');
  const breadcrumbs = section.querySelector('[data-universe-breadcrumbs]');
  const back = section.querySelector('[data-universe-back]');
  const status = section.querySelector('[data-universe-status]');
  const retry = section.querySelector('[data-universe-retry]');
  const mapButton = section.querySelector('[data-universe-map]');
  const tooltip = section.querySelector('[data-universe-tooltip]');
  const zoomControls = section.querySelector('[data-universe-zoom]');
  const supportsMap = typeof WebGL2RenderingContext !== 'undefined' && typeof ResizeObserver !== 'undefined';
  const selectedNode = () => path[path.length - 1];
  let graph;
  let path;
  let scene;
  let graphRequest;
  let mapRequest;
  let disposed = false;
  let shown = false;
  let hoverId = null;

  function hideTooltip() {
    hoverId = null;
    tooltip.hidden = true;
  }

  function render() {
    const selected = selectedNode();
    section.dataset.universeLevel = selected.type;
    back.hidden = path.length === 1;
    breadcrumbs.hidden = path.length === 1;
    breadcrumbs.innerHTML = path.length === 1 ? '' : path.map((node, index) => index === path.length - 1
      ? `<li aria-current="location">${escape(node.label)}</li>`
      : `<li><button type="button" data-universe-node="${escape(node.id)}">${escape(node.label)}</button></li>`
    ).join('');
    panel.innerHTML = panelContent(graph, path, path.length > 1 && section.dataset.universeMode === 'webgl');
  }

  function navigate(id, focusPanel = true) {
    if (!graph?.byId.has(id) || id === selectedNode().id) return;
    const selectedProgram = path.find((node) => node.type === 'program');
    path = graph.path(id, selectedProgram?.id);
    hideTooltip();
    render();
    scene?.focus(id, path.find((node) => node.type === 'program')?.id);
    if (focusPanel) {
      const restoredOverview = path.length === 1 && section.dataset.universeMode === 'webgl';
      const destination = restoredOverview ? zoomControls.querySelector('button') : panel.querySelector('h3');
      destination.focus({ preventScroll: true });
    }
  }

  function navigateBack() {
    if (path?.length > 1) navigate(path[path.length - 2].id);
  }

  function setStatus(message = '') {
    status.textContent = message;
    status.hidden = !message;
  }

  function setMode(mode) {
    const isMap = mode === 'webgl';
    section.dataset.universeMode = mode;
    mapButton.textContent = isMap ? 'Открыть список' : 'Открыть 3D-карту';
    zoomControls.hidden = !isMap;
    setStatus();
    render();
    hideTooltip();
    if (isMap) scene.focus(selectedNode().id, path.find((node) => node.type === 'program')?.id);
    updateSceneActivity();
  }

  function updateSceneActivity() {
    const viewerHidden = document.documentElement.hasAttribute('data-preview-inactive');
    if (viewerHidden && hoverId) hideTooltip();
    scene?.setActive(section.dataset.universeMode === 'webgl' && shown && !document.hidden && !viewerHidden);
  }

  async function loadCatalog() {
    if (graphRequest || graph || disposed) return;
    const request = new AbortController();
    graphRequest = request;
    const timeout = setTimeout(() => request.abort(), 12000);
    const restoreFocus = document.activeElement === retry;
    retry.hidden = true;
    setStatus('Загружаем каталог…');
    try {
      graph = await loadGraph(undefined, { signal: request.signal });
      if (disposed) return;
      path = [graph.root];
      setMode('list');
      mapButton.hidden = !supportsMap;
      if (restoreFocus) panel.querySelector('h3').focus({ preventScroll: true });
      const connection = navigator.connection;
      if (supportsMap && !restoreFocus && !connection?.saveData &&
          !/2g|3g/.test(connection?.effectiveType ?? '') && matchMedia('(min-width: 841px)').matches) {
        void loadMap(false);
      }
    } catch (error) {
      if (disposed) return;
      graph = undefined;
      section.dataset.universeMode = 'error';
      setStatus('Не удалось загрузить каталог.');
      retry.hidden = false;
      if (restoreFocus) retry.focus({ preventScroll: true });
      if (!request.signal.aborted) console.error('Education Universe:', error);
    } finally {
      clearTimeout(timeout);
      graphRequest = undefined;
    }
  }

  function finishMapRequest(request) {
    if (mapRequest !== request) return;
    mapRequest = undefined;
    mapButton.removeAttribute('aria-disabled');
    mapButton.textContent = 'Открыть 3D-карту';
  }

  async function loadMap(openWhenReady) {
    if (disposed || mapRequest) return;
    const request = new AbortController();
    mapRequest = request;
    mapButton.setAttribute('aria-disabled', 'true');
    mapButton.textContent = 'Загружаем 3D-карту…';
    setStatus();
    const timeout = setTimeout(() => {
      request.abort();
      finishMapRequest(request);
      setStatus('3D-карта не загрузилась.');
    }, 20000);
    try {
      const { createUniverseScene } = await import('./scene.mjs');
      if (request.signal.aborted) return;
      const loadedScene = await createUniverseScene(canvas, graph, {
        select(id) {
          navigate(id, false);
          requestAnimationFrame(() => {
            if (!disposed && selectedNode().id === id) panel.querySelector('h3').focus({ preventScroll: true });
          });
        },
        hover(id) {
          const node = graph.byId.get(id);
          if (!node) {
            hideTooltip();
            return;
          }
          hoverId = id;
          tooltip.textContent = node.label;
          tooltip.hidden = false;
        },
        unavailable() {
          scene?.dispose();
          scene = undefined;
          setMode('list');
          mapButton.hidden = true;
          setStatus('3D-карта недоступна в этом браузере.');
        },
      }, request.signal);
      if (request.signal.aborted) {
        loadedScene?.dispose();
        return;
      }
      scene = loadedScene;
      if (!scene) {
        mapButton.hidden = true;
        if (openWhenReady) setStatus('3D-карта недоступна в этом браузере.');
        return;
      }
      finishMapRequest(request);
      if (openWhenReady || (path.length === 1 && !section.contains(document.activeElement))) {
        setMode('webgl');
      }
    } catch (error) {
      if (request.signal.aborted) return;
      setStatus('3D-карта не загрузилась.');
      console.info('Education Universe: 3D недоступно', error);
    } finally {
      clearTimeout(timeout);
      request.abort();
      finishMapRequest(request);
    }
  }

  const events = new AbortController();
  const listener = { signal: events.signal };
  section.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button === retry) void loadCatalog();
    if (button === mapButton && !mapRequest) {
      if (scene) setMode(section.dataset.universeMode === 'webgl' ? 'list' : 'webgl');
      else void loadMap(true);
    }
    if (button?.matches('[data-universe-back]')) navigateBack();
    if (button?.dataset.universeNode) navigate(button.dataset.universeNode);
    if (button?.dataset.zoomStep) scene?.zoomBy(Number(button.dataset.zoomStep));
  }, listener);
  section.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && path?.length > 1 && !event.defaultPrevented) {
      event.preventDefault();
      navigateBack();
      return;
    }
    if (scene && !zoomControls.hidden && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (['+', '=', '-'].includes(event.key)) {
        event.preventDefault();
        scene.zoomBy(event.key === '-' ? -1 : 1);
        return;
      }
    }
    const list = event.target.closest('.eu-list');
    if (!list || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...list.querySelectorAll('button')];
    const index = buttons.indexOf(event.target);
    const next = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: buttons.length - 1 }[event.key];
    event.preventDefault();
    buttons[Math.max(0, Math.min(next, buttons.length - 1))]?.focus();
  }, listener);
  canvas.addEventListener('pointermove', (event) => {
    const rect = tooltip.parentElement.getBoundingClientRect();
    const x = Math.max(6, Math.min(event.clientX - rect.x + 13, rect.width - tooltip.offsetWidth - 9));
    const y = Math.max(6, Math.min(event.clientY - rect.y + 16, rect.height - tooltip.offsetHeight - 9));
    tooltip.style.transform = `translate(${x}px, ${y}px)`;
  }, { ...listener, passive: true });
  canvas.addEventListener('pointerleave', hideTooltip, listener);
  section.addEventListener('focusin', (event) => {
    scene?.highlight?.(event.target.closest('button[data-universe-node]')?.dataset.universeNode ?? null);
  }, listener);
  document.addEventListener('visibilitychange', updateSceneActivity, listener);
  document.addEventListener('campus-preview-visibility', updateSceneActivity, listener);

  const activityObserver = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
    shown = entry.isIntersecting;
    section.toggleAttribute('data-universe-active', shown);
    if (!shown && hoverId) hideTooltip();
    updateSceneActivity();
  }, { rootMargin: '120px 0px' });
  const loadObserver = activityObserver && new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    loadObserver.disconnect();
    void loadCatalog();
  }, { rootMargin: '550px 0px' });
  activityObserver?.observe(section);
  if (loadObserver) loadObserver.observe(section);
  else void loadCatalog();

  function dispose() {
    disposed = true;
    events.abort();
    activityObserver?.disconnect();
    loadObserver?.disconnect();
    graphRequest?.abort();
    mapRequest?.abort();
    scene?.dispose();
  }

  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) dispose();
  }, listener);
  return dispose;
}

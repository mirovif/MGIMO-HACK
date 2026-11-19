const links = [...document.querySelectorAll('[data-concept]')];
const frame = document.querySelector('iframe');
const standalone = document.querySelector('.standalone');

function selectConcept() {
  const requested = new URL(location.href).searchParams.get('concept');
  const concept = links.some((link) => link.dataset.concept === requested) ? requested : '01';
  if (frame.dataset.concept === concept) return;

  for (const link of links) {
    if (link.dataset.concept === concept) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  const page = new URL(`./home.html?concept=${concept}`, location.href);
  frame.dataset.concept = concept;
  frame.title = `Концепт ${concept} · Campus OS`;
  standalone.href = page.href;
  frame.contentWindow.location.replace(page.href);
}

for (const link of links) {
  link.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (link.getAttribute('aria-current') === 'page') return;
    history.pushState(null, '', link.href);
    selectConcept();
  });
}

window.addEventListener('popstate', selectConcept);
selectConcept();

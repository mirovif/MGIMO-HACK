const relationTypes = new Map([
  ['contains', ['degree', 'school']],
  ['offers_direction', ['school', 'direction']],
  ['offers_program', ['direction', 'program']],
  ['studies', ['program', 'subject']],
  ['direction_subject', ['direction', 'subject']],
]);

const nodeTypes = new Set(['degree', 'school', 'direction', 'program', 'subject']);

function validSource(value) {
  if (typeof value !== 'string') return null;
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:' ? value : null;
  } catch {
    return null;
  }
}

export function adaptGraph(raw) {
  if (!Array.isArray(raw?.nodes) || !Array.isArray(raw?.links)) {
    throw new Error('В академическом каталоге отсутствуют узлы или связи.');
  }

  const byId = new Map();
  const outgoing = new Map();
  const incoming = new Map();
  const sources = new Map();
  const counts = { degree: 0, school: 0, direction: 0, program: 0, subject: 0 };
  const directionCodes = new Set();

  for (const node of raw.nodes) {
    if (!nodeTypes.has(node?.type) || typeof node.id !== 'string' || typeof node.label !== 'string' ||
        !node.id.startsWith(`${node.type}:`) || !node.label.trim()) {
      throw new Error('В академическом каталоге есть запись без корректного типа, идентификатора или названия.');
    }
    if (byId.has(node.id)) throw new Error(`В каталоге повторяется идентификатор ${node.id}.`);

    byId.set(node.id, node);
    outgoing.set(node.id, []);
    incoming.set(node.id, []);
    counts[node.type]++;
    if (node.type === 'direction' && node.code) directionCodes.add(node.code);
    if (node.source !== undefined) {
      const source = validSource(node.source);
      if (!source) throw new Error(`Некорректная ссылка на источник для ${node.id}.`);
      sources.set(node.id, source);
    }
  }

  const root = byId.get('degree:bachelor');
  if (!root || counts.degree !== 1) throw new Error('В каталоге должен быть один корневой раздел бакалавриата.');

  const relationships = new Set();
  const studySources = new Map();
  let primaryEdges = 0;
  let derivedEdges = 0;
  let subjectMemberships = 0;

  for (const link of raw.links) {
    const source = byId.get(link?.source);
    const target = byId.get(link?.target);
    if (!source || !target) throw new Error('Связь указывает на отсутствующий узел каталога.');

    const types = relationTypes.get(link.type);
    const derived = link.type === 'direction_subject';
    if (!types || source.type !== types[0] || target.type !== types[1] ||
        link.physics !== !derived || Boolean(link.derived) !== derived) {
      throw new Error(`Связь ${source.id} → ${target.id} не соответствует структуре каталога.`);
    }
    const key = `${source.id}|${target.id}`;
    if (relationships.has(key)) throw new Error(`В каталоге повторяется связь ${key}.`);
    relationships.add(key);

    if (derived) {
      derivedEdges++;
      continue;
    }

    outgoing.get(source.id).push(target);
    incoming.get(target.id).push(source);
    primaryEdges++;
    if (link.type === 'studies') {
      subjectMemberships++;
      if (link.sourceUrl !== undefined) {
        const url = validSource(link.sourceUrl);
        if (!url) throw new Error(`Некорректная ссылка на источник для связи ${key}.`);
        studySources.set(key, url);
      }
    }
  }

  for (const [id, node] of byId) {
    if (node === root) continue;
    const parentCount = incoming.get(id).length;
    if (parentCount === 0 || (node.type !== 'subject' && parentCount !== 1)) {
      throw new Error(`Нарушена иерархия разделов для ${id}.`);
    }
  }

  const stats = {
    schools: counts.school,
    directionPlanets: counts.direction,
    uniqueDirectionCodes: directionCodes.size,
    programs: counts.program,
    uniqueSubjects: counts.subject,
    subjectMemberships,
    nodes: byId.size,
    edges: relationships.size,
    primaryEdges,
    derivedDirectionSubjectEdges: derivedEdges,
  };

  for (const [key, count] of Object.entries(stats)) {
    if (raw.stats?.[key] !== undefined && raw.stats[key] !== count) {
      throw new Error(`Статистика каталога не совпадает с данными (${key}).`);
    }
  }

  function path(id, viaProgramId) {
    const ancestry = [];
    let node = byId.get(id);
    while (node) {
      ancestry.push(node);
      const parents = incoming.get(node.id);
      node = parents.find((parent) => parent.id === viaProgramId) ?? parents[0];
    }
    return ancestry.reverse();
  }

  function sourceOf(id, viaProgramId) {
    if (byId.get(id)?.type === 'subject' && viaProgramId) {
      return studySources.get(`${viaProgramId}|${id}`) ?? null;
    }
    return sources.get(id) ?? null;
  }

  return {
    root,
    byId,
    stats,
    meta: raw.meta,
    children: (id) => outgoing.get(id) ?? [],
    parents: (id) => incoming.get(id) ?? [],
    sharedPrograms: (id) => byId.get(id)?.type === 'subject' ? incoming.get(id) : [],
    sourceOf,
    path,
  };
}

export async function loadGraph(url = new URL('./data/education_universe.graph.json', import.meta.url), { signal } = {}) {
  const response = await fetch(url, { signal, priority: 'high' });
  if (!response.ok) throw new Error('Не удалось загрузить академический каталог.');
  return adaptGraph(await response.json());
}

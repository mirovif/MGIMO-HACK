import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import load_dotenv
from sqlalchemy import delete, text, update

from .db import chunks, documents, engine_for, initialize, insert_once, now


UNIVERSITY_DOCUMENTS = (
    (
        'РЭУ · Справки и документы в личном кабинете',
        'https://rea.ru/66316-plchto-nujno-znat-o-lichnom-kabinete-studenta-plehanovskogo-universiteta',
        'Справку об обучении и другие документы заказывают в официальном личном кабинете РЭУ на student.rea.ru. '
        'Там же можно заказать выписку из приказа или экзаменационной ведомости, справку-вызов и заверенную копию договора.',
    ),
    (
        'РЭУ · Расписание занятий и доступ к ЛКС',
        'https://www.rea.ru/news/58445-pervokursnikam-na-zametku-lichnyiy-kabinet-studenta-plehanovki',
        'В открытом расписании на rasp.rea.ru можно посмотреть пары своей группы без входа. '
        'Расписание также есть в официальном личном кабинете студента на student.rea.ru. '
        'На странице входа есть форма восстановления логина и пароля. По вопросам доступа можно написать на lks@rea.ru.',
    ),
    (
        'РЭУ · Пересдачи и электронная зачётка',
        'https://rea.ru/66438-tvoy-uchebnyiy-profil-kak-sledit-za-uspevaemostyu-v-lichnom-kabinete',
        'График пересдач по академическим задолженностям доступен в разделе «Расписание» официального ЛКС РЭУ. '
        'Оценки по семестрам доступны в электронной зачётке, а баллы за текущую работу — в разделе «Рейтинг».',
    ),
    (
        'РЭУ · Единый электронный деканат',
        'https://www.rea.ru/structure/departments/departament-organizatsii-uchebnogo-protsessa/Edinyj-elektronnyj-dekanat/otdel-obrascheniy-studentov-i-prepodavateley',
        'Единый электронный деканат принимает студентов в кабинете 116 на первом этаже корпуса 3. '
        'Адрес деканата — Москва, Стремянный переулок, 36. График приёма указан на странице отдела обращений.',
    ),
    (
        'РЭУ · Справка о болезни и пропусках',
        'https://www.rea.ru/structure/hs/vyisshaya-injenernaya-shkola-novyie-materialyi-i-tehnologii/studentu',
        'Если вы заболели и пропустили занятия, справку о болезни можно передать в Единый электронный деканат. '
        'Там же принимают заявления на продление сессии, академический отпуск и смену личных данных.',
    ),
    (
        'РЭУ · Общежития',
        'https://rea.ru/structure/departments/edinaya-direktsiya-obschejitiy',
        'Общежития РЭУ предоставляют иногородним студентам по Положению об общежитии. '
        'Порядок заселения и контакты опубликованы на странице Единой дирекции общежитий.',
    ),
    (
        'РЭУ · Электронные ресурсы библиотеки',
        'https://www.rea.ru/science/biblcentr/elektronnyie-resursyi/',
        'Электронные ресурсы библиотеки РЭУ доступны через сервис «НЕО ПОИСК». '
        'Для работы вне кампуса зарегистрируйтесь из сети университета или укажите корпоративную почту РЭУ при регистрации извне.',
    ),
)


def is_official_url(url):
    source = urlsplit(url)
    return (source.scheme == 'https' and source.netloc.casefold() in
            {'rea.ru', 'www.rea.ru', 'rea.ru:443', 'www.rea.ru:443'})


def import_document(conn, title, url, body, metadata, *, replace=True):
    if not is_official_url(url):
        raise ValueError('Укажите прямой HTTPS-адрес официального документа РЭУ.')
    sections = [(None, body)] if isinstance(body, str) else body
    fragments = []
    for page, section in sections:
        words = section.split()
        fragments.extend(
            (page, ' '.join(words[max(0, start - 20):start + 120]))
            for start in range(0, len(words), 120)
        )
    if not fragments or not title.strip():
        raise ValueError('У документа должны быть название и текст.')
    if not isinstance(body, str):
        metadata = {**metadata, 'page_numbers': [page for page, _ in fragments]}
    values = dict(title=title, metadata=metadata, imported_at=now())
    document_id = insert_once(conn, documents, dict(url=url, **values), ['url'], returning=documents.c.id)
    if document_id is None:
        if not replace:
            return
        document_id = conn.scalar(update(documents).where(documents.c.url == url).values(**values).returning(documents.c.id))
        if conn.dialect.name == 'sqlite':
            conn.execute(text('DELETE FROM document_fts WHERE rowid IN (SELECT id FROM document_chunks WHERE document_id = :id)'), {'id': document_id})
        conn.execute(delete(chunks).where(chunks.c.document_id == document_id))
    rows = [dict(document_id=document_id, position=position, body=fragment)
            for position, (_, fragment) in enumerate(fragments)]
    if conn.dialect.name != 'sqlite':
        conn.execute(chunks.insert(), rows)
        return
    for row in rows:
        fragment_id = conn.scalar(chunks.insert().values(**row).returning(chunks.c.id))
        conn.execute(text('INSERT INTO document_fts(rowid, body) VALUES (:id, :body)'),
                     {'id': fragment_id, 'body': row['body']})


def seed_university_documents(conn):
    for title, url, body in UNIVERSITY_DOCUMENTS:
        import_document(conn, title, url, body, {'bundled': True}, replace=False)


def search(conn, query):
    stop = {'какой', 'какая', 'какие', 'куда', 'чтобы', 'можно', 'пожалуйста', 'нужно', 'узнать', 'получить',
            'подскажите', 'расскажите', 'скажите', 'когда', 'сколько', 'посмотреть'}
    generic = ('университет', 'студент', 'обучающ', 'плеханов')
    question = query.casefold()
    words = [word for word in re.findall(r'[^\W\d_]{4,}', question)
             if word not in stop and not word.startswith(generic)]
    if 'пересда' in question:
        words += ['ликвидация', 'задолженность']
    if 'бюджет' in question and any(word.startswith(('перей', 'перев')) for word in words):
        words += ['бесплатное', 'переход']
    words = list(dict.fromkeys(words))[:10]
    if not words:
        return []
    select_columns = ('SELECT d.title, d.url, d.metadata, c.position, c.body '
                      'FROM document_chunks c JOIN documents d ON d.id = c.document_id ')
    if conn.dialect.name == 'sqlite':
        terms = ' OR '.join(f'"{word[:max(4, len(word) - 2)]}"*' for word in words)
        statement = select_columns + 'JOIN document_fts f ON f.rowid = c.id WHERE document_fts MATCH :query ORDER BY bm25(document_fts), c.id LIMIT 12'
    else:
        terms = ' | '.join(words)
        statement = select_columns + """
            WHERE to_tsvector('russian', c.body) @@ to_tsquery('russian', :query)
            ORDER BY ts_rank(to_tsvector('russian', c.body), to_tsquery('russian', :query)) DESC, c.id LIMIT 12
        """
    passages = []
    for row in conn.execute(text(statement), {'query': terms}).mappings():
        if not is_official_url(row['url']):
            continue
        metadata = row['metadata']
        if isinstance(metadata, str):
            metadata = json.loads(metadata)
        pages = metadata.get('page_numbers', [])
        page = pages[row['position']] if row['position'] < len(pages) else None
        passages.append({
            'title': row['title'], 'url': row['url'], 'body': row['body'], 'page': page,
            'summary': bool(metadata.get('bundled')),
        })
    return passages


def main():
    load_dotenv(Path(__file__).resolve().parents[2] / '.env')
    parser = argparse.ArgumentParser(description='Индексация проверенного текста документа РЭУ.')
    parser.add_argument('path', type=Path)
    parser.add_argument('--title', required=True)
    parser.add_argument('--url', required=True)
    parser.add_argument('--published')
    args = parser.parse_args()
    engine = engine_for()
    initialize(engine)
    with engine.begin() as conn:
        import_document(conn, args.title, args.url, args.path.read_text(encoding='utf-8-sig'), {'published': args.published})


if __name__ == '__main__':
    main()


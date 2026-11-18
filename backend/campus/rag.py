import argparse
import re
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import load_dotenv
from sqlalchemy import delete, select, text, update

from .db import chunks, documents, engine_for, initialize, now


def import_document(conn, title, url, body, metadata):
    source = urlsplit(url)
    if source.scheme != 'https' or source.hostname not in {'rea.ru', 'www.rea.ru'}:
        raise ValueError('Укажите прямой HTTPS-адрес официального документа РЭУ.')
    body = ' '.join(body.split())
    if not body or not title.strip():
        raise ValueError('У документа должны быть название и текст.')
    timestamp = now()
    document_id = conn.scalar(select(documents.c.id).where(documents.c.url == url))
    if document_id is None:
        document_id = conn.scalar(documents.insert().values(title=title, url=url, metadata=metadata, imported_at=timestamp).returning(documents.c.id))
    else:
        conn.execute(update(documents).where(documents.c.id == document_id).values(title=title, metadata=metadata, imported_at=timestamp))
        if conn.dialect.name == 'sqlite':
            conn.execute(text('DELETE FROM document_fts WHERE rowid IN (SELECT id FROM document_chunks WHERE document_id = :id)'), {'id': document_id})
        conn.execute(delete(chunks).where(chunks.c.document_id == document_id))
    words = body.split()
    for position, start in enumerate(range(0, len(words), 120)):
        fragment = ' '.join(words[max(0, start - 20):start + 120])
        fragment_id = conn.scalar(chunks.insert().values(document_id=document_id, position=position, body=fragment).returning(chunks.c.id))
        if conn.dialect.name == 'sqlite':
            conn.execute(text('INSERT INTO document_fts(rowid, body) VALUES (:id, :body)'), {'id': fragment_id, 'body': fragment})


def search(conn, query):
    stop = {'какой', 'какие', 'чтобы', 'можно', 'пожалуйста', 'нужно', 'узнать', 'получить'}
    words = list(dict.fromkeys(word for word in re.findall(r'[^\W\d_]{4,}', query.casefold()) if word not in stop))[:8]
    if not words:
        return []
    select_columns = 'SELECT d.title, d.url, c.body FROM document_chunks c JOIN documents d ON d.id = c.document_id '
    if conn.dialect.name == 'sqlite':
        terms = ' OR '.join(f'"{word[:max(4, len(word) - 2)]}"*' for word in words)
        statement = select_columns + 'JOIN document_fts f ON f.rowid = c.id WHERE document_fts MATCH :query ORDER BY bm25(document_fts) LIMIT 4'
    else:
        terms = ' | '.join(words)
        statement = select_columns + """
            WHERE to_tsvector('russian', c.body) @@ to_tsquery('russian', :query)
            ORDER BY ts_rank(to_tsvector('russian', c.body), to_tsquery('russian', :query)) DESC LIMIT 4
        """
    return [dict(row) for row in conn.execute(text(statement), {'query': terms}).mappings()]


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


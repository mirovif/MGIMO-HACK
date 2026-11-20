import argparse
import hashlib
import re
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
from urllib.parse import urljoin, urlsplit

import httpx
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from pypdf import PdfReader
from sqlalchemy import select

from .db import documents, engine_for, initialize
from .rag import import_document, is_official_url


INDEX_URL = 'https://www.rea.ru/Sveden/document'
DOCUMENTS = (
    ('Правила внутреннего распорядка обучающихся', r'об утверждении правил внутреннего распорядка для обучающихся'),
    ('Режим занятий обучающихся', r'^режим занятий обучающихся$'),
    ('Текущий контроль и промежуточная аттестация (ВО)', r'^положение о текущем контроле успеваемости и промежуточной аттестации обучающихся$'),
    ('Текущий контроль и промежуточная аттестация (СПО)', r'^положение о текущем контроле успеваемости и промежуточной аттестации обучающихся спо$'),
    ('Порядок перевода студентов высшего образования', r'^положение о порядке перевода студентов высшего образования$'),
    ('Порядок перевода студентов СПО', r'^положение о порядке перевода студентов среднего профессионального образования$'),
    ('Положение о восстановлении', r'^положение о восстановлении$'),
    ('Порядок отчисления', r'^положение о порядке отчисления$'),
    ('Переход с платного на бесплатное обучение', r'^положение о порядке перехода с платного обучения на бесплатное$'),
    ('Организация образовательной деятельности', r'^положение о порядке организации . осуществления образовательной деятельности$'),
    ('Образовательные отношения с обучающимися (ВО)', r'^положение о порядке отношений с обучающимися и их родителями \(во\)$'),
    ('Правила приёма в бакалавриат и специалитет на 2026/2027 учебный год', r'^правила приема на программы бакалавриата и специалитета в 2026/2027 году$'),
    ('Правила приёма в магистратуру на 2026/2027 учебный год', r'^правила приема на программы магистратуры в 2026/2027 учебном году$'),
    ('Выписка из реестра лицензий', r'^выписка из реестра лицензий на осуществление образовательной деятельности$'),
)


def fetch(client, url, max_bytes):
    for _ in range(4):
        if not is_official_url(url):
            raise ValueError('Адрес загрузки не принадлежит официальному сайту РЭУ.')
        with client.stream('GET', url) as response:
            if response.is_redirect:
                url = urljoin(url, response.headers['location'])
                continue
            response.raise_for_status()
            body = bytearray()
            for block in response.iter_bytes():
                body.extend(block)
                if len(body) > max_bytes:
                    raise ValueError('Документ превышает допустимый размер.')
            return str(response.url), bytes(body)
    raise ValueError('Слишком много перенаправлений при загрузке документа.')


def catalog(html):
    links = []
    for anchor in BeautifulSoup(html, 'html.parser').select('a[href]'):
        href = urljoin(INDEX_URL, anchor['href'])
        path = urlsplit(href).path
        if is_official_url(href) and path.startswith('/mnt/sveden/document/') and path.casefold().endswith('.pdf'):
            label = ' '.join(anchor.get_text(' ', strip=True).replace('\u200b', '').split()).casefold()
            label = re.sub(r'\s*\(\d+[.,]\d+\s*мб\.\)$', '', label)
            links.append((label, href))
    for title, pattern in DOCUMENTS:
        urls = {href for label, href in links if re.search(pattern, label)}
        if len(urls) != 1:
            raise ValueError(f'На странице РЭУ не удалось однозначно определить документ «{title}».')
        yield title, urls.pop()


def pdf_content(client, entry):
    title, url = entry
    url, pdf = fetch(client, url, max_bytes=16 * 1024 * 1024)
    if not pdf.startswith(b'%PDF-'):
        raise ValueError(f'РЭУ не вернул PDF для документа «{title}».')
    pages = []
    for number, page in enumerate(PdfReader(BytesIO(pdf)).pages, start=1):
        body = (page.extract_text() or '').replace('\u00ad', '').replace('\u200b', '')
        if len(re.findall('[А-Яа-яЁё]', body)) >= 60:
            pages.append((number, body))
    return title, url, pages, hashlib.sha256(pdf).hexdigest()


def main():
    parser = argparse.ArgumentParser(description='Индексирует документы с официальной страницы РЭУ.')
    parser.add_argument('--check', action='store_true', help='Проверить загрузку и извлечение текста без записи в базу.')
    parser.add_argument('--require-postgres', action='store_true', help='Прервать импорт, если не настроен PostgreSQL.')
    args = parser.parse_args()
    load_dotenv(Path(__file__).resolve().parents[2] / '.env')
    with httpx.Client(timeout=25) as client, ThreadPoolExecutor(max_workers=4) as executor:
        _, html = fetch(client, INDEX_URL, max_bytes=2 * 1024 * 1024)
        corpus = list(executor.map(lambda entry: pdf_content(client, entry), catalog(html)))
    usable = [(title, url, pages, sha) for title, url, pages, sha in corpus if pages]
    for title, _, pages, _ in corpus:
        print(f'{title} — {len(pages)} стр.' if pages else f'{title} — без текстового слоя')
    if not usable:
        raise SystemExit('На странице РЭУ не найдено документов с доступным текстом.')
    print(f'Документов с доступным текстом: {len(usable)} из {len(corpus)}.')
    if args.check:
        return
    engine = engine_for()
    if args.require_postgres and engine.dialect.name != 'postgresql':
        raise SystemExit('Для этой операции нужен PostgreSQL.')
    try:
        initialize(engine)
        for title, url, pages, sha in usable:
            with engine.begin() as conn:
                previous = conn.scalar(select(documents.c.metadata).where(documents.c.url == url))
                if previous and previous.get('sha256') == sha:
                    continue
                import_document(conn, title, url, pages, {'catalog': INDEX_URL, 'sha256': sha})
        print(f'В индексе доступны {len(usable)} официальных документов.')
    finally:
        engine.dispose()


if __name__ == '__main__':
    main()

import re
from datetime import datetime, timedelta
from functools import lru_cache
from time import time
from typing import Annotated

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, Depends, HTTPException, Query

from .auth import student_only
from .demo import today

router = APIRouter(prefix='/api/schedule/public', dependencies=[Depends(student_only)])
SOURCE = 'https://rasp.rea.ru'
KEY = r'[A-Za-z0-9_+=./:-]{1,160}'
DATE = re.compile(r'\b\d{2}\.\d{2}\.\d{4}\b')
TIME = re.compile(r'\b\d{1,2}:\d{2}\b')


class ScheduleUnavailable(Exception):
    pass


@lru_cache(maxsize=128)
def official_get(path, params, _minute):
    try:
        response = httpx.get(SOURCE + path, params=dict(params), timeout=5, follow_redirects=False)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise ScheduleUnavailable from exc
    return response


def public_get(path, **params):
    return official_get(path, tuple(params.items()), int(time() // 60))


def unavailable(exc):
    raise HTTPException(503, 'Открытые данные РЭУ сейчас недоступны. Попробуйте снова или откройте официальный сайт расписания.') from exc


@router.get('/groups')
def groups(query: Annotated[str, Query(min_length=2, max_length=48)]):
    query = ' '.join(query.split())
    if len(query) < 2:
        raise HTTPException(422, 'Введите номер или часть номера группы.')
    try:
        results = public_get('/Schedule/SearchBarSuggestions', searchFor=query).json()
        if not isinstance(results, list):
            raise ScheduleUnavailable
    except (ScheduleUnavailable, ValueError) as exc:
        unavailable(exc)
    matches = {}
    for item in results:
        if not isinstance(item, dict):
            continue
        key, name = item.get('key'), item.get('name')
        if isinstance(key, str) and re.fullmatch(KEY, key) and isinstance(name, str) and any(char.isdigit() for char in name):
            matches[key] = {'key': key, 'name': name[:120]}
    return list(matches.values())[:20]


def parse_week(html):
    fragment = BeautifulSoup(html, 'html.parser')
    marker = fragment.select_one('input#weekNum')
    if not marker or not re.fullmatch(r'[0-9]{1,2}', str(marker.get('value', ''))):
        raise ScheduleUnavailable
    dates = []
    lessons = []
    for table in fragment.find_all('table'):
        day = table.select_one('th.dayh')
        match = DATE.search(day.get_text(' ', strip=True)) if day else None
        if not match:
            continue
        date = datetime.strptime(match.group(), '%d.%m.%Y').date()
        dates.append(date)
        for row in table.select('tr.slot'):
            cells = row.find_all('td', recursive=False)
            if len(cells) < 2:
                continue
            times = TIME.findall(cells[0].get_text(' ', strip=True))
            if len(times) < 2:
                continue
            for task in cells[1].select('a.task'):
                lines = [' '.join(line.split()) for line in task.get_text('\n', strip=True).splitlines() if line.strip()]
                if not lines:
                    continue
                kind = task.find('i')
                label = kind.get_text(' ', strip=True) if kind else ''
                name = lines[0]
                room = ' '.join(line for line in lines[1:] if line != label and not line.startswith('+')).replace(' ,', ',')
                if not re.search(r'корпус|ауд\.|аудитори|пл\.', room, re.IGNORECASE):
                    room = None
                teacher = task.select_one('.teacher, [data-teacher]')
                change = row.select_one('.schedule-change, .cancelled, .rescheduled, .replacement')
                status_text = change.get_text(' ', strip=True) if change else ''
                calendar = task.get('data-elementid', '')
                lessons.append(dict(
                    id=f'rea-{date.isoformat()}-{calendar}-{len(lessons)}', date=date.isoformat(), start=times[0].zfill(5),
                    end=times[1].zfill(5), subject=name, teacher=teacher.get_text(' ', strip=True) if teacher else None,
                    room=room, kind=label, change=status_text or None,
                ))
    return int(marker['value']), dates, lessons


@router.get('')
def schedule(
    key: Annotated[str, Query(pattern='^' + KEY + '$')],
    offset: Annotated[int, Query(ge=-8, le=8)] = 0,
):
    try:
        current = public_get('/Schedule/ScheduleCard', selection=key, weekNum=-1, catfilter='')
        week, dates, lessons = parse_week(current.text)
        if offset:
            selected = (week - 1 + offset) % 53 + 1
            target = public_get('/Schedule/ScheduleCard', selection=key, weekNum=selected, catfilter='')
            target_week, dates, lessons = parse_week(target.text)
            if target_week != selected:
                raise ScheduleUnavailable
    except (ScheduleUnavailable, ValueError) as exc:
        unavailable(exc)
    monday = min(dates) if dates else today() + timedelta(weeks=offset)
    monday -= timedelta(days=monday.weekday())
    return {'source': 'rea', 'start': monday, 'end': monday + timedelta(days=6), 'group': key, 'lessons': lessons}

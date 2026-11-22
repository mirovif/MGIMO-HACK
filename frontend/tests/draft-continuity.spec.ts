import { expect, test, type Page } from '@playwright/test'
import { confirmationPhoto } from './fixtures'

test.use({ viewport: { width: 360, height: 800 } })

async function mockProfile(page: Page) {
  await page.route('**/api/profile', route => route.fulfill({ json: {
    id: 101, login: 'test-student', name: 'Тестовый студент', role: 'student', faculty: null,
    program: null, year: null, group: null,
  } }))
  await page.route('**/api/notifications', route => route.fulfill({ json: [] }))
}

test('switching request types preserves unsent drafts after reload', async ({ page }) => {
  await mockProfile(page)
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-initialized')) return
    sessionStorage.setItem('draft-test-initialized', '1')
    sessionStorage.setItem('campus-draft-101', JSON.stringify({
      scenario: 'other', step: 1, key: '736f0462-0738-48ef-bc2d-7fb27fd96430',
      start: '', end: '', missed: [], subject: '', certificate: '',
      category: 'study', comment: 'Сохранённый вопрос',
    }))
  })

  await page.goto('/lks#app/new')
  await expect(page.getByLabel('Опишите вопрос')).toHaveValue('Сохранённый вопрос')
  const back = page.getByRole('button', { name: 'Назад', exact: true })
  await back.click()
  await back.click()
  await page.getByRole('button', { name: /Мне нужна справка/ }).click()
  await page.getByLabel('Какой документ вам нужен?').selectOption('study')
  await page.reload()
  await expect(page.getByLabel('Какой документ вам нужен?')).toHaveValue('study')
  await back.click()
  await page.getByRole('button', { name: /Не знаю, куда обратиться/ }).click()
  await expect(page.getByLabel('О чём ваш вопрос?')).toHaveValue('study')
  await page.getByRole('button', { name: 'Далее', exact: true }).click()
  await expect(page.getByLabel('Опишите вопрос')).toHaveValue('Сохранённый вопрос')
})

test('submitting a certificate preserves a different draft and its attachment', async ({ page }) => {
  await mockProfile(page)
  await page.route('**/api/schedule/missed?*', route => route.fulfill({ json: [] }))
  await page.route('**/api/requests', route => route.fulfill({ json: {
    id: 'cabinet-test', number: 'Д-101', scenario: 'certificate', status: 'submitted',
  } }))
  await page.goto('/lks#app/new')
  const next = page.getByRole('button', { name: 'Далее', exact: true })
  const back = page.getByRole('button', { name: 'Назад', exact: true })

  await page.getByRole('button', { name: /Я заболел/ }).click()
  await next.click()
  await next.click()
  await page.getByLabel('Демонстрационный документ').setInputFiles({
    name: 'demo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4'),
  })
  await expect(page.getByText('demo.pdf', { exact: true })).toBeVisible()
  await back.click()
  await back.click()
  await back.click()
  await page.getByRole('button', { name: /Мне нужна справка/ }).click()
  await page.getByLabel('Какой документ вам нужен?').selectOption('study')
  await page.getByLabel('Фото подтверждающего документа').setInputFiles(confirmationPhoto)
  await expect(page.getByText('demo.pdf', { exact: true })).toHaveCount(0)
  await next.click()
  const request = page.waitForRequest(request => request.url().endsWith('/api/requests') && request.method() === 'POST')
  await page.getByRole('button', { name: 'Отправить обращение' }).click()
  const submitted = await request
  expect(submitted.headers()['content-type']).toContain('multipart/form-data')
  expect(submitted.postData()).toContain('filename="confirmation.png"')
  expect(submitted.postData()).toContain('{"scenario":"certificate","details":{"certificate_type":"study","comment":""}}')
  expect(submitted.postData()).not.toContain('demo.pdf')

  await page.getByRole('button', { name: 'Создать ещё обращение' }).click()
  await page.getByRole('button', { name: /Я заболел/ }).click()
  await next.click()
  await next.click()
  await expect(page.getByText('demo.pdf', { exact: true })).toBeVisible()
  await expect(page.getByText(/Выберите файл снова/)).toHaveCount(0)
})

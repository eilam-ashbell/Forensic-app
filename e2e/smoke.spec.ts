import { test, expect } from '@playwright/test'
import path from 'path'
import { makeTiny64Png } from '../test/fixtures/generate'
import * as fs from 'fs'
import * as os from 'os'

// Write a temp PNG fixture to disk so Playwright can upload it
let tmpPng: string
test.beforeAll(() => {
  const bytes = makeTiny64Png()
  tmpPng = path.join(os.tmpdir(), 'ifw-test-fixture.png')
  fs.writeFileSync(tmpPng, bytes)
})
test.afterAll(() => {
  if (tmpPng && fs.existsSync(tmpPng)) fs.unlinkSync(tmpPng)
})

test('app loads with correct title', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/IFW|Image Forensics/)
})

test('no uncaught console errors on load', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  await page.goto('/')
  await page.waitForTimeout(1000)
  expect(errors).toHaveLength(0)
})

test('file open shows image dimensions in TopBar', async ({ page }) => {
  await page.goto('/')

  // Upload via the hidden file input
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(tmpPng)

  // Wait for dimensions to appear (format: WxH)
  await expect(page.locator('text=/64.?×.?64/')).toBeVisible({ timeout: 10_000 })
})

test('Export button appears after image load', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles(tmpPng)
  await expect(page.locator('[aria-label="Open export dialog"]')).toBeVisible({ timeout: 10_000 })
})

test('Export dialog opens and shows tool count', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles(tmpPng)
  await page.locator('[aria-label="Open export dialog"]').click()
  await expect(page.locator('text=/tools? completed/')).toBeVisible()
})

test('Results drawer expands and collapses', async ({ page }) => {
  await page.goto('/')
  const drawerToggle = page.locator('[aria-label="Collapse results drawer"]')
  await expect(drawerToggle).toBeVisible()
  await drawerToggle.click()
  await expect(page.locator('[aria-label="Expand results drawer"]')).toBeVisible()
})

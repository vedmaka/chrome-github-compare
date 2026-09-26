// Check SPA entry, row hydration before paint, and observer stability
async page => {
  const home = 'https://github.com/WikiTeq/Taqasta/'
  const hashes = ['a'.repeat(40), 'b'.repeat(40)]
  const rows = hashes.map((hash) => `
    <li>
      <a href="/WikiTeq/Taqasta/commit/${hash}">Commit ${hash.slice(0, 7)}</a>
      <a aria-label="Browse repository at this point" href="/WikiTeq/Taqasta/tree/${hash}">Browse</a>
    </li>
  `).join('')

  await page.route(home, (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<main><div><button data-testid="branch-selector-button">master</button></div><ul id="rows"></ul></main>'
  }))
  await page.goto(home)
  await page.addScriptTag({ path: 'src/compare.js' })
  await page.addScriptTag({ path: 'src/content.js' })

  await page.evaluate((markup) => {
    history.pushState({}, '', '/WikiTeq/Taqasta/commits/master/')
    document.querySelector('#rows').innerHTML = markup
  }, rows)
  await page.waitForFunction(() => document.querySelectorAll('.gh-compare-checkbox').length === 2)
  await page.locator('.gh-compare-checkbox').nth(0).check()
  await page.locator('.gh-compare-checkbox').nth(1).check()

  const controlsBeforeNextPaint = await page.evaluate((markup) => new Promise((resolve) => {
    document.querySelector('#rows').innerHTML = markup
    requestAnimationFrame(() => resolve(document.querySelectorAll('.gh-compare-checkbox').length))
  }), rows)
  if (controlsBeforeNextPaint !== 2) {
    throw new Error(`Commit controls blinked during hydration: ${controlsBeforeNextPaint} before paint`)
  }
  await page.waitForFunction(() => {
    const controls = [...document.querySelectorAll('.gh-compare-checkbox')]
    return controls.length === 2 && controls.every((control) => control.checked)
  })
  await page.waitForTimeout(300)

  const result = await page.evaluate(() => ({
    controls: document.querySelectorAll('.gh-compare-checkbox').length,
    checked: document.querySelectorAll('.gh-compare-checkbox:checked').length,
    label: document.querySelector('#gh-compare-button')?.textContent
  }))
  if (result.controls !== 2 || result.checked !== 2 || result.label !== 'Compare bbbbbbb..aaaaaaa') {
    throw new Error(`Hydration check failed: ${JSON.stringify(result)}`)
  }
  return result
}

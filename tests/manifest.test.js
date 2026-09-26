const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

test('loads on GitHub repository pages before SPA navigation to commits', () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8')
  )

  assert.equal(manifest.manifest_version, 3)
  assert.equal(manifest.default_locale, 'en')
  assert.equal(manifest.name, '__MSG_extensionName__')
  assert.equal(manifest.description, '__MSG_extensionDescription__')
  assert.deepEqual(manifest.icons, {
    16: 'assets/icons/icon-16.png',
    32: 'assets/icons/icon-32.png',
    48: 'assets/icons/icon-48.png',
    128: 'assets/icons/icon-128.png'
  })
  assert.deepEqual(manifest.permissions || [], [])
  assert.deepEqual(manifest.content_scripts, [
    {
      matches: ['https://github.com/*/*'],
      js: ['src/compare.js', 'src/content.js'],
      css: ['src/styles.css'],
      run_at: 'document_idle'
    }
  ])
})

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', 'store-listing')
const locales = ['en', 'es', 'fi', 'hi', 'hr', 'id', 'ru', 'sr']
const headings = [
  '# GitHub Commit Compare',
  '## Summary',
  '## Description',
  '## Single purpose',
  '## Privacy',
  '## Permissions',
  '## Support',
  '## Screenshot alt text'
]

test('provides complete translated listing fields', () => {
  for (const locale of locales) {
    const content = fs.readFileSync(path.join(root, `${locale}.md`), 'utf8')
    const sections = content.split(/(?=^##? )/m).filter(Boolean)
    assert.deepEqual(sections.map((section) => section.split('\n')[0]), headings, locale)
    for (const section of sections.slice(1)) {
      assert.ok(section.split('\n').slice(1).join('\n').trim(), locale)
    }
    assert.ok(content.includes('god.vedmaka@gmail.com'), locale)
    assert.ok(!/\b(?:TODO|TBD)\b/.test(content), locale)
  }
})

test('English listing discloses GitHub independence', () => {
  const content = fs.readFileSync(path.join(root, 'en.md'), 'utf8')
  assert.ok(content.includes('not affiliated with or endorsed by GitHub'))
})

test('listing access scope agrees with the repository-page manifest match', () => {
  for (const locale of locales) {
    const content = fs.readFileSync(path.join(root, `${locale}.md`), 'utf8')
    assert.ok(content.includes('https://github.com/*/*`'), locale)
    assert.ok(!content.includes('https://github.com/*/*/commits/*'), locale)
  }
})

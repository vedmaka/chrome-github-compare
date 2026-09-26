const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const locales = ['en', 'es', 'fi', 'hi', 'hr', 'id', 'ru', 'sr']
const keys = [
  'compareCommits',
  'compareSelectedCommits',
  'extensionDescription',
  'extensionName',
  'selectCommit'
]

function catalog(locale) {
  return JSON.parse(fs.readFileSync(path.join(root, '_locales', locale, 'messages.json'), 'utf8'))
}

test('provides complete, nonempty catalogs for supported locales', () => {
  assert.deepEqual(fs.readdirSync(path.join(root, '_locales')).sort(), locales)
  for (const locale of locales) {
    const messages = catalog(locale)
    assert.deepEqual(Object.keys(messages).sort(), keys, locale)
    for (const [key, value] of Object.entries(messages)) {
      assert.ok(value.message.trim(), `${locale}.${key}`)
    }
  }
})

test('keeps dynamic placeholders consistent with English', () => {
  const english = catalog('en')
  assert.deepEqual(english.selectCommit.placeholders, { hash: { content: '$1' } })
  assert.deepEqual(english.compareCommits.placeholders, {
    older: { content: '$1' },
    newer: { content: '$2' }
  })
  for (const locale of locales) {
    const messages = catalog(locale)
    for (const key of keys) {
      assert.deepEqual(messages[key].placeholders || {}, english[key].placeholders || {}, `${locale}.${key}`)
    }
  }
})

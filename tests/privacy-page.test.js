const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')

test('GitHub Pages policy keeps the text from PRIVACY.md', () => {
  const markdown = fs.readFileSync(path.join(root, 'PRIVACY.md'), 'utf8')
  const html = fs.readFileSync(path.join(root, 'docs', 'index.html'), 'utf8')
  const pageText = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  const paragraphs = markdown.split(/\n\s*\n/).slice(1)

  assert.ok(!html.includes('god.vedmaka@gmail.com'))
  for (const paragraph of paragraphs) {
    assert.ok(pageText.includes(paragraph.replace(/\s+/g, ' ')), paragraph)
  }
})

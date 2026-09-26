const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { createHash } = require('node:crypto')

const root = path.join(__dirname, '..')
const archive = path.join(root, 'dist', 'github-commit-compare-1.0.0.zip')
const locales = ['en', 'es', 'fi', 'hi', 'hr', 'id', 'ru', 'sr']
const runtime = [
  'manifest.json',
  'src/compare.js',
  'src/content.js',
  'src/styles.css',
  ...[16, 32, 48, 128].map((size) => `assets/icons/icon-${size}.png`),
  ...locales.map((locale) => `_locales/${locale}/messages.json`)
].sort()

function build() {
  const result = spawnSync('bash', ['scripts/package.sh'], {
    cwd: root,
    encoding: 'utf8'
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return createHash('sha256').update(fs.readFileSync(archive)).digest('hex')
}

test('packages only runtime files with reproducible bytes', () => {
  const first = build()
  const list = spawnSync('unzip', ['-Z1', archive], { encoding: 'utf8' })
  assert.equal(list.status, 0, list.stderr)
  assert.deepEqual(list.stdout.trim().split('\n').sort(), runtime)
  assert.equal(build(), first)
})

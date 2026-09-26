const test = require('node:test')
const assert = require('node:assert/strict')

const {
  addSelection,
  buildCompareUrl,
  orderSelectedCommits,
  parseCommitHref,
  parseRepositoryPath
} = require('../src/compare.js')

const older = 'b247df270d535c6ac2f9a283f12cd72f0896b64f'
const newer = '4ad4c6218551cbf214c9c6170be0c45ff5dab7d7'

test('accepts a full hexadecimal commit hash', () => {
  assert.equal(
    parseCommitHref(`/Tester/Test/commit/${older}`, 'https://github.com'),
    older
  )
})

test('rejects abbreviated and malformed commit hashes', () => {
  assert.equal(parseCommitHref('/Tester/Test/commit/b247df2', 'https://github.com'), null)
  assert.equal(parseCommitHref('/Tester/Test/commit/not-a-hash', 'https://github.com'), null)
})

test('parses only a GitHub commit-list path', () => {
  assert.deepEqual(parseRepositoryPath('/Tester/Test/commits/master/'), {
    owner: 'Tester',
    repo: 'Test'
  })
  assert.equal(parseRepositoryPath('/Tester/Test/issues'), null)
  assert.equal(parseRepositoryPath('/commits/master'), null)
})

test('keeps the first selection and replaces only the second', () => {
  const a = { hash: 'a'.repeat(40), rowIndex: 0 }
  const b = { hash: 'b'.repeat(40), rowIndex: 1 }
  const c = { hash: 'c'.repeat(40), rowIndex: 2 }
  assert.deepEqual(addSelection(addSelection(addSelection([], a), b), c), [a, c])
  assert.deepEqual(addSelection([a, b], b), [a, b])
})

test('orders commits by row position regardless of click order', () => {
  const expected = { base: older, head: newer }
  const selected = [
    { hash: older, rowIndex: 4 },
    { hash: newer, rowIndex: 1 }
  ]
  assert.deepEqual(orderSelectedCommits(selected), expected)
  assert.deepEqual(orderSelectedCommits([...selected].reverse()), expected)
})

test('builds the native GitHub compare URL', () => {
  assert.equal(
    buildCompareUrl({ owner: 'Tester', repo: 'Test' }, older, newer),
    `https://github.com/Tester/Test/compare/${older}..${newer}`
  )
})

test('encodes repository path segments', () => {
  assert.equal(
    buildCompareUrl({ owner: 'team name', repo: 'repo#1' }, older, newer),
    `https://github.com/team%20name/repo%231/compare/${older}..${newer}`
  )
})

test('rejects invalid compare inputs', () => {
  assert.equal(buildCompareUrl(null, older, newer), null)
  assert.equal(buildCompareUrl({ owner: 'Tester', repo: 'Test' }, 'bad', newer), null)
  assert.equal(orderSelectedCommits([{ hash: older, rowIndex: 1 }]), null)
})

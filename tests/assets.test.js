const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const dimensions = {
  'assets/icons/icon-16.png': [16, 16],
  'assets/icons/icon-32.png': [32, 32],
  'assets/icons/icon-48.png': [48, 48],
  'assets/icons/icon-128.png': [128, 128],
  'store-assets/screenshot-1-1280x800.png': [1280, 800],
  'store-assets/screenshot-2-1280x800.png': [1280, 800],
  'store-assets/small-promo-440x280.png': [440, 280],
  'store-assets/marquee-promo-1400x560.png': [1400, 560]
}
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

test('exports Store images as valid PNG files at required dimensions', () => {
  for (const [name, expected] of Object.entries(dimensions)) {
    const data = fs.readFileSync(path.join(root, name))
    assert.deepEqual(data.subarray(0, 8), signature, name)
    assert.deepEqual([data.readUInt32BE(16), data.readUInt32BE(20)], expected, name)
    assert.ok(data.length > (name.includes('/icons/') ? 250 : 1024), name)
  }
})

const test = require('node:test')
const assert = require('node:assert/strict')

const { createController, start } = require('../src/content.js')

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase()
    this.nodeType = 1
    this.children = []
    this.dataset = {}
    this.listeners = {}
    this.parentElement = null
    this.style = {}
    this.layoutHeight = 0
    this.checked = false
    this.disabled = false
    this.hidden = false
    this.id = ''
    this.className = ''
    this.textContent = ''
  }

  get lastElementChild() {
    return this.children.at(-1) || null
  }

  get nextElementSibling() {
    if (!this.parentElement) return null
    const index = this.parentElement.children.indexOf(this)
    return this.parentElement.children[index + 1] || null
  }

  getBoundingClientRect() {
    return { height: this.layoutHeight }
  }

  append(...children) {
    for (const child of children) {
      child.parentElement = this
      this.children.push(child)
    }
  }

  prepend(child) {
    child.parentElement = this
    this.children.unshift(child)
  }

  remove() {
    if (!this.parentElement) return
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this)
    this.parentElement = null
  }

  addEventListener(type, listener) {
    this.listeners[type] = listener
  }

  setAttribute(name, value) {
    this.attributes ||= {}
    this.attributes[name] = value
  }

  getAttribute(name) {
    return this.attributes?.[name] || null
  }

  after(element) {
    if (element.parentElement) {
      element.parentElement.children = element.parentElement.children.filter(
        (child) => child !== element
      )
    }
    const index = this.parentElement.children.indexOf(this)
    element.parentElement = this.parentElement
    this.parentElement.children.splice(index + 1, 0, element)
  }

  dispatch(type) {
    this.listeners[type]?.({ currentTarget: this })
  }

  find(predicate) {
    if (predicate(this)) return this
    for (const child of this.children) {
      const found = child.find(predicate)
      if (found) return found
    }
    return null
  }

  querySelector(selector) {
    if (selector === 'a[href*="/commit/"]') return this.anchor || null
    if (selector === '.gh-compare-checkbox') {
      return this.find((element) => element.className === 'gh-compare-checkbox')
    }
    if (selector === '.gh-compare-row-control') {
      return this.find((element) => element.className === 'gh-compare-row-control')
    }
    if (selector === '[aria-label="Browse repository at this point"]') {
      return this.find(
        (element) => element.getAttribute('aria-label') === 'Browse repository at this point'
      )
    }
    if (selector === '[data-testid="branch-selector-button"]') {
      return this.find(
        (element) => element.getAttribute('data-testid') === 'branch-selector-button'
      )
    }
    return null
  }

  querySelectorAll(selector) {
    const matches = []
    this.find((element) => {
      if (selector === 'a' && element.tagName === 'A') matches.push(element)
      return false
    })
    return matches
  }
}

function createFixture(hashes, getMessage = () => '', pathname = '/o/r/commits/main') {
  const body = new FakeElement('body')
  const createToolbar = (branchHeight = 28) => {
    const toolbar = new FakeElement('div')
    const branchSelector = new FakeElement('button')
    branchSelector.setAttribute('data-testid', 'branch-selector-button')
    branchSelector.layoutHeight = branchHeight
    toolbar.append(branchSelector)
    return { toolbar, branchSelector }
  }
  let { toolbar, branchSelector } = createToolbar()
  body.append(toolbar)
  const createRow = (hash) => {
    const row = new FakeElement('li')
    const anchor = new FakeElement('a')
    anchor.href = `https://github.com/o/r/commit/${hash}`
    anchor.closest = () => row
    row.anchor = anchor
    return row
  }
  const rows = hashes.map(createRow)
  body.append(...rows)
  const observers = []
  const queuedTasks = []

  const document = {
    body,
    documentElement: body,
    addEventListener: () => {},
    createElement: (tagName) => new FakeElement(tagName),
    getElementById: (id) => body.find((element) => element.id === id),
    querySelector: (selector) => body.querySelector(selector),
    querySelectorAll: () => rows.map(({ anchor }) => anchor)
  }
  const location = {
    origin: 'https://github.com',
    pathname
  }
  const navigations = []
  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback
      observers.push(this)
    }

    observe(target, options) {
      this.target = target
      this.options = options
    }
  }

  return {
    document,
    location,
    navigations,
    observers,
    queuedTasks,
    rows,
    get branchSelector() {
      return branchSelector
    },
    get toolbar() {
      return toolbar
    },
    flushTasks() {
      while (queuedTasks.length) queuedTasks.shift()()
    },
    replaceRows(nextHashes) {
      const nextRows = nextHashes.map(createRow)
      rows.splice(0, rows.length, ...nextRows)
      body.children = body.children.filter(
        (child) => child === toolbar || child.id === 'gh-compare-action'
      )
      body.append(...nextRows)
    },
    replaceToolbar(branchHeight) {
      toolbar.remove()
      const replacement = createToolbar(branchHeight)
      toolbar = replacement.toolbar
      branchSelector = replacement.branchSelector
      body.prepend(toolbar)
    },
    dependencies: {
      document,
      location,
      getMessage,
      MutationObserver: FakeMutationObserver,
      navigate: (url) => navigations.push(url),
      schedule: (callback) => queuedTasks.push(callback)
    }
  }
}

function checkboxFor(row) {
  return row.find((element) => element.className === 'gh-compare-checkbox')
}

function select(checkbox) {
  checkbox.checked = true
  checkbox.dispatch('change')
}

test('enhances each valid row once across repeated scans', () => {
  const fixture = createFixture(['a'.repeat(40)])
  const controller = createController(fixture.dependencies)

  controller.scan()
  controller.scan()

  assert.equal(fixture.rows[0].children.length, 1)
  assert.ok(checkboxFor(fixture.rows[0]))
})

test('places the compare selector inside the right-side action group', () => {
  const fixture = createFixture(['a'.repeat(40)])
  const actionGroup = new FakeElement('div')
  const browseAction = new FakeElement('a')
  browseAction.setAttribute('aria-label', 'Browse repository at this point')
  actionGroup.append(browseAction)
  fixture.rows[0].append(actionGroup)
  const controller = createController(fixture.dependencies)

  controller.scan()

  const selector = fixture.rows[0].querySelector('.gh-compare-row-control')
  assert.equal(selector.parentElement, actionGroup)
  assert.equal(actionGroup.children.at(-1), selector)
})

test('moves an existing outer-row selector into the right-side action group', () => {
  const hash = 'a'.repeat(40)
  const fixture = createFixture([hash])
  const row = fixture.rows[0]
  const actionGroup = new FakeElement('div')
  const browseAction = new FakeElement('a')
  browseAction.setAttribute('aria-label', 'Browse repository at this point')
  actionGroup.append(browseAction)
  row.append(actionGroup)

  const oldLabel = new FakeElement('label')
  oldLabel.className = 'gh-compare-row-control'
  const oldCheckbox = new FakeElement('input')
  oldCheckbox.className = 'gh-compare-checkbox'
  oldLabel.append(oldCheckbox)
  row.append(oldLabel)
  row.dataset.ghCompareEnhanced = 'true'
  row.dataset.ghCompareHash = hash

  const controller = createController(fixture.dependencies)
  controller.scan()

  assert.equal(oldLabel.parentElement, actionGroup)
  assert.equal(actionGroup.children.at(-1), oldLabel)
})

test('finds the right-side browse action by commit tree URL', () => {
  const hash = 'a'.repeat(40)
  const fixture = createFixture([hash])
  const actionGroup = new FakeElement('div')
  const browseAction = new FakeElement('a')
  browseAction.href = `https://github.com/o/r/tree/${hash}`
  actionGroup.append(browseAction)
  fixture.rows[0].append(actionGroup)
  const controller = createController(fixture.dependencies)

  controller.scan()

  const selector = fixture.rows[0].querySelector('.gh-compare-row-control')
  assert.equal(selector.parentElement, actionGroup)
  assert.equal(actionGroup.children.at(-1), selector)
})

test('a third selection keeps the first row and replaces the second', () => {
  const fixture = createFixture(['a'.repeat(40), 'b'.repeat(40), 'c'.repeat(40)])
  const controller = createController(fixture.dependencies)
  controller.scan()

  fixture.rows.forEach((row) => select(checkboxFor(row)))

  assert.deepEqual(controller.getSelections().map(({ hash }) => hash), [
    'a'.repeat(40),
    'c'.repeat(40)
  ])
  assert.equal(checkboxFor(fixture.rows[0]).checked, true)
  assert.equal(checkboxFor(fixture.rows[1]).checked, false)
  assert.equal(checkboxFor(fixture.rows[2]).checked, true)
  assert.equal(
    fixture.document.getElementById('gh-compare-button').textContent,
    'Compare ccccccc..aaaaaaa'
  )
})

test('enables comparison only for two selections and navigates on click', () => {
  const fixture = createFixture(['1'.repeat(40), '2'.repeat(40)])
  const controller = createController(fixture.dependencies)
  controller.scan()
  const button = fixture.document.getElementById('gh-compare-button')

  assert.equal(button.disabled, true)
  select(checkboxFor(fixture.rows[0]))
  assert.equal(button.disabled, true)
  select(checkboxFor(fixture.rows[1]))
  assert.equal(button.disabled, false)
  assert.deepEqual(fixture.navigations, [])

  button.dispatch('click')

  assert.deepEqual(fixture.navigations, [
    `https://github.com/o/r/compare/${'2'.repeat(40)}..${'1'.repeat(40)}`
  ])
})

test('shows the compare action only while two commits are selected', () => {
  const fixture = createFixture(['1'.repeat(40), '2'.repeat(40)])
  const controller = createController(fixture.dependencies)
  controller.scan()
  const action = fixture.document.getElementById('gh-compare-action')
  const first = checkboxFor(fixture.rows[0])
  const second = checkboxFor(fixture.rows[1])

  assert.equal(action.hidden, true)
  select(first)
  assert.equal(action.hidden, true)
  select(second)
  assert.equal(action.hidden, false)

  first.checked = false
  first.dispatch('change')
  assert.equal(action.hidden, true)
  assert.equal(
    fixture.document.getElementById('gh-compare-button').textContent,
    'Compare selected commits'
  )
})

test('labels the action with older and newer short hashes', () => {
  const fixture = createFixture(['1'.repeat(40), '2'.repeat(40)])
  const controller = createController(fixture.dependencies)
  controller.scan()

  select(checkboxFor(fixture.rows[1]))
  select(checkboxFor(fixture.rows[0]))

  assert.equal(
    fixture.document.getElementById('gh-compare-button').textContent,
    'Compare 2222222..1111111'
  )
})

test('uses localized selection and comparison labels', () => {
  const fixture = createFixture(['1'.repeat(40), '2'.repeat(40)], (key, values = []) => {
    if (key === 'selectCommit') return `LOCAL SELECT ${values[0]}`
    if (key === 'compareSelectedCommits') return 'LOCAL GENERIC'
    if (key === 'compareCommits') return `LOCAL ${values[0]}..${values[1]}`
    return ''
  })
  const controller = createController(fixture.dependencies)
  controller.scan()

  assert.equal(checkboxFor(fixture.rows[0]).getAttribute('aria-label'), 'LOCAL SELECT 1111111')
  assert.equal(fixture.document.getElementById('gh-compare-button').textContent, 'LOCAL GENERIC')
  select(checkboxFor(fixture.rows[0]))
  select(checkboxFor(fixture.rows[1]))
  assert.equal(
    fixture.document.getElementById('gh-compare-button').textContent,
    'LOCAL 2222222..1111111'
  )
})

test('mounts the compare action after the branch selector', () => {
  const fixture = createFixture(['1'.repeat(40), '2'.repeat(40)])
  const controller = createController(fixture.dependencies)

  controller.scan()

  const action = fixture.document.getElementById('gh-compare-action')
  assert.equal(action.parentElement, fixture.toolbar)
  assert.equal(fixture.branchSelector.nextElementSibling, action)
})

test('keeps remaining toolbar space after the compare action', () => {
  const fixture = createFixture(['1'.repeat(40), '2'.repeat(40)])
  const controller = createController(fixture.dependencies)

  controller.scan()

  const action = fixture.document.getElementById('gh-compare-action')
  assert.equal(action.style.marginRight, 'auto')
})

test('reattaches the compare action after toolbar replacement', () => {
  const fixture = createFixture(['1'.repeat(40), '2'.repeat(40)])
  const controller = createController(fixture.dependencies)
  controller.scan()

  fixture.replaceToolbar()
  controller.scan()

  const action = fixture.document.getElementById('gh-compare-action')
  assert.equal(action.parentElement, fixture.toolbar)
  assert.equal(fixture.branchSelector.nextElementSibling, action)
})

test('matches the live branch dropdown height', () => {
  const fixture = createFixture(['1'.repeat(40), '2'.repeat(40)])
  const controller = createController(fixture.dependencies)

  controller.scan()

  const button = fixture.document.getElementById('gh-compare-button')
  assert.equal(button.style.height, '28px')
})

test('resynchronizes height after toolbar replacement', () => {
  const fixture = createFixture(['1'.repeat(40), '2'.repeat(40)])
  const controller = createController(fixture.dependencies)
  controller.scan()

  fixture.replaceToolbar(32)
  controller.scan()

  const button = fixture.document.getElementById('gh-compare-button')
  assert.equal(button.style.height, '32px')
})

test('removes stale selections when their rows disappear', () => {
  const fixture = createFixture(['a'.repeat(40), 'b'.repeat(40)])
  const controller = createController(fixture.dependencies)
  controller.scan()
  fixture.rows.forEach((row) => select(checkboxFor(row)))
  fixture.rows.pop()

  controller.scan()

  assert.deepEqual(controller.getSelections().map(({ hash }) => hash), ['a'.repeat(40)])
  assert.equal(fixture.document.getElementById('gh-compare-button').disabled, true)
})

test('restores checked controls when GitHub replaces selected rows', () => {
  const hashes = ['a'.repeat(40), 'b'.repeat(40)]
  const fixture = createFixture(hashes)
  const controller = createController(fixture.dependencies)
  controller.scan()
  fixture.rows.forEach((row) => select(checkboxFor(row)))

  fixture.replaceRows(hashes)
  controller.scan()

  assert.equal(checkboxFor(fixture.rows[0]).checked, true)
  assert.equal(checkboxFor(fixture.rows[1]).checked, true)
  assert.equal(fixture.document.getElementById('gh-compare-button').disabled, false)
})

test('rebinds a reused row when its commit changes', () => {
  const fixture = createFixture(['a'.repeat(40)])
  const controller = createController(fixture.dependencies)
  controller.scan()
  const row = fixture.rows[0]

  row.anchor.href = `https://github.com/o/r/commit/${'b'.repeat(40)}`
  controller.scan()
  select(checkboxFor(row))

  assert.deepEqual(controller.getSelections().map(({ hash }) => hash), ['b'.repeat(40)])
  assert.equal(row.children.length, 1)
})

test('repairs an enhanced row whose control was removed', () => {
  const fixture = createFixture(['a'.repeat(40)])
  const controller = createController(fixture.dependencies)
  controller.scan()

  fixture.rows[0].children[0].remove()
  controller.scan()

  assert.ok(checkboxFor(fixture.rows[0]))
  assert.equal(fixture.rows[0].children.length, 1)
})

test('startup watches GitHub row replacement', () => {
  const fixture = createFixture(['a'.repeat(40)])

  start(fixture.dependencies)

  assert.ok(checkboxFor(fixture.rows[0]))
  assert.equal(fixture.observers.length, 1)
  assert.deepEqual(fixture.observers[0].options, { childList: true, subtree: true })
  assert.equal(fixture.queuedTasks.length, 0)
})

test('replaces lost controls once and ignores extension-owned mutations', () => {
  const hashes = ['a'.repeat(40), 'b'.repeat(40)]
  const fixture = createFixture(hashes)
  start(fixture.dependencies)
  fixture.rows.forEach((row) => select(checkboxFor(row)))
  const oldRows = [...fixture.rows]

  fixture.replaceRows(hashes)
  const observer = fixture.observers[0]
  const replacement = {
    target: fixture.document.body,
    addedNodes: fixture.rows,
    removedNodes: oldRows
  }
  observer.callback([replacement])
  observer.callback([replacement])

  assert.equal(fixture.queuedTasks.length, 1)
  fixture.flushTasks()
  assert.equal(checkboxFor(fixture.rows[0]).checked, true)
  assert.equal(checkboxFor(fixture.rows[1]).checked, true)

  observer.callback([{
    target: fixture.rows[0],
    addedNodes: [fixture.rows[0].querySelector('.gh-compare-row-control')],
    removedNodes: []
  }])
  observer.callback([{
    target: fixture.document.getElementById('gh-compare-button'),
    addedNodes: [{ nodeType: 3 }],
    removedNodes: [{ nodeType: 3 }]
  }])
  assert.equal(fixture.queuedTasks.length, 0)
})

test('reattaches the compare action when GitHub replaces the branch toolbar', () => {
  const fixture = createFixture(['a'.repeat(40), 'b'.repeat(40)])
  start(fixture.dependencies)
  const oldToolbar = fixture.toolbar

  fixture.replaceToolbar(32)
  fixture.observers[0].callback([{
    target: fixture.document.body,
    addedNodes: [fixture.toolbar],
    removedNodes: [oldToolbar]
  }])
  fixture.flushTasks()

  const action = fixture.document.getElementById('gh-compare-action')
  assert.equal(action.parentElement, fixture.toolbar)
  assert.equal(fixture.branchSelector.nextElementSibling, action)
})

test('enhances commits after SPA navigation from the repository homepage', () => {
  const fixture = createFixture([], () => '', '/o/r')
  start(fixture.dependencies)
  assert.equal(fixture.document.getElementById('gh-compare-action'), null)

  fixture.location.pathname = '/o/r/commits/main'
  fixture.replaceRows(['a'.repeat(40), 'b'.repeat(40)])
  fixture.observers[0].callback([{
    target: fixture.document.body,
    addedNodes: fixture.rows,
    removedNodes: []
  }])
  fixture.flushTasks()

  assert.ok(checkboxFor(fixture.rows[0]))
  assert.ok(checkboxFor(fixture.rows[1]))
  assert.ok(fixture.document.getElementById('gh-compare-action'))
})

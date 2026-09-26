(function exposeContentScript(root, factory) {
  const compareModel = root.GitHubCommitCompare || (
    typeof module === 'object' && module.exports
      ? require('./compare.js')
      : null
  )
  const api = factory(compareModel)

  if (typeof module === 'object' && module.exports) {
    module.exports = api
  }

  if (root.document && root.location && compareModel) {
    api.start({
      document: root.document,
      location: root.location,
      getMessage: (key, substitutions) => root.chrome?.i18n?.getMessage(key, substitutions) || '',
      MutationObserver: root.MutationObserver,
      schedule: (callback) => root.queueMicrotask(callback),
      navigate: (url) => root.location.assign(url)
    })
  }
})(typeof globalThis === 'object' ? globalThis : this, function createContentScript(model) {
  'use strict'

  const ACTION_ID = 'gh-compare-action'
  const BUTTON_ID = 'gh-compare-button'
  const DEFAULT_BUTTON_LABEL = 'Compare selected commits'

  /** Create the stateful bridge between GitHub's page and the comparison model */
  function createController({
    document,
    location,
    getMessage = () => '',
    MutationObserver,
    schedule = (callback) => queueMicrotask(callback),
    navigate
  }) {
    let selections = []
    let actionContainer = null
    let actionButton = null
    let actionMounted = false
    let scanScheduled = false
    const controls = new Map()
    const rowIndexes = new Map()

    function message(key, substitutions, fallback) {
      return getMessage(key, substitutions) || fallback
    }

    function currentRepository() {
      return model.parseRepositoryPath(location.pathname)
    }

    function linkBelongsToRepository(href, repository) {
      try {
        const segments = new URL(href, location.origin).pathname.split('/').filter(Boolean)
        return (
          decodeURIComponent(segments[0]) === repository.owner &&
          decodeURIComponent(segments[1]) === repository.repo
        )
      } catch {
        return false
      }
    }

    function findRows(repository) {
      const rows = []
      const hashes = new Set()
      const links = document.querySelectorAll('a[href*="/commit/"]')

      for (const link of links) {
        const hash = model.parseCommitHref(link.href, location.origin)
        const row = link.closest('li, .Box-row')

        if (!hash || !row || hashes.has(hash) || !linkBelongsToRepository(link.href, repository)) {
          continue
        }

        hashes.add(hash)
        rows.push({ hash, row })
      }

      return rows
    }

    function findBranchSelector() {
      const selectors = [
        '[data-testid="branch-selector-button"]',
        'button[aria-label="Branch selector"]',
        'summary[aria-label="Branch selector"]',
        '[data-hotkey="w"]'
      ]

      for (const selector of selectors) {
        const match = document.querySelector?.(selector)
        if (match) return match
      }

      const pathSegments = location.pathname.split('/').filter(Boolean)
      const branchName = pathSegments.slice(3).join('/').replace(/\/$/, '')

      return [...(document.querySelectorAll?.('button, summary') || [])].find(
        (candidate) => candidate.textContent.trim() === decodeURIComponent(branchName)
      ) || null
    }

    function placeAction() {
      const branchSelector = findBranchSelector()

      if (!branchSelector) {
        actionMounted = false
        return
      }

      const mountAnchor = branchSelector.closest?.('details') || branchSelector
      const branchHeight = branchSelector.getBoundingClientRect?.().height

      if (actionButton && Number.isFinite(branchHeight) && branchHeight > 0) {
        actionButton.style.height = `${branchHeight}px`
        actionButton.style.minHeight = `${branchHeight}px`
      }

      if (mountAnchor.nextElementSibling !== actionContainer) {
        mountAnchor.after(actionContainer)
      }
      actionMounted = true
    }

    function ensureAction() {
      if (!actionContainer) {
        actionContainer = document.createElement('div')
        actionContainer.id = ACTION_ID
        actionContainer.hidden = true
        actionContainer.style.marginRight = 'auto'

        actionButton = document.createElement('button')
        actionButton.id = BUTTON_ID
        actionButton.type = 'button'
        actionButton.textContent = message('compareSelectedCommits', [], DEFAULT_BUTTON_LABEL)
        actionButton.addEventListener('click', () => {
          const ordered = model.orderSelectedCommits(selections)
          const url = ordered && model.buildCompareUrl(
            currentRepository(),
            ordered.base,
            ordered.head
          )

          if (url) navigate(url)
        })

        actionContainer.append(actionButton)
        document.body.append(actionContainer)
      }

      placeAction()
      return actionButton
    }

    function updateAction() {
      const ready = selections.length === 2 && actionMounted
      const ordered = ready ? model.orderSelectedCommits(selections) : null

      if (actionContainer) actionContainer.hidden = !ready
      if (actionButton) {
        actionButton.disabled = !ready
        const label = ordered
          ? message(
            'compareCommits',
            [ordered.base.slice(0, 7), ordered.head.slice(0, 7)],
            `Compare ${ordered.base.slice(0, 7)}..${ordered.head.slice(0, 7)}`
          )
          : message('compareSelectedCommits', [], DEFAULT_BUTTON_LABEL)
        if (actionButton.textContent !== label) actionButton.textContent = label
      }
    }

    function clearSelections() {
      selections = []
      for (const control of controls.values()) control.checked = false
      updateAction()
    }

    function handleSelection(hash, checkbox) {
      if (!checkbox.checked) {
        selections = selections.filter((selection) => selection.hash !== hash)
        updateAction()
        return
      }

      const previous = selections
      const rowIndex = rowIndexes.get(hash)
      selections = model.addSelection(selections, { hash, rowIndex })

      for (const selection of previous) {
        if (!selections.some((current) => current.hash === selection.hash)) {
          const evicted = controls.get(selection.hash)
          if (evicted) evicted.checked = false
        }
      }

      updateAction()
    }

    function placeRowControl(row, label, hash) {
      const labelledBrowseAction = row.querySelector?.(
        '[aria-label="Browse repository at this point"]'
      )
      const treeBrowseAction = [...(row.querySelectorAll?.('a') || [])].find((action) => {
        try {
          return new URL(action.href, location.origin).pathname.endsWith(`/tree/${hash}`)
        } catch {
          return false
        }
      })
      const browseAction = labelledBrowseAction || treeBrowseAction

      if (browseAction) {
        if (browseAction.nextElementSibling !== label) browseAction.after(label)
        return
      }

      if (row.lastElementChild !== label) row.append(label)
    }

    function enhanceRow({ hash, row }) {
      const currentControl = row.querySelector?.('.gh-compare-checkbox')
      const isCurrentControl = (
        row.dataset.ghCompareEnhanced === 'true' &&
        row.dataset.ghCompareHash === hash &&
        currentControl
      )

      if (isCurrentControl) {
        currentControl.checked = selections.some((selection) => selection.hash === hash)
        controls.set(hash, currentControl)
        placeRowControl(row, currentControl.parentElement, hash)
        return
      }

      row.querySelector?.('.gh-compare-row-control')?.remove()

      const label = document.createElement('label')
      label.className = 'gh-compare-row-control'
      label.title = message(
        'selectCommit',
        [hash.slice(0, 7)],
        `Select commit ${hash.slice(0, 7)} for comparison`
      )

      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.className = 'gh-compare-checkbox'
      checkbox.checked = selections.some((selection) => selection.hash === hash)
      checkbox.setAttribute?.('aria-label', label.title)
      checkbox.addEventListener('change', () => handleSelection(hash, checkbox))

      label.append(checkbox)
      placeRowControl(row, label, hash)
      row.dataset.ghCompareEnhanced = 'true'
      row.dataset.ghCompareHash = hash
      controls.set(hash, checkbox)
    }

    function scan() {
      const repository = currentRepository()

      if (!repository) {
        clearSelections()
        actionContainer?.remove()
        actionMounted = false
        return
      }

      const rows = findRows(repository)
      const visibleHashes = new Set(rows.map(({ hash }) => hash))

      rowIndexes.clear()
      rows.forEach(({ hash }, rowIndex) => rowIndexes.set(hash, rowIndex))
      selections = selections
        .filter(({ hash }) => visibleHashes.has(hash))
        .map(({ hash }) => ({ hash, rowIndex: rowIndexes.get(hash) }))

      for (const hash of controls.keys()) {
        if (!visibleHashes.has(hash)) controls.delete(hash)
      }

      rows.forEach(enhanceRow)
      ensureAction()
      updateAction()
    }

    function containsCommitPageControl(node) {
      if (node.nodeType !== 1) return false

      return [
        'a[href*="/commit/"]',
        '[data-testid="branch-selector-button"]',
        'button[aria-label="Branch selector"]',
        'summary[aria-label="Branch selector"]',
        '[data-hotkey="w"]'
      ].some((selector) => node.matches?.(selector) || node.querySelector?.(selector))
    }

    /** Watch host commit and branch replacements without reacting to our own controls */
    function observe() {
      if (!MutationObserver || !document.body) return

      const observer = new MutationObserver((records) => {
        const relevant = records.some((record) => [
          ...record.addedNodes,
          ...record.removedNodes
        ].some(containsCommitPageControl))
        if (!relevant || scanScheduled) return

        scanScheduled = true
        schedule(() => {
          scanScheduled = false
          scan()
        })
      })
      observer.observe(document.body, { childList: true, subtree: true })
      return observer
    }

    return {
      getSelections: () => selections.map((selection) => ({ ...selection })),
      observe,
      scan
    }
  }

  /** Start the content script after Chrome injects it into a commit-list page */
  function start(dependencies) {
    const controller = createController(dependencies)
    controller.scan()
    controller.observe()
    return controller
  }

  return { createController, start }
})

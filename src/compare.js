(function exposeCompareModel(root, factory) {
  const api = factory()

  if (typeof module === 'object' && module.exports) {
    module.exports = api
  }

  root.GitHubCommitCompare = api
})(typeof globalThis === 'object' ? globalThis : this, function createCompareModel() {
  'use strict'

  const COMMIT_HASH_PATTERN = /^[0-9a-f]{40}$/i

  function isCommitHash(value) {
    return typeof value === 'string' && COMMIT_HASH_PATTERN.test(value)
  }

  /** Extract a full commit hash from a GitHub commit link */
  function parseCommitHref(href, origin) {
    try {
      const url = new URL(href, origin)
      const expectedOrigin = new URL(origin).origin
      const segments = url.pathname.split('/').filter(Boolean)

      if (
        url.origin !== expectedOrigin ||
        segments.length !== 4 ||
        segments[2] !== 'commit' ||
        !isCommitHash(segments[3])
      ) {
        return null
      }

      return segments[3].toLowerCase()
    } catch {
      return null
    }
  }

  /** Read owner and repository names from a GitHub commit-list path */
  function parseRepositoryPath(pathname) {
    const segments = String(pathname).split('/').filter(Boolean)

    if (segments.length < 4 || segments[2] !== 'commits') {
      return null
    }

    try {
      return {
        owner: decodeURIComponent(segments[0]),
        repo: decodeURIComponent(segments[1])
      }
    } catch {
      return null
    }
  }

  /** Add one unique selection, keeping the first slot stable */
  function addSelection(selections, commit) {
    if (selections.some(({ hash }) => hash === commit.hash)) {
      return [...selections]
    }

    if (selections.length < 2) {
      return [...selections, commit]
    }

    return [selections[0], commit]
  }

  /** Convert two selected page rows into GitHub base and head hashes */
  function orderSelectedCommits(selections) {
    if (
      selections.length !== 2 ||
      selections.some(({ hash, rowIndex }) => !isCommitHash(hash) || !Number.isInteger(rowIndex)) ||
      selections[0].rowIndex === selections[1].rowIndex
    ) {
      return null
    }

    const [newer, older] = [...selections].sort((left, right) => left.rowIndex - right.rowIndex)
    return { base: older.hash, head: newer.hash }
  }

  /** Build an absolute GitHub comparison URL from validated inputs */
  function buildCompareUrl(repository, base, head) {
    if (
      !repository ||
      typeof repository.owner !== 'string' ||
      typeof repository.repo !== 'string' ||
      !repository.owner ||
      !repository.repo ||
      !isCommitHash(base) ||
      !isCommitHash(head)
    ) {
      return null
    }

    const owner = encodeURIComponent(repository.owner)
    const repo = encodeURIComponent(repository.repo)
    return `https://github.com/${owner}/${repo}/compare/${base}..${head}`
  }

  return {
    addSelection,
    buildCompareUrl,
    orderSelectedCommits,
    parseCommitHref,
    parseRepositoryPath
  }
})

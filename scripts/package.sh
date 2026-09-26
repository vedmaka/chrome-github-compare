#!/usr/bin/env bash
set -Eeuo pipefail

# Build a reproducible ZIP containing only the files Chrome executes
package_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
command -v python3 >/dev/null || { printf 'python3 is required\n' >&2; exit 1; }

python3 - "$package_root" <<'PY'
import json
import os
from pathlib import Path
import sys
import tempfile
import zipfile

root = Path(sys.argv[1])
manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
if manifest.get('manifest_version') != 3 or manifest.get('default_locale') != 'en':
    raise SystemExit('Manifest localization or version is invalid')

locales = ('en', 'es', 'fi', 'hi', 'hr', 'id', 'ru', 'sr')
keys = {'extensionName', 'extensionDescription', 'selectCommit',
        'compareSelectedCommits', 'compareCommits'}
for locale in locales:
    catalog = json.loads((root / '_locales' / locale / 'messages.json').read_text(encoding='utf-8'))
    if set(catalog) != keys or any(not item.get('message', '').strip() for item in catalog.values()):
        raise SystemExit(f'Incomplete locale catalog: {locale}')

members = sorted([
    'manifest.json',
    'src/compare.js',
    'src/content.js',
    'src/styles.css',
    *(f'assets/icons/icon-{size}.png' for size in (16, 32, 48, 128)),
    *(f'_locales/{locale}/messages.json' for locale in locales),
])
for name in members:
    if not (root / name).is_file():
        raise SystemExit(f'Missing runtime file: {name}')
    if '.DS_Store' in name:
        raise SystemExit('macOS metadata must not enter the package')

output_dir = root / 'dist'
output_dir.mkdir(exist_ok=True)
output = output_dir / f"github-commit-compare-{manifest['version']}.zip"
with tempfile.NamedTemporaryFile(dir=output_dir, suffix='.zip', delete=False) as temporary:
    temporary_name = Path(temporary.name)

try:
    with zipfile.ZipFile(temporary_name, 'w') as package:
        for name in members:
            info = zipfile.ZipInfo(name, date_time=(2020, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            package.writestr(info, (root / name).read_bytes(), compress_type=zipfile.ZIP_DEFLATED,
                             compresslevel=9)
    with zipfile.ZipFile(temporary_name) as package:
        if sorted(package.namelist()) != members or package.testzip() is not None:
            raise SystemExit('ZIP audit failed')
    os.replace(temporary_name, output)
except BaseException:
    temporary_name.unlink(missing_ok=True)
    raise

print(output)
PY

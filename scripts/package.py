"""Validate and package the ready-to-install DAP plugin without extra dependencies."""
from pathlib import Path
import hashlib
import json
import re
import zipfile

root = Path(__file__).resolve().parents[1]
version = json.loads((root / "package.json").read_text())["version"]
manifest = (root / "plugin.yaml").read_text()
assert re.search(rf"^version: {re.escape(version)}$", manifest, re.M)
assert "entry: dap_letsur.plugin:activate" in manifest
skin = json.loads((root / "assets/skin.json").read_text())
catalog = (root / "assets/catalog.js").read_text()
assert catalog.startswith("window.LETSUR_SKIN=")
assert json.loads(catalog.removeprefix("window.LETSUR_SKIN=").strip().removesuffix(";")) == skin
sprite_path = root / skin["spritesheetPath"]
assert sprite_path.resolve().is_relative_to(root.resolve())
sprite = sprite_path.read_bytes()
assert sprite[:8] == b"\x89PNG\r\n\x1a\n" and len(sprite) < 8_000_000
assert int.from_bytes(sprite[16:20], "big") == skin["cell"]["width"] * skin["grid"]["columns"]
assert int.from_bytes(sprite[20:24], "big") == skin["cell"]["height"] * skin["grid"]["rows"]
for clip in skin["animations"].values():
    assert 0 <= clip["row"] < skin["grid"]["rows"]
    assert 1 <= len(clip["holdsMs"]) <= skin["grid"]["columns"]
    assert all(isinstance(t, int) and 20 <= t <= 5000 for t in clip["holdsMs"])
files = [root / name for name in ["plugin.yaml", "README.md", "icon.png", "dap_letsur/plugin.mjs", "assets/skin.json", "assets/catalog.js", skin["spritesheetPath"], "palette/index.html", "palette/style.css", "palette/preview.js"]]
assert all(p.is_file() and not p.is_symlink() for p in files)
assert len(files) <= 200 and sum(p.stat().st_size for p in files) <= 20 * 1024 * 1024
out = root / "dist"
out.mkdir(exist_ok=True)
archive_path = out / f"dap-letsur-skin-v{version}.zip"
with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(files):
        archive.write(path, Path("dap-letsur-skin") / path.relative_to(root))
with zipfile.ZipFile(archive_path) as archive:
    assert archive.testzip() is None
checksum = hashlib.sha256(archive_path.read_bytes()).hexdigest()
(out / "SHA256SUMS.txt").write_text(f"{checksum}  {archive_path.name}\n")
print(f"Packaged {archive_path.name}: {archive_path.stat().st_size:,} bytes; {len(files)} files")

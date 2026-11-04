# Removes Sibelius layout bloat (print, credit, defaults) from MusicXML files, in place.
# Usage: python3 tools/strip_musicxml.py assets/musicxml/**/*.musicxml
import sys, os
from xml.etree import ElementTree as ET
for f in sys.argv[1:]:
    before = os.path.getsize(f)
    tree = ET.parse(f); root = tree.getroot()
    for parent in root.iter():
        for ch in list(parent):
            if ch.tag in ("print", "credit", "defaults"): parent.remove(ch)
    tree.write(f, encoding="utf-8", xml_declaration=True)
    print(f"{f}: {before//1024} KB -> {os.path.getsize(f)//1024} KB")

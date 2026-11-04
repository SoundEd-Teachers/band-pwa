Lincoln Band Workbook v0.2

Run locally (needs a server, files will not load from file://):
  python3 -m http.server 8000      then open http://localhost:8000

Add an exercise:
  1. Put the .musicxml in assets/musicxml/scales, exercises or solos
  2. In tools/make_catalog.py add it to FILES (slot id or name -> path), then run: python3 tools/make_catalog.py
     (or edit the "file" value for that slot directly in catalog.js)
  3. Bump CACHE_NAME in sw.js so students' devices pick up the update
  4. Redeploy to Netlify

Slots with no file show as "not here yet" and open an Oops screen.
tools/strip_musicxml.py removes Sibelius layout data (small savings).
Icons in assets/images are placeholders (192 and 512 px PNG).

# Regenerates catalog.js from the Lincoln Band Portfolio Map.
# FILES lists the filename each slot WILL use (path relative to assets/musicxml/).
# On every run the script looks in assets/musicxml/ and only marks a slot "ready" if the file is really there.
# Matching ignores upper/lower case (Windows does, Netlify does not) and the catalog gets the real spelling.
# Usage:  python tools/make_catalog.py        (run from anywhere; it finds the project folder itself)
import json, os, sys
ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MX = os.path.join(ROOT, "assets", "musicxml")
ON_DISK = {}   # lowercase relative path -> real relative path
for d, _, fs in os.walk(MX):
    for f in fs:
        if f.lower().endswith((".musicxml", ".xml")):
            rel = os.path.relpath(os.path.join(d, f), MX).replace(os.sep, "/")
            ON_DISK[rel.lower()] = rel
FILES = {
  "s1-l1": "scales/bb-maj.musicxml",
  "s1-l2": "scales/g-maj.musicxml",
  "s1-l3": "scales/e-maj.musicxml",
  "s1-l4": "scales/pp-c.musicxml",
  "s1-l5": "scales/pp-a.musicxml",
  "s2-l1": "scales/f-maj.musicxml",
  "s2-l2": "scales/db-maj.musicxml",
  "s2-l3": "scales/b-maj.musicxml",
  "s2-l4": "scales/pp-ab.musicxml",
  "s2-l5": "scales/pp-e.musicxml",
  "s3-l1": "scales/eb-maj.musicxml",
  "s3-l2": "scales/d-maj.musicxml",
  "s3-l3": "scales/pp-bb.musicxml",
  "s3-l4": "scales/pp-g.musicxml",
  "s3-l5": "scales/pp-b.musicxml",
  "s4-l1": "scales/g-min.musicxml",
  "s4-l2": "scales/f-min.musicxml",
  "s4-l3": "scales/e-min.musicxml",
  "s4-l4": "scales/gs-min.musicxml",
  "s4-l5": "scales/cs-min.musicxml",
  "s5-l1": "scales/c-maj.musicxml",
  "s5-l2": "scales/gb-maj.musicxml",
  "s5-l3": "scales/pp-f.musicxml",
  "s5-l4": "scales/pp-db.musicxml",
  "s5-l5": "scales/all-maj.musicxml",
  "s6-l1": "scales/ab-maj.musicxml",
  "s6-l2": "scales/a-maj.musicxml",
  "s6-l3": "scales/pp-eb.musicxml",
  "s6-l4": "scales/pp-d.musicxml",
  "s6-l5": "scales/all-nmin.musicxml",
  "s7-l1": "scales/c-min.musicxml",
  "s7-l2": "scales/a-min.musicxml",
  "s7-l3": "scales/eb-min.musicxml",
  "s7-l4": "scales/pp-gb.musicxml",
  "s7-l5": "scales/all-hmin.musicxml",
  "s8-l1": "scales/d-min.musicxml",
  "s8-l2": "scales/bb-min.musicxml",
  "s8-l3": "scales/b-min.musicxml",
  "s8-l4": "scales/fs-min.musicxml",
  "s8-l5": "scales/all-mmin.musicxml",
  "NF 1": "exercises/nf-1.musicxml",
  "NF 4": "exercises/nf-4.musicxml",
  "1chr": "exercises/1chr.musicxml",
  "NF 2": "exercises/nf-2.musicxml",
  "NF 5": "exercises/nf-5.musicxml",
  "NF 19": "exercises/nf-19.musicxml",
  "NF 20": "exercises/nf-20.musicxml",
  "NF 7": "exercises/nf-7.musicxml",
  "NF 8": "exercises/nf-8.musicxml",
  "NF 17": "exercises/nf-17.musicxml",
  "NF 18": "exercises/nf-18.musicxml",
  "2chr": "exercises/2chr.musicxml",
  "NF 21": "exercises/nf-21.musicxml",
  "NF 22": "exercises/nf-22.musicxml",
  "NF 9": "exercises/nf-9.musicxml",
  "NF 38": "exercises/nf-38.musicxml",
  "NF 10": "exercises/nf-10.musicxml",
  "NF 23 (1-7)": "exercises/nf-23a.musicxml",
  "NF 27": "exercises/nf-27.musicxml",
  "NF 23 (8-12)": "exercises/nf-23b.musicxml",
  "NF 11": "exercises/nf-11.musicxml",
  "NF 15": "exercises/nf-15.musicxml",
  "NF 12": "exercises/nf-12.musicxml",
  "NF 24 (1-7)": "exercises/nf-24a.musicxml",
  "NF 28": "exercises/nf-28.musicxml",
  "NF 24 (8-12)": "exercises/nf-24b.musicxml",
  "NF 25": "exercises/nf-25.musicxml",
  "NF 39": "exercises/nf-39.musicxml",
  "NF 13": "exercises/nf-13.musicxml",
  "NF 26": "exercises/nf-26.musicxml",
  "NF 29": "exercises/nf-29.musicxml",
  "NF 14": "exercises/nf-14.musicxml",
  "NF 16": "exercises/nf-16.musicxml",
  "NF 40": "exercises/nf-40.musicxml",
  # Solos: planned names, rename or edit to match your files
  "Skill Builder / Winter Dance": "solos/skill-builder-winter-dance.musicxml",
  "WMEA JR": "solos/wmea-jr.musicxml",
  "ES 51:5 Bourree": "solos/es-51-5-bourree.musicxml",
  "Danny Boy": "solos/danny-boy.musicxml",
  "54:3 Hornpipe": "solos/54-3-hornpipe.musicxml",
  "54:4 Irish Washerwoman": "solos/54-4-irish-washerwoman.musicxml",
  "ES 56:2 Gavotta": "solos/es-56-2-gavotta.musicxml",
  "ES 63:3 American Square Dance": "solos/es-63-3-american-square-dance.musicxml",
  "ES 70:3 Flight of Bumble Bee": "solos/es-70-3-flight-of-bumble-bee.musicxml",
  "74:3 British Grenadiers": "solos/74-3-british-grenadiers.musicxml",
}
# Display names where the lookup key is not what students should read
NAMES = {"1Chr": "One Octave Chromatic", "2Chr": "Two Octave Chromatic", "NF 16": "NF 16: Bb Eb Ab"}
used, planned, fixed = set(), [], []
def resolve(key):
    p = FILES.get(key)
    if not p: return ""
    real = ON_DISK.get(p.lower())
    if not real:
        planned.append(f"{key} -> {p}"); return ""
    used.add(real)
    if real != p: fixed.append(f"{p} -> {real}")
    return real
SCALES = [  # rows = levels 1-5, columns = Scale 1-8 (concert pitch)
 ["Bb Major","F Major","Eb Major","G Minor","C Major","Ab Major","C Minor","D Minor"],
 ["G Major","Db Major","D Major","F Minor","Gb Major","A Major","A Minor","Bb Minor"],
 ["E Major","B Major","Concert Bb Page","E Minor","Concert F Page","Concert Eb Page","Eb Minor","B Minor"],
 ["Concert C Page","Concert Ab Page","Concert G Page","G# Minor","Concert Db Page","Concert D Page","Concert Gb Page","F# Minor"],
 ["Concert A Page","Concert E Page","Concert B Page","C# Minor","ALL 12 Majors","12 Nat Minor","12 Harmonic","12 Melodic"]]
def scat(n):
    if n.startswith(("ALL 12","12 ")): return "all12"
    if n.startswith("Concert"): return "page"
    return "major" if n.endswith("Major") else "minor"
L,S,T,C,SO = "long","slur","tech","scale","solo"
# slots per level: Ex1, Ex2, Ex3, Solo A, Ex4, Ex5, Ex6, Solo B ; list = two files (ampersand entries)
EX = [
 [("NF 1",L),("NF 4",S),[("1Chr",C)],"Skill Builder / Winter Dance",("NF 2",L),("NF 5",S),[("NF 19",T),("NF 20",T)],"WMEA JR"],
 [[("NF 7",S),("NF 8",S)],[("NF 17",T),("NF 18",T)],[("2Chr",C)],"ES 51:5 Bourree",[("NF 21",T),("NF 22",T)],("NF 9",S),("NF 38",C),"Danny Boy"],
 [("NF 10",S),("NF 23 (1-7)",T),("NF 27",C),"54:3 Hornpipe",("NF 23 (8-12)",T),("NF 11",S),("NF 15",C),"54:4 Irish Washerwoman"],
 [("NF 12",S),("NF 24 (1-7)",T),("NF 28",C),"ES 56:2 Gavotta",("NF 24 (8-12)",T),("NF 25",T),("NF 39",C),"ES 63:3 American Square Dance"],
 [("NF 13",S),("NF 26",T),("NF 29",C),"ES 70:3 Flight of Bumble Bee",("NF 14",S),("NF 16",T),("NF 40",C),"74:3 British Grenadiers"]]
SLOTS = ["Exercise 1","Exercise 2","Exercise 3","Solo A","Exercise 4","Exercise 5","Exercise 6","Solo B"]
items = []
for li,row in enumerate(SCALES,1):
    for ci,n in enumerate(row,1):
        i = f"s{ci}-l{li}"
        items.append(dict(id=i,group="scales",level=li,slot=f"Scale {ci}",name=n,cat=scat(n),file=resolve(i)))
for li,row in enumerate(EX,1):
    for si,cell in enumerate(row):
        cells = cell if isinstance(cell,list) else [cell]
        for k,c in enumerate(cells):
            name,cat = (c,SO) if isinstance(c,str) else c
            items.append(dict(id=f"e{si+1}-l{li}-{k+1}",group="exercises",level=li,slot=SLOTS[si],name=NAMES.get(name,name),cat=cat,file=resolve(name)))
cats = {
 "major":{"name":"Major","color":"#F4A57A"},"minor":{"name":"Minor","color":"#9CCC65"},
 "page":{"name":"Technique","color":"#64B5F6"},"all12":{"name":"All 12","color":"#F06292"},
 "long":{"name":"Long Tone","color":"#42A5F5"},"slur":{"name":"Slur","color":"#FFAB76"},
 "scale":{"name":"Scale","color":"#FFD54F"},"solo":{"name":"Solo","color":"#FF7B7B"}}
cats["tech"]={"name":"Technical","color":"#66BB6A"}
out = "// Generated by tools/make_catalog.py. Set a slot's file (path under assets/musicxml/) when you upload it.\n"
out += "const CATS = "+json.dumps(cats,indent=1)+";\n"
out += "const CATALOG = [\n"+",\n".join(" "+json.dumps(x) for x in items)+"\n];\n"
open(os.path.join(ROOT, "catalog.js"), "w").write(out)
print(len(items),"slots,",sum(1 for x in items if x["file"]),"ready")
if planned: print("\nNot on disk yet (cards show 'not here yet'):\n  "+"\n  ".join(planned))
if fixed: print("\nFile name capitalisation differs from FILES (catalog uses the real name; consider renaming to lowercase):\n  "+"\n  ".join(fixed))
extra = sorted(v for v in ON_DISK.values() if v not in used)
if extra: print("\nOn disk but not used by any slot:\n  "+"\n  ".join(extra))

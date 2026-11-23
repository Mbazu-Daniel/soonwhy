import json, math, sys, statistics as st
R = __import__("os").path.join(__import__("os").path.dirname(__file__), "results") + "/"
METHODS = ["full", "anomalyOnly", "criticalPathOnly", "firstError"]

def wilson(k, n, z=1.96):
    if n == 0: return (0, 0)
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (max(0, c - h), min(1, c + h))

def fmt(k, n):
    lo, hi = wilson(k, n)
    return f"{100*k/n:.1f}% ({lo*100:.0f}-{hi*100:.0f})" if n else "-"

def med(xs):
    xs = sorted(x for x in xs if x is not None)
    return None if not xs else (xs[(len(xs) - 1) // 2] if len(xs) % 2 else (xs[len(xs)//2 - 1] + xs[len(xs)//2]) / 2)

def load(name):
    return json.load(open(R + name + ".json"))

def accuracy(name):
    d = load(name)
    rows = d["rows"]
    faults = [r for r in rows if r["target"]]
    normals = [r for r in rows if not r["target"]]
    out = {"config": d["config"], "n": len(faults)}
    out["detected"] = (sum(r["detected"] for r in faults), len(faults))
    out["medDetectMs"] = med([r["detectionMs"] for r in faults])
    ds = sorted(r["detectionMs"] for r in faults if r["detectionMs"] is not None)
    out["rangeDetectMs"] = (ds[0], ds[-1]) if ds else None
    out["falseAlarm"] = (sum(1 for r in normals if r["detected"] or r["preOnsetFinding"]), len(normals))
    out["preOnset"] = sum(1 for r in faults if r["preOnsetFinding"])
    for m in METHODS:
        fr = [r[f"{m}_finalRank"] for r in faults]
        out[m] = {"top1": (sum(1 for x in fr if x == 1), len(fr)), "top3": (sum(1 for x in fr if x is not None and x <= 3), len(fr))}
    scen = {}
    for r in faults:
        scen.setdefault(r["scenario"], []).append(r)
    out["scen"] = {}
    for s, rs in scen.items():
        out["scen"][s] = {"n": len(rs), "detected": sum(r["detected"] for r in rs), "medDetectMs": med([r["detectionMs"] for r in rs]),
                          **{m: sum(1 for r in rs if r[f"{m}_finalRank"] == 1) for m in METHODS}}
    # by scenario+target
    tg = {}
    for r in faults:
        tg.setdefault((r["scenario"], r["target"]), []).append(r)
    out["targets"] = {f"{s}/{t}": {"n": len(rs), "detected": sum(r["detected"] for r in rs), "top1": sum(1 for r in rs if r["full_finalRank"] == 1), "medDetectMs": med([r["detectionMs"] for r in rs])} for (s, t), rs in tg.items()}
    return out

if __name__ == "__main__":
    for name in sys.argv[1:]:
        a = accuracy(name)
        print("==", name, a["config"])
        print(" detected", fmt(*a["detected"]), "medDetectMs", a["medDetectMs"], a["rangeDetectMs"], "falseAlarm", fmt(*a["falseAlarm"]) if a["falseAlarm"][1] else "-", "preOnset", a["preOnset"])
        for m in METHODS:
            print("  ", m, "top1", fmt(*a[m]["top1"]), "top3", fmt(*a[m]["top3"]))
        for s, v in a["scen"].items():
            print("   scen", s, v)
        for t, v in a["targets"].items():
            print("   tgt", t, v)

"""Shared helpers for the Blender renderer of cine3d dumps (plain Python + mathutils; import inside Blender).
Coordinates: three.js (x, y, z) Y-up  ->  Blender (x, -z, y) Z-up.  Quaternions: q_bl = Rx(+90deg) * q_three.
Both cameras look down their own -Z with +Y up, so a converted camera quaternion needs no further correction."""
import json, math, os
from mathutils import Vector, Quaternion, Matrix

CINE = os.path.realpath(os.path.expanduser('~/cine3d'))
ASSETS = os.path.expanduser('~/studio-assets')
RX90 = Quaternion((1, 0, 0), math.radians(90))


def v3(a):
    """three.js [x, y, z] -> Blender Vector"""
    return Vector((a[0], -a[2], a[1]))


def q3(a):
    """three.js [x, y, z, w] -> Blender Quaternion"""
    return RX90 @ Quaternion((a[3], a[0], a[1], a[2]))


def q3c(a):
    """three.js world rotation -> the SAME rotation acting on Blender vectors (M q M^-1). Use this for rigs whose local axes are
    Blender's (the GLB-imported characters); use q3 for objects whose local frame is three.js's own (the camera, engine-frame children)."""
    return RX90 @ Quaternion((a[3], a[0], a[1], a[2])) @ RX90.inverted()


def hexcol(h, lin=True):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(srgb2lin(x) for x in c) if lin else tuple(c)


def srgb2lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def smooth(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def load_dump(path):
    d = json.load(open(path))
    return d['header'], d['frames']


def hashf(x):
    """deterministic 0..1 hash of a float (same as the engine's hash spirit, not bit-identical)"""
    s = math.sin(x * 127.1 + 311.7) * 43758.5453
    return s - math.floor(s)


def vnoise(t, seed=0.0):
    """smooth value noise in -1..1, a pure function of t"""
    i = math.floor(t); f = t - i; u = f * f * (3 - 2 * f)
    a = hashf(i + seed * 17.3) * 2 - 1; b = hashf(i + 1 + seed * 17.3) * 2 - 1
    return a + (b - a) * u


def args_after_dashes(argv):
    return argv[argv.index('--') + 1:] if '--' in argv else []


def flag(args, name, default=None):
    k = '--' + name
    if k in args:
        i = args.index(k)
        return args[i + 1] if i + 1 < len(args) and not args[i + 1].startswith('--') else True
    return default

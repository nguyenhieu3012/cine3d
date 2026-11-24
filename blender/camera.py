"""The camera, per frame, from the dump: same lens (36 mm tall sensor), same position and aim, same focus.
Allowed upgrades (owner, 15/11), all INSIDE a shot, never across a cut, never changing who is framed or the screen direction:
  - smoothing: the engine's per-frame path is low-passed (centred window, clamped to the shot) so steps and jitters go;
  - handheld drift: a slow, small rotation wander (a few tenths of a degree), a pure function of time;
  - DoF: real thin-lens bokeh from the engine's focus distance and f-stop (blur scale DOF_K).
Frame f of the dump is Blender frame f (t = (f + 0.5) / fps)."""
import bpy, math
from mathutils import Vector, Quaternion, Euler
import c3d
from bake import bake, bake_vec

SMOOTH_HALF = 3        # frames each side of the smoothing window (30 fps)
DRIFT_DEG = 0.18       # handheld wander amplitude (degrees)
DRIFT_HZ = 0.35
EXACT = False         # HYBRID: no smoothing, no drift: the cast is drawn by the engine with ITS camera
DOF_K = 1.4            # 1 = the engine's f-stop; < 1 more blur (1.4: faces in close-ups stay crisp)
FSTOP_MIN = 1.4


def solve(header, frames, drift=True):
    """returns per-frame dicts {loc: Vector, rot: Quaternion, lens, focus, fstop} (Blender space)"""
    n = len(frames)
    P = [c3d.v3(fr['camera']['p']) for fr in frames]
    Q = [c3d.q3(fr['camera']['q']) for fr in frames]
    shot = [fr['shot'] for fr in frames]
    out = []
    import plus
    half = 0 if EXACT else SMOOTH_HALF * (2 if plus.PLUS and header['fps'] >= 60 else 1)   # PLUS at 60 fps: the same window in seconds
    for i, fr in enumerate(frames):
        lo = i; hi = i
        for k in range(1, half + 1):          # window clamped to the shot (a cut stays a cut)
            if i - k >= 0 and shot[i - k] == shot[i]: lo = i - k
            if i + k < n and shot[i + k] == shot[i]: hi = i + k
        m = min(i - lo, hi - i)                     # symmetric window keeps the path centred
        idx = range(i - m, i + m + 1)
        w = [1.0 + m - abs(j - i) for j in idx]; sw = sum(w)
        loc = sum((P[j] * wj for j, wj in zip(idx, w)), Vector()) / sw
        q = None; cum = 0.0
        for j, wj in zip(idx, w):                   # running weighted slerp = weighted mean of nearby rotations
            qj = Q[j] if q is None or Q[j].dot(q) >= 0 else -Q[j]
            q = qj.copy() if q is None else q.slerp(qj, wj / (cum + wj))
            cum += wj
        if drift:
            t = fr['t']
            a = math.radians(DRIFT_DEG)
            e = Euler((a * c3d.vnoise(t * DRIFT_HZ, 1.0), a * c3d.vnoise(t * DRIFT_HZ, 2.0), 0.4 * a * c3d.vnoise(t * DRIFT_HZ * 0.7, 3.0)), 'XYZ')
            q = q @ e.to_quaternion()
        cam = fr['camera']
        out.append({'loc': loc, 'rot': q, 'lens': cam['f_mm'], 'focus': cam['focus'], 'fstop': cam.get('fstop')})
    return out


def build(header, frames, fids, col, drift=True):
    cd = bpy.data.cameras.new('c3d_cam'); cd.sensor_fit = 'VERTICAL'; cd.sensor_height = 36.0; cd.sensor_width = 20.25
    cd.clip_start = 0.05; cd.clip_end = 300
    ob = bpy.data.objects.new('c3d_cam', cd); col.objects.link(ob); ob.rotation_mode = 'QUATERNION'
    bpy.context.scene.camera = ob
    S = solve(header, frames, drift)
    import plus
    if plus.on('camera'): plus.camera_plus(header, frames, S, None)
    bake_vec(ob, 'location', fids, [tuple(s['loc']) for s in S], 'CONSTANT')   # CONSTANT: a cut can never leak into the frame before it
    qs = []; prev = None
    for s in S:
        q = s['rot']
        if prev is not None and prev.dot(q) < 0: q = -q
        qs.append(tuple(q)); prev = q
    bake_vec(ob, 'rotation_quaternion', fids, qs, 'CONSTANT')
    bake(cd, 'lens', 0, fids, [s['lens'] for s in S], 'CONSTANT')
    cd.dof.use_dof = True
    bake(cd, 'dof.focus_distance', 0, fids, [s['focus'] for s in S], 'CONSTANT')
    bake(cd, 'dof.aperture_fstop', 0, fids, [max(FSTOP_MIN, (s['fstop'] or 64.0) * DOF_K) for s in S], 'CONSTANT')
    cd.dof.aperture_blades = 7; cd.dof.aperture_rotation = math.radians(12)
    return ob, S

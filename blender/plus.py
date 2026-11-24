"""SHOWCASE upgrades, all behind switches (render_ep.py --plus motion,props,toon,camera,mblur,faces,atmos). With no --plus nothing here runs
and the baseline renders exactly as before.
  motion  body performance from real clips (Quaternius / authored sitting clips in ~/studio-assets/animations/anim_lib_vrm.blend) retargeted
          onto the chibi rigs: the dump's pose says WHAT, the clip says HOW (spine / chest / head layer, arm arcs into each pose)
  props   Tèo handles the phone (holds, turns it to Bíp, puts it down on the table, picks it up), Bíp drinks his tea during a listening
          stretch, Tèo's free hand slams the table on "Thầy tao khác!" and the things on the table rattle
  toon    squash-and-stretch on reactions (volume preserving), springs on the drawstrings and Bíp's antenna
  camera  moves inside shots (crane-in, arc, rack focus, snap push-in, foreground glass), handheld breathing
  mblur   EEVEE motion blur, modest shutter
Everything is a pure function of the dump (deterministic)."""
import bpy, math, os
from mathutils import Vector, Quaternion, Matrix, Euler
import c3d

PLUS = set()
BIP_SAT = 0.96          # atmos look: Bíp's body saturation (x, HSV, scene-linear: 0.96 reads as about -10 % on screen), cryptomatte mask in the compositor
BIP_NAMES = []
RATTLE_MM = (0.0, 0.5, 2.8, 1.8, 0.5, 1.5, 0.6, 0.1, 0.0)   # table-top pieces' hop (mm) per frame from 2 frames before the slam's landing: decays in ~6 frames
MBLUR_SHUTTER = 0.25   # fraction of a frame the shutter is open (0 on the first and last frame of every shot: see mblur_keys)
LAST = {}   # per character: what animate() computed for the post pass


def on(k):
    return k in PLUS


def fk(k):
    """FAST preset (17/11, 60 fps full film): 'fast' = every step, 'fast_<k>' = one step (benchmarks). Without them nothing changes."""
    return 'fast' in PLUS or ('fast_' + k) in PLUS


# ------------------------------------------------------------------ clip library (VRM rig -> chibi armature space)
CLIPS = ('Sitting_Idle_Loop', 'Sitting_Talking_Loop', 'Sit_Point', 'Sit_FoldArms', 'Sit_PhoneLook', 'Sit_Drink', 'Sit_Nod_Yes')
_LIB = {}
RZ = Quaternion((0, 0, 1), math.pi)   # the VRM rig faces +Y, the chibi armature -Y


def _conj(q):
    return RZ @ q @ RZ.inverted()


def clip_lib():
    """per clip: frames of {chest: quat (armature space delta vs rest), head: quat (relative to chest), handL/handR: hand - shoulder (vector)}"""
    if _LIB: return _LIB
    import sys
    sys.path.insert(0, os.path.join(c3d.ASSETS, '_scripts'))
    import kitlib as K
    lib = os.path.join(c3d.ASSETS, 'characters', 'Teo_B_BaseMale.blend')
    with bpy.data.libraries.load(lib) as (src, dst):
        dst.objects = [n for n in src.objects]
    rig = next(o for o in dst.objects if o and o.type == 'ARMATURE')
    tmp = bpy.data.collections.new('_clips_tmp'); bpy.context.scene.collection.children.link(tmp); tmp.objects.link(rig)
    sc = bpy.context.scene; keep = sc.frame_current
    rest = {b.name: b.matrix_local.to_quaternion() for b in rig.data.bones}
    scale = 0.37 / 0.52
    for name in CLIPS:
        try:
            act = K.apply_clip(rig, name)
        except Exception as e:
            print('PLUS clip missing', name, e); continue
        fa, fb = [int(x) for x in act.frame_range]
        rows = []
        for f in range(fa, fb + 1):
            sc.frame_set(f)
            pb = rig.pose.bones
            chest = pb['J_Bip_C_UpperChest'].matrix.to_quaternion() @ rest['J_Bip_C_UpperChest'].inverted()
            hips = pb['J_Bip_C_Hips'].matrix.to_quaternion() @ rest['J_Bip_C_Hips'].inverted()
            head = pb['J_Bip_C_Head'].matrix.to_quaternion() @ rest['J_Bip_C_Head'].inverted()
            row = {'chest': _conj(hips.inverted() @ chest), 'head': _conj(chest.inverted() @ head)}
            for s in ('L', 'R'):
                row['hand' + s] = RZ @ ((pb[f'J_Bip_{s}_Hand'].head - pb[f'J_Bip_{s}_UpperArm'].head) * scale)
            rows.append(row)
        _LIB[name] = rows
    sc.frame_set(keep)
    for o in list(dst.objects):
        if o: bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.collections.remove(tmp)
    print('PLUS clips', {k: len(v) for k, v in _LIB.items()})
    return _LIB


def sample(name, t, loop=True, fps=24.0):
    rows = clip_lib().get(name)
    if not rows: return None
    n = len(rows); u = t * fps
    u = (u % (n - 1)) if loop else min(max(u, 0), n - 1.001)
    i = int(u); fr = u - i; a, b = rows[i], rows[min(n - 1, i + 1)]
    return {'chest': a['chest'].slerp(b['chest'], fr), 'head': a['head'].slerp(b['head'], fr),
            'handL': a['handL'].lerp(b['handL'], fr), 'handR': a['handR'].lerp(b['handR'], fr)}


def mean_quat(name, key):
    rows = clip_lib().get(name) or []
    q = Quaternion(); w = 0
    for r in rows:
        x = r[key] if r[key].dot(q) >= 0 else -r[key]; w += 1; q = q.slerp(x, 1.0 / w)
    return q


# pose -> the clip that shows HOW a person does it (its hand path into the pose gives the arc)
POSE_CLIP = {'point': 'Sit_Point', 'pointL': 'Sit_Point', 'cross': 'Sit_FoldArms', 'hug': 'Sit_FoldArms', 'phone': 'Sit_PhoneLook', 'cup': 'Sit_Drink'}
BODY_K, HEAD_K, ARC_K = 0.8, 0.45, 0.55


def body_layer(t, talk_w):
    """chest delta (armature space) of a seated person, talking or idle (crossfaded by talk_w), around the clip's mean"""
    a = sample('Sitting_Idle_Loop', t); b = sample('Sitting_Talking_Loop', t)
    if not a or not b: return Quaternion(), Quaternion()
    ca = mean_quat('Sitting_Idle_Loop', 'chest').inverted() @ a['chest']; cb = mean_quat('Sitting_Talking_Loop', 'chest').inverted() @ b['chest']
    ha = mean_quat('Sitting_Idle_Loop', 'head').inverted() @ a['head']; hb = mean_quat('Sitting_Talking_Loop', 'head').inverted() @ b['head']
    c = ca.slerp(cb, talk_w); h = ha.slerp(hb, talk_w)
    return Quaternion().slerp(c, BODY_K), Quaternion().slerp(h, HEAD_K)


def arc_offset(pose, s, k):
    """while a pose blends in (k 0 -> 1), the hand follows the clip's own path into that pose (relative to where the clip ends),
    so it travels on an arc instead of a straight line"""
    nm = POSE_CLIP.get(pose[1])
    if not nm or k <= 0.0 or k >= 1.0: return Vector()
    rows = clip_lib().get(nm)
    if not rows: return Vector()
    n = len(rows); hold = max(2, int(n * 0.45))     # the authored clips reach their pose at ~45 %
    u = min(hold, k * hold); i = int(u); fr = u - i
    key = 'hand' + s
    p = rows[i][key].lerp(rows[min(hold, i + 1)][key], fr)
    end = rows[hold][key]
    straight = rows[0][key].lerp(end, k)
    return (p - straight) * ARC_K


# ------------------------------------------------------------------ deterministic springs
def spring_series(x, fps, hz, zeta):
    w = 2 * math.pi * hz; h = 1.0 / fps / 4; y = x[0]; v = 0.0; out = []
    for tgt in x:
        for _ in range(4):
            v += ((tgt - y) * w * w - v * 2 * zeta * w) * h; y += v * h
        out.append(y)
    return out


def impulse_series(n, events, fps, hz=3.2, zeta=0.35):
    """a damped oscillation started by each (frame, amplitude) event: squash-and-stretch / rattle curves"""
    out = [0.0] * n; w = 2 * math.pi * hz; wd = w * math.sqrt(max(1e-4, 1 - zeta * zeta))
    for f, a in events:
        for i in range(max(0, f), n):
            t = (i - f) / fps
            if t > 1.6: break
            out[i] += a * math.exp(-zeta * w * t) * math.sin(wd * t + 0.0) * (1 if t > 0 else 0)
    return out


# ------------------------------------------------------------------ camera (inside shots only)
def camera_plus(header, frames, S, heads_bl):
    """S: camera.solve output (list of dicts loc/rot/lens/focus/fstop), modified in place.
    heads_bl(fr, who) -> Blender head centre. Moves are eased, start and end inside one shot, so cut frames never change."""
    shots = header['shots']; fps = header['fps']
    by = {}
    for i, fr in enumerate(frames): by.setdefault(fr['shot'], []).append(i)
    ease = lambda x: 0.5 - 0.5 * math.cos(math.pi * min(1, max(0, x)))
    for si, idx in by.items():
        sh = shots[si]; tok = sh['cam']; i0, i1 = idx[0], idx[-1]; L = max(1, i1 - i0)
        subj = 'teo' if 'teo' in tok else ('bip' if 'bip' in tok else None)
        for j in idx:
            u = (j - i0) / L; s = S[j]; fr = frames[j]
            fwd = s['rot'] @ Vector((0, 0, -1)); right = s['rot'] @ Vector((1, 0, 0))
            if si == 0:   # opening: a small crane down into the first line (the camera starts 12 cm higher, looks down at the same face)
                h = c3d.v3(fr['chars'][subj]['head']) if subj else s['loc'] + fwd
                d = 0.12 * (1 - ease(u * 1.3)); new = s['loc'] + Vector((0, 0, d))
                s['rot'] = (h - s['loc']).rotation_difference(h - new) @ s['rot']   # keep looking at the same face
                s['loc'] = new
            elif tok.startswith('two') and sh['t1'] - sh['t0'] < 3:   # a slow arc round the pair, and a rack focus from the speaker to the listener
                mid = (c3d.v3(fr['chars']['teo']['head']) + c3d.v3(fr['chars']['bip']['head'])) / 2
                ang = math.radians(5.0) * (ease(u) - 0.5)
                R = Quaternion((0, 0, 1), ang); s['loc'] = mid + R @ (s['loc'] - mid); s['rot'] = R @ s['rot']
                dt = (c3d.v3(fr['chars']['teo']['head']) - s['loc']).length; db = (c3d.v3(fr['chars']['bip']['head']) - s['loc']).length
                k = ease((u - 0.45) / 0.3); s['focus'] = dt + (db - dt) * k
                s['fstop'] = min(s['fstop'] or 4.0, 2.8)
            elif tok.startswith('ots_'):   # through the foreground glass: 5 cm lower, a shallower stop so the near glass and shoulder melt
                s['loc'] = s['loc'] - Vector((0, 0, 0.05)); s['fstop'] = min(s['fstop'] or 4.0, 2.2)
            elif tok.startswith('ms_teo') and sh['t0'] <= 12.3 <= sh['t1']:   # the snap push-in on "Thầy tao khác!"
                tp = 12.33; tt = fr['t']; k = ease((tt - tp) / 0.16) if tt >= tp else 0.0
                h = c3d.v3(fr['chars']['teo']['head']); v = h - s['loc']; s['loc'] = s['loc'] + v * (0.14 * k)
            elif tok.startswith('ms_') or tok.startswith('cu_'):   # a slow push (eased) toward the subject
                if subj:
                    h = c3d.v3(fr['chars'][subj]['head']); v = h - s['loc']; s['loc'] = s['loc'] + v * (0.04 * ease(u))
            # handheld breathing everywhere: a 0.25 Hz vertical bob of 4 mm and a tiny roll
            t = fr['t']; s['loc'] = s['loc'] + Vector((0, 0, 0.004 * math.sin(2 * math.pi * 0.25 * t + si)))
            s['rot'] = s['rot'] @ Quaternion((0, 0, 1), math.radians(0.12) * math.sin(2 * math.pi * 0.17 * t + 2 * si))
    return S


# ------------------------------------------------------------------ post pass: props, rattle, springs (after the bones are keyed)
def _find_part(arm, part):
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.get('c3d_part') == part and (o.parent == arm):
            return o
    return None


def _pivot_on_bone(arm, bone, obj, top_arm):
    """re-hang a bone-parented part from an empty at `top_arm` (armature-space rest point) so it can swing about that point"""
    from mathutils import Matrix
    B = arm.data.bones[bone]
    e = bpy.data.objects.new(obj.name + '_pivot', None)
    for c in obj.users_collection: c.objects.link(e)
    e.parent = arm; e.parent_type = 'BONE'; e.parent_bone = bone
    e.matrix_parent_inverse = (B.matrix_local @ Matrix.Translation((0, B.length, 0))).inverted()
    e.matrix_basis = Matrix.Translation(top_arm); e.rotation_mode = 'XYZ'
    obj.parent = e; obj.parent_type = 'OBJECT'; obj.matrix_parent_inverse = Matrix.Translation(-top_arm); obj.matrix_basis = Matrix.Identity(4)
    return e


def _ang_vel(qs, fps):
    out = [Vector()]
    for i in range(1, len(qs)):
        d = qs[i] @ qs[i - 1].inverted()
        if d.w < 0: d = -d
        ax, an = d.to_axis_angle(); out.append(Vector(ax) * an * fps)
    return out


def springs(arm, name, fids, fps):
    """drawstrings swing with the chest, Bíp's antenna wobbles after head moves: driven by the bone's angular velocity, damped springs"""
    from bake import bake_vec
    PX = LAST.get(name) or {}
    parts = (('spine', ('spine_cylinder', 'spine_cylinder_02'), 'spine_q', 1.0) if name == 'teo' else ('head', ('antenna', 'antenna_bulb'), 'head_q', 1.0),)
    for bone, names, key, k in parts:
        qs = PX.get(key)
        if not qs: continue
        objs = [o for o in (_find_part(arm, nm) for nm in names) if o]
        if not objs: continue
        vel = _ang_vel(qs, fps)
        ant = objs[0]   # the antenna (Bíp) hangs both parts from its base; each drawstring (Tèo) from its own top
        az = [v.co.z for v in ant.data.vertices]; axx = [v.co.x for v in ant.data.vertices]; ayy = [v.co.y for v in ant.data.vertices]
        ant_base = Vector((sum(axx) / len(axx), sum(ayy) / len(ayy), min(az)))
        for o in objs:
            zs = [v.co.z for v in o.data.vertices]; xs = [v.co.x for v in o.data.vertices]; ys = [v.co.y for v in o.data.vertices]
            top = Vector((sum(xs) / len(xs), sum(ys) / len(ys), max(zs))) if name == 'teo' else ant_base
            e = _pivot_on_bone(arm, bone, o, top)
            gain = (0.05 if name == 'teo' else 0.035) * k
            tx = spring_series([-gain * v.x for v in vel], fps, 2.2 if name == 'teo' else 3.0, 0.18 if name == 'teo' else 0.12)
            ty = spring_series([-gain * v.y for v in vel], fps, 2.2 if name == 'teo' else 3.0, 0.18 if name == 'teo' else 0.12)
            lim = 0.6
            bake_vec(e, 'rotation_euler', fids, [(max(-lim, min(lim, a)), max(-lim, min(lim, b)), 0.0) for a, b in zip(tx, ty)])


def props_post(arms, set_col, header, frames, fids):
    """phone in Tèo's hand <-> on the table, Bíp's glass lifted to drink, things on the table rattle on the slam"""
    from bake import bake_vec, bake
    sc = bpy.context.scene; fps = header['fps']; n = len(fids)
    C = Matrix.Rotation(math.radians(90), 4, 'X')
    # evaluate the hands once per frame
    H = {nm: {'L': [], 'R': []} for nm in arms}
    for f in fids:
        sc.frame_set(f)
        for nm, arm in arms.items():
            for s in ('L', 'R'):
                pb = arm.pose.bones['hand_' + s]; H[nm][s].append(arm.matrix_world @ pb.matrix @ Matrix.Translation((0, pb.bone.length * 0.5, 0)))
    # ---- phone
    ph = bpy.data.objects.get('c3d_phone'); PX = LAST.get('teo') or {}
    if ph is not None and PX.get('phone_w'):
        f_ref = next((i for i, w in enumerate(PX['phone_w']) if w > 0.99), 0)
        sc.frame_set(fids[f_ref]); Wref = ph.matrix_world.copy(); Mh = H['teo']['L'][f_ref]; local = Mh.inverted() @ Wref
        sc.frame_set(fids[0])
        ph.parent = None; ph.rotation_mode = 'QUATERNION'
        tbl = Matrix.Translation(c3d.v3((-0.2, 0.4835 + 0.005, 0.30))) @ (C @ Euler((-math.pi / 2, 0, 0.35), 'ZYX').to_matrix().to_4x4() @ C.inverted())
        locs, rots = [], []; prev = None
        for i in range(n):
            w = PX['phone_w'][i]; tw = PX['phone_turn'][i] if i < len(PX['phone_turn']) else 0
            held = H['teo']['L'][i] @ local @ Matrix.Rotation(1.15 * tw, 4, 'Z')
            M = held if w > 0.5 else tbl
            l, r, _ = M.decompose()
            if prev is not None and prev.dot(r) < 0: r = -r
            prev = r; locs.append(tuple(l)); rots.append(tuple(r))
        bake_vec(ph, 'location', fids, locs, 'LINEAR'); bake_vec(ph, 'rotation_quaternion', fids, rots, 'LINEAR')
        bake_vec(ph, 'scale', fids, [(1, 1, 1)] * n, 'CONSTANT')
    # ---- table-top pieces (set meshes on the table, the dynamic phone excluded)
    tops = []
    for o in set_col.all_objects:
        if o.type != 'MESH' or o.get('c3d_dyn'): continue
        bb = [o.matrix_world @ Vector(c) for c in o.bound_box]; cx = sum(v.x for v in bb) / 8; cy = sum(v.y for v in bb) / 8; zlo = min(v.z for v in bb); zhi = max(v.z for v in bb)
        if -0.43 < cx < 0.43 and -0.67 < cy < -0.17 and zlo > 0.47 and zhi < 0.75: tops.append((o, Vector((cx, cy, zlo))))
    glass = []
    B = LAST.get('bip') or {}
    if B.get('drink'):
        g0 = c3d.v3((0.24, 0.478, 0.44))
        glass = [o for o, c in tops if (Vector((c.x, c.y)) - Vector((g0.x, g0.y))).length < 0.06]
    slam = (LAST.get('teo') or {}).get('slam')
    s_i = int(round((slam - frames[0]['t']) * fps)) if slam else None
    hand_side = None
    if glass:
        t0, t1 = B['drink']; i0 = max(0, int((t0 - frames[0]['t']) * fps)); i1 = min(n - 1, int((t1 - frames[0]['t']) * fps))
        gc = c3d.v3((0.24, 0.478, 0.44))
        hand_side = min(('L', 'R'), key=lambda s: (H['bip'][s][i0 + int((i1 - i0) * 0.17)].to_translation() - gc).length)
        ig = i0 + int((i1 - i0) * 0.17); ir = i0 + int((i1 - i0) * 0.88)
        # the glass must sit IN the palm, not where it happened to be when the hand arrived: one world offset (taken at the grab
        # frame) slides it into the hand over the first 5 frames of the lift and back out over the last 5, so nothing pops
        pts = [o.matrix_world @ Vector(cc) for o in glass for cc in o.bound_box]
        gcen = sum(pts, Vector()) / len(pts); hp = H['bip'][hand_side][ig].to_translation()
        # Bíp's short arm cannot reach the glass where cine3d left it: the glass stands (all clip long) where his hand gets to,
        # 4.5 cm beyond the palm toward its old spot, kept on the table top, so the grab is a real touch and the slide stays small
        hz = Vector((gcen.x - hp.x, gcen.y - hp.y, 0)); hz = hz.normalized() if hz.length > 1e-6 else Vector((0, -1, 0))
        new_xy = Vector((hp.x, hp.y, 0)) + hz * 0.045
        new_xy.x = min(0.39, max(-0.39, new_xy.x)); new_xy.y = min(-0.21, max(-0.63, new_xy.y))
        shift = Vector((new_xy.x - gcen.x, new_xy.y - gcen.y, 0.0))
        print(f'PLUS glass: centre {tuple(round(x, 3) for x in gcen)}, palm at grab {tuple(round(x, 3) for x in hp)}, glass moved {shift.length * 100:.1f} cm')
        gcen = gcen + shift; v = gcen - hp
        corr = (hp + v.normalized() * min(v.length, 0.045)) - gcen if v.length > 1e-6 else Vector()
        print(f'PLUS glass: hand-glass gap at grab {v.length * 100:.1f} cm -> {min(v.length, 0.045) * 100:.1f} cm')
    for o, c in tops:
        rest = o.matrix_world.copy(); o.parent = None; o.matrix_world = rest; o.rotation_mode = 'QUATERNION'
        if glass and o in glass: rest = Matrix.Translation(shift) @ rest
        locs, rots = [], []
        rel = H['bip'][hand_side][ig].inverted() @ rest if (glass and o in glass) else None
        for i in range(n):
            M = rest
            if rel is not None and ig <= i <= ir:
                u = (i - i0) / max(1, (i1 - i0)); tilt = 0.55 * (0.5 - 0.5 * math.cos(math.pi * min(1, max(0, (u - 0.34) / 0.1)))) * (1 - (0.5 - 0.5 * math.cos(math.pi * min(1, max(0, (u - 0.62) / 0.1)))))
                k = min(1.0, (i - ig) / 5.0, (ir - i) / 5.0); k = 0.5 - 0.5 * math.cos(math.pi * max(0.0, k))
                M = H['bip'][hand_side][i] @ H['bip'][hand_side][ig].inverted() @ Matrix.Translation(corr * k) @ rest
                M = Matrix.Translation(M.to_translation()) @ Matrix.Rotation(-tilt, 4, 'X') @ Matrix.Translation(-M.to_translation()) @ M
            if s_i is not None:
                # slam rattle (16/11 review): a 6-frame decaying hop of 2-3 mm, each piece a little out of step with its neighbours
                ph_ = (c.x * 13 + c.y * 7) % 1.0; k = i - (s_i - 2) - (1 if ph_ > 0.55 else 0)
                if fps >= 60: k = (i - (s_i - 4) - (2 if ph_ > 0.55 else 0)) // 2   # 60 fps: the same hop in seconds
                if 0 <= k < len(RATTLE_MM):
                    a_ = 0.015 * RATTLE_MM[k] / 2.8 * (-1) ** k   # and a rock of up to 0.9 deg about the piece's base, so a glass visibly wobbles
                    M = Matrix.Translation((0, 0, RATTLE_MM[k] * (0.8 + 0.2 * ph_) * 1e-3)) @ Matrix.Translation(c) @ Matrix.Rotation(a_, 4, 'X') @ Matrix.Translation(-c) @ M
            l, r, _ = M.decompose(); locs.append(tuple(l)); rots.append(tuple(r))
        bake_vec(o, 'location', fids, locs, 'LINEAR'); bake_vec(o, 'rotation_quaternion', fids, rots, 'LINEAR')
    sc.frame_set(fids[0])
    print(f'PLUS props: phone {"on" if ph else "-"}, glass parts {len(glass)}, table pieces {len(tops)}, slam {slam}')


def mblur_keys(frames, fids):
    """motion blur must never span a cut: the shutter is closed (0) on the first and last frame of every shot, CONSTANT-keyed
    (the first frame of a shot would otherwise sample the old shot's camera, the last the new shot's pose). Called after look.setup."""
    if not on('mblur'): return
    from bake import bake
    sc = bpy.context.scene
    sh = [fr['shot'] for fr in frames]; vals = []
    for i in range(len(frames)):
        edge = i == 0 or i == len(frames) - 1 or sh[i] != sh[i - 1] or sh[i] != sh[i + 1]
        vals.append(0.0 if edge else MBLUR_SHUTTER)
    bake(sc, 'render.motion_blur_shutter', 0, fids, vals, 'CONSTANT')
    print(f'PLUS mblur: shutter {MBLUR_SHUTTER}, closed on {sum(1 for v in vals if v == 0)} shot-edge frames')


# ------------------------------------------------------------------ atmos: renderer-side multipliers on the set file's background life
BG_EMIT_K = 2.0       # passing vehicles: headlight / tail-light emission strength and their lamp power (x)
RAIN_ALPHA_K = 1.7    # drizzle streak opacity (the material's mix factor, x)
RAIN_GLOW_K = 1.3     # drizzle streak emission strength (x)
RAIN_WIDTH_K = 1.5    # drizzle streak radius (x)
RAIN_SHIFT = (1.3, 0.9, 0.0)   # a second copy of the drizzle field (x2 count), moved, still beyond the stall line (x >= 1.8, y >= 1.8)


def atmos_boost(set_col):
    """the set file (~/studio-assets, never edited) has a faint drizzle and dim passing headlights; at load the renderer scales them:
    emission strengths / light power / streak radius on the in-memory copies, plus a second copy of the drizzle object"""
    if not on('atmos'): return
    n = 0
    if fk('atmos'):   # FAST: no drizzle, no dust motes, no light shafts, no ground-mist box (the volumes were the biggest cost); kettle steam, moths, puddles, lamps and glow stay
        for o in set_col.all_objects:
            if o.name in ('atmos_rain', 'atmos_dust', 'atmos_mist_box') or o.name.startswith('atmos_cone_'): o.hide_render = True; o.hide_viewport = True
    for m in bpy.data.materials:
        if not m.node_tree: continue
        if m.name.startswith('bg_') and (m.name.endswith('_head') or m.name.endswith('_tail')):
            for nd in m.node_tree.nodes:
                if nd.bl_idname == 'ShaderNodeBsdfPrincipled':
                    nd.inputs['Emission Strength'].default_value *= BG_EMIT_K; n += 1
        if m.name == 'atmos_rain_mat':
            for nd in m.node_tree.nodes:
                if nd.bl_idname == 'ShaderNodeMixShader': nd.inputs[0].default_value = min(1.0, nd.inputs[0].default_value * RAIN_ALPHA_K)
                if nd.bl_idname == 'ShaderNodeEmission': nd.inputs['Strength'].default_value *= RAIN_GLOW_K
    for o in set_col.all_objects:
        if o.type == 'LIGHT' and o.name.startswith('bg_') and (o.name.endswith('_head') or o.name.endswith('_tail')):
            o.data.energy *= BG_EMIT_K; n += 1
    rain = next((o for o in set_col.all_objects if o.name == 'atmos_rain'), None)
    if rain is not None and not fk('atmos'):
        ng = rain.modifiers[0].node_group
        for nd in ng.nodes:
            if nd.bl_idname == 'GeometryNodeMeshCylinder': nd.inputs['Radius'].default_value *= RAIN_WIDTH_K
        r2 = rain.copy(); r2.name = 'atmos_rain_2'
        for c in rain.users_collection: c.objects.link(r2)
        r2.location = r2.location + Vector(RAIN_SHIFT)
    print(f'PLUS atmos boost: {n} emission / lamp values x{BG_EMIT_K}, drizzle alpha x{RAIN_ALPHA_K} width x{RAIN_WIDTH_K} count x2')


def bip_mask(cast_col):
    """Bíp's body parts (not the face, visor, glow, plate, hands): the compositor (cryptomatte mask) desaturates only those"""
    if not on('atmos'): return
    keep = {'torso', 'spine_torus', 'neck', 'head', 'antenna', 'upperarm_L', 'upperarm_R', 'forearm_L', 'forearm_R', 'spine_box'}
    n = 0
    for o in cast_col.all_objects:
        if o.type == 'MESH' and o.get('c3d_char') == 'bip' and o.get('c3d_part') in keep and not o.name.endswith('_ink'):
            BIP_NAMES.append(o.name); n += 1
    print(f'PLUS bip mask: {n} objects, saturation x{BIP_SAT}')

"""GOAT Beef (pack goat) additions to the Blender rig (16/11). Used only when header['pack'] == 'goat'; nothing here runs for Trà đá.
- contact_weights(): how much a hand must be exactly where the engine has it (on the table top, or carrying the flag) instead of where the
  acting layer's springs / anticipation / gestures put it.
- mate(): Leo's mate (the engine's fans.js mateProp(), shown while the pose number `cup` > 0.5, placed at the hand like the phone).
  `cup` is not in the dump's `pose`; dump.cjs --props writes it to props.json["chars"]."""
import bpy, os, json, math
from mathutils import Vector, Quaternion, Matrix, Euler
import c3d
from bake import bake, bake_vec

TOP = 0.90                 # pub table top (world y, three.js)
HAND_ON_TOP = TOP + 0.0425 + 0.006   # centre of a palm lying on the top (gb07_props: TOP + uR + 0.006)
M3 = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))     # three.js -> Blender axes


def _sm(x):
    x = min(1.0, max(0.0, x)); return x * x * (3 - 2 * x)


def contact_weights(frames, name, poses, n):
    """per frame and side ('R' = slot l, 'L' = slot r): 1 while the engine's hand is on the table top (within 4 cm under .. 2 cm over the palm-on-top height,
    ramping to 0 at 12 cm above and 10 cm under) or while a pose named flag* carries the flag; boxcar-smoothed (+-3 frames) so the hand never pops"""
    out = {'L': [0.0] * n, 'R': [0.0] * n}
    for i, fr in enumerate(frames):
        c = fr['chars'][name]; hands = c.get('hands') or {}; p = poses[i]
        k = min(1.0, max(0.0, p[2])); isf = lambda nm: str(nm).startswith('flag')
        wp = (1 - k) * isf(p[0]) + k * isf(p[1])
        for s, slot in (('R', 'l'), ('L', 'r')):
            w = 0.0
            if slot in hands:
                d = hands[slot][1] - HAND_ON_TOP
                w = 1.0 - _sm((d - 0.02) / 0.10) if d > 0.02 else (_sm((d + 0.10) / 0.06) if d < -0.04 else 1.0)
            out[s][i] = max(w, wp if slot in hands else 0.0)
    for s in out:
        v = out[s]; h = 3
        out[s] = [sum(v[max(0, i - h):i + h + 1]) / len(v[max(0, i - h):i + h + 1]) for i in range(n)]
    return out


def _std(name, hexc, rough, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = next(x for x in m.node_tree.nodes if x.bl_idname == 'ShaderNodeBsdfPrincipled')
    b.inputs['Base Color'].default_value = (*c3d.hexcol(hexc), 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    return m


def mate_prop(col):
    """fans.js mateProp(), Blender axes (three y -> z, three z -> -y): gourd ball r .046 (scaled 1.05 tall) at y -.01, metal rim torus R .03 / r .007 at y .04,
    yerba disc r .03 at y .038, bombilla straw r .004 x .16 tall at (.022, .1, .01) leaning .2 rad toward +x. Returns the root object (pivot at the gourd's origin)."""
    from cast_rig import outline
    root = bpy.data.objects.new('c3d_mate', None); col.objects.link(root); root.rotation_mode = 'QUATERNION'
    parts = []
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.046, segments=24, ring_count=16, location=(0, 0, -0.01)); g = bpy.context.active_object; g.scale = (1, 1, 1.05); g.name = 'c3d_mate_gourd'
    g.data.materials.append(_std('c3d_mate_gourd', '#5a3720', 0.55)); parts.append((g, True))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.03, minor_radius=0.007, major_segments=24, minor_segments=8, location=(0, 0, 0.04)); r = bpy.context.active_object; r.name = 'c3d_mate_rim'
    r.data.materials.append(_std('c3d_mate_rim', '#c9ccd2', 0.3, 0.8)); parts.append((r, True))
    bpy.ops.mesh.primitive_circle_add(radius=0.03, vertices=20, fill_type='NGON', location=(0, 0, 0.038)); y = bpy.context.active_object; y.name = 'c3d_mate_yerba'
    y.data.materials.append(_std('c3d_mate_yerba', '#3a5a1a', 1.0)); parts.append((y, False))
    bpy.ops.mesh.primitive_cylinder_add(radius=0.004, depth=0.16, vertices=8, location=(0.022, -0.01, 0.1), rotation=(0, 0.2, 0)); s = bpy.context.active_object; s.name = 'c3d_mate_straw'
    s.data.materials.append(_std('c3d_mate_straw', '#d6d9de', 0.25, 0.9)); parts.append((s, True))
    for o, ink in parts:
        for c in list(o.users_collection): c.objects.unlink(o)
        col.objects.link(o); o.parent = root
        for p in o.data.polygons: p.use_smooth = True
    for o, ink in parts:
        if ink: outline(o, '#140e24', 0.008 * 1.7)
    return root


def mate(name, col, fids, frames, header, tracks, J):
    """key Leo's mate: at the hand centre + the engine's offset (-0.03, -0.005, 0.07) in the BODY frame, tilted (-0.45 cup, 0, 0.1) in that frame, visible while cup > 0.5"""
    pdir = c3d.flag(c3d.args_after_dashes(__import__('sys').argv), 'props-dir', None) or os.path.join(os.path.dirname(header.get('_dump_path', '')), 'props')
    pj = os.path.join(pdir, 'props.json')
    if tracks is None or not os.path.exists(pj):
        print('MATE: no props.json next to the dump (re-export with dump.cjs --props): the mate is skipped'); return None
    P = json.load(open(pj)); F0 = P['first_frame']
    cup = (P.get('chars') or {}).get(name, {}).get('cup')
    if not cup or fids[0] < F0 or fids[-1] >= F0 + len(cup):
        print('MATE: props.json has no cup track for', name, '(or does not cover the frames): skipped'); return None
    ob = mate_prop(col); n = len(fids)
    off = M3 @ Vector((-0.03, -0.005, 0.07))
    locs, rots, hide = [], [], []; prev = None
    for i, fr in enumerate(frames):
        cu = cup[fids[i] - F0] or 0.0
        qb = c3d.q3c(fr['chars'][name]['body_q'])
        R3 = Euler((-0.45 * cu, 0.0, 0.1), 'ZYX').to_matrix()       # three.js 'XYZ' = Rx*Ry*Rz = mathutils 'ZYX'
        q = qb @ (M3 @ R3 @ M3.transposed()).to_quaternion()
        if prev is not None and prev.dot(q) < 0: q = -q
        prev = q
        locs.append(tuple(Vector(tracks['hand_L'][i]) + qb @ off)); rots.append(tuple(q)); hide.append(0.0 if cu > 0.5 else 1.0)
    bake_vec(ob, 'location', fids, locs, 'CONSTANT'); bake_vec(ob, 'rotation_quaternion', fids, rots, 'CONSTANT')
    # visibility on the root's children (an Empty has no hide_render in render): hide every part and its ink hull
    for ch in ob.children_recursive:
        bake(ch, 'hide_render', 0, fids, hide, 'CONSTANT')
    ob['c3d_char'] = name
    print(f'MATE {name}: keyed {n} frames, visible {sum(1 for h in hide if h < 0.5)}')
    return ob

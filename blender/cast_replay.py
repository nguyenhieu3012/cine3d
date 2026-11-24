"""Characters REPLAYED from the engine (20/11): every mesh of a cast member follows the engine's own pose frame by frame (blender/replay.cjs writes
<dump dir>/replay/): standing, leaning, hooded Tèo, Chị Lan, Bíp on a stool with his glass, limb tubes (a mesh cache, exact), hips and head.
No armature and no IK: what the engine computed is what Blender plays. Same look as the rigged cast: the engine's materials (tune_material), the drawn
face as an image sequence, the ink hull outline (rigid parts parented to the part, tubes with their own mesh cache), Line Art flags, light linking names.
Used only for the characters listed in <dump dir>/replay/replay.json; a dump without that folder renders exactly as before."""
import bpy, os, json, math, struct, base64
from mathutils import Matrix, Vector, Quaternion
import c3d
import cast_rig
from bake import bake, bake_vec

C = Matrix.Rotation(math.radians(90), 4, 'X'); Ci = C.inverted()     # three.js -> Blender axes (x, -z, y)
THIN = {'teo': {'spine_box', 'spine_torus', 'hips_torus', 'cuff_L', 'cuff_R'}, 'bip': {'plate', 'spine_box', 'neck', 'spine_torus', 'visor'}}
FLIP_V = False       # face / texture V: three's UV (v up) is Blender's; the GLB route flipped it twice


def replay_dir(dump_path):
    return os.path.join(os.path.dirname(os.path.abspath(dump_path)), 'replay')


def available(dump_path):
    p = os.path.join(replay_dir(dump_path), 'replay.json')
    return os.path.exists(p)


def _f32(b64s):
    import array
    a = array.array('f'); a.frombytes(base64.b64decode(b64s)); return a


def _u32(b64s):
    import array
    a = array.array('I'); a.frombytes(base64.b64decode(b64s)); return a


def material(name, m, rdir, k):
    mat = bpy.data.materials.new(name); mat.use_nodes = True; nt = mat.node_tree
    b = principled(mat)
    if m['color']: b.inputs['Base Color'].default_value = (*c3d.hexcol(m['color']), 1)
    if m['roughness'] is not None: b.inputs['Roughness'].default_value = m['roughness']
    if m['metalness'] is not None: b.inputs['Metallic'].default_value = m['metalness']
    if m['emissive']: b.inputs['Emission Color'].default_value = (*c3d.hexcol(m['emissive']), 1)
    b.inputs['Emission Strength'].default_value = 0.0
    if m['sheen'] > 0:
        b.inputs['Sheen Weight'].default_value = 1.0 if m['sheen'] >= 1 else m['sheen']
        if m['sheenColor']: b.inputs['Sheen Tint'].default_value = (*c3d.hexcol(m['sheenColor']), 1)
    if m['clearcoat'] > 0: b.inputs['Coat Weight'].default_value = m['clearcoat']
    mat.use_backface_culling = (m['side'] != 2)
    if m['transparent'] and m['opacity'] < 1.0:
        b.inputs['Alpha'].default_value = m['opacity']
    if m['transparent']: mat.surface_render_method = 'BLENDED'
    for key, sock in (('mapPng', 'Base Color'), ('emissivePng', 'Emission Color')):
        if m.get(key):
            pth = os.path.join(rdir, f'tex_{k}_{key}.png')
            with open(pth, 'wb') as fh: fh.write(base64.b64decode(m[key]))
            tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = bpy.data.images.load(pth, check_existing=False); tn.image.colorspace_settings.name = 'sRGB'; tn.interpolation = 'Linear'
            nt.links.new(tn.outputs['Color'], b.inputs[sock])
            if key == 'mapPng' and m['transparent']: nt.links.new(tn.outputs['Alpha'], b.inputs['Alpha'])
    return mat


def principled(m):
    return cast_rig.principled(m)


def make_mesh(name, o):
    pos = _f32(o['pos']); n = len(pos) // 3; ix = _u32(o['index'])
    verts = [(pos[i * 3], -pos[i * 3 + 2], pos[i * 3 + 1]) for i in range(n)]
    faces = [(ix[i], ix[i + 1], ix[i + 2]) for i in range(0, len(ix), 3)]
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces)
    if o['uv']:
        uv = _f32(o['uv']); layer = me.uv_layers.new(name='UVMap')
        for li, lp in enumerate(me.loops):
            u, v = uv[lp.vertex_index * 2], uv[lp.vertex_index * 2 + 1]
            layer.data[li].uv = (u, (1 - v) if FLIP_V else v)
    for p in me.polygons: p.use_smooth = True
    if o['nor']:
        nr = _f32(o['nor']); me.normals_split_custom_set_from_vertices([(nr[i * 3], -nr[i * 3 + 2], nr[i * 3 + 1]) for i in range(n)])
    me.update()
    return me


def write_pc2(path, arr, nv, nf, f0):
    """arr: array('f') frames x nv x 3 in Blender axes"""
    with open(path, 'wb') as fh:
        fh.write(b'POINTCACHE2\0' + struct.pack('<iiffi', 1, nv, float(f0), 1.0, nf)); fh.write(arr.tobytes())


def local_to_blender(raw):
    """array('f') of three.js local positions (frames x nv x 3) -> numpy (frames, nv, 3) in Blender axes (x, -z, y)"""
    import numpy as np
    a = np.frombuffer(raw, dtype=np.float32).reshape(-1, 3).copy()
    out = np.empty_like(a); out[:, 0] = a[:, 0]; out[:, 1] = -a[:, 2]; out[:, 2] = a[:, 1]
    return out


def hull_positions(P, faces, thick):
    """P (frames, nv, 3) -> positions pushed out along welded vertex normals by `thick`; faces welded by position in frame 0"""
    import numpy as np
    nf, nv, _ = P.shape
    key = np.round(P[0] * 1e4).astype(np.int64); _, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.reshape(-1)
    nw = inv.max() + 1
    F = np.asarray(faces); i0, i1, i2 = F[:, 0], F[:, 1], F[:, 2]
    Pt = np.transpose(P, (1, 0, 2))                                      # nv, frames, 3
    fn = np.cross(Pt[i1] - Pt[i0], Pt[i2] - Pt[i0])                       # faces, frames, 3 (area weighted)
    Nw = np.zeros((nw, nf, 3), dtype=np.float64)
    for k in (i0, i1, i2): np.add.at(Nw, inv[k], fn)
    ln = np.linalg.norm(Nw, axis=2, keepdims=True); Nw = Nw / np.maximum(ln, 1e-12)
    Nv = Nw[inv]                                                         # nv, frames, 3 (outward if the winding is outward)
    return Pt, Nv


def build(header, frames, fids, col, dump_path, names):
    """build every character in `names` from the replay; returns {name: head empty}"""
    import numpy as np
    rdir = replay_dir(dump_path); R = json.load(open(os.path.join(rdir, 'replay.json')))
    F0 = R['first_frame']; NF = R['frame_count']
    if fids[0] < F0 or fids[-1] >= F0 + NF: raise RuntimeError(f'replay covers frames {F0}-{F0 + NF - 1}, dump {fids[0]}-{fids[-1]}')
    sel = [f - F0 for f in fids]
    faces_dir = os.path.join(os.path.dirname(os.path.abspath(dump_path)), 'faces')
    if os.path.isdir(faces_dir + '2x'): faces_dir += '2x'
    ink = R['ink'] or {}; ink_col = ink.get('color', '#150f28'); ink_t = ink.get('t', 0.0055)
    heads = {}
    for name in names:
        ch = R['chars'][name]; ms = ch['meshes']; K = len(ms)
        mat_all = np.fromfile(os.path.join(rdir, name + '.mat.f32'), dtype=np.float32).reshape(NF, K, 16)
        vis_all = np.fromfile(os.path.join(rdir, name + '.vis.u8'), dtype=np.uint8).reshape(NF, K)
        mt_all = np.fromfile(os.path.join(rdir, name + '.mt.f32'), dtype=np.float32).reshape(NF, K, 2)
        objs = {}; hulls = {}
        for i, m in enumerate(ms):
            if not vis_all[sel, i].any(): continue            # never shown in this range: not built
            me = make_mesh(f'{name}_{m["name"]}', m)
            o = bpy.data.objects.new(f'{name}_{m["name"]}', me); col.objects.link(o)
            mat = material(f'{name}_{m["name"]}_mat', m['material'], rdir, f'{name}_{i}'); me.materials.append(mat)
            e = {'color': m['material']['color'], 'emissive': m['material']['emissive'], 'emissiveIntensity': m['material']['emissiveIntensity'], 'roughness': m['material']['roughness'], 'blending': 'add' if m['material']['additive'] else None}
            cast_rig.tune_material(o, e)
            pname = m['name']
            if pname.startswith('glasses_lens'):
                b = principled(o.data.materials[0])
                if b: b.inputs['Roughness'].default_value = 0.35; b.inputs['Coat Weight'].default_value = 0.0; b.inputs['Specular IOR Level'].default_value = 0.2
                o.data.materials[0].surface_render_method = 'BLENDED'
            if m['face']:
                cast_rig.face_sequence(o, os.path.join(faces_dir, name), fids[0], len(fids), 'additive' if m['material']['additive'] else 'alpha')
                fix_face_uv(o)
            elif m['material']['additive']:
                cast_rig.additive(o.data.materials[0], 1.6)
            # animation: world matrix of the engine, in Blender axes, CONSTANT keys (a cut stays a cut, a hit-stop repeats)
            M = mat_all[sel, i, :]; locs, rots, scs = [], [], []; o.rotation_mode = 'QUATERNION'
            first = None
            for r in M:
                W3 = Matrix([r[0:4].tolist(), r[4:8].tolist(), r[8:12].tolist(), r[12:16].tolist()]).transposed()
                l, q, s = (C @ W3 @ Ci).decompose()
                if rots and rots[-1].dot(q) < 0: q = -q
                locs.append(tuple(l)); rots.append(q); scs.append(tuple(s))
            avg_s = sum(abs(x) for x in scs[0]) / 3 or 1.0
            if len(set(locs)) > 1 or len(set(map(tuple, rots))) > 1 or len(set(scs)) > 1:
                bake_vec(o, 'location', fids, locs, 'CONSTANT'); bake_vec(o, 'rotation_quaternion', fids, [tuple(q) for q in rots], 'CONSTANT'); bake_vec(o, 'scale', fids, scs, 'CONSTANT')
            else:
                o.location = locs[0]; o.rotation_quaternion = rots[0]; o.scale = scs[0]
            hide = [0.0 if v else 1.0 for v in vis_all[sel, i]]
            if len(set(hide)) > 1 or hide[0] == 1.0: bake(o, 'hide_render', 0, fids, hide, 'CONSTANT')
            deform = i in ch['deform']
            if deform:
                raw = open(os.path.join(rdir, f'{name}_{i}.pos.f32'), 'rb').read()
                P = local_to_blender(raw).reshape(NF, -1, 3)
                nv = P.shape[1]; pc2 = os.path.join(rdir, f'{name}_{i}.pc2')
                write_pc2(pc2, __import__('array').array('f', P.astype(np.float32).tobytes()), nv, NF, F0)
                md = o.modifiers.new('c3d_cache', 'MESH_CACHE'); md.cache_format = 'PC2'; md.filepath = pc2; md.interpolation = 'NONE'; md.time_mode = 'FRAME'; md.play_mode = 'SCENE'; md.frame_start = float(F0)
            o['c3d_char'] = name; o['c3d_part'] = pname
            o.visible_shadow = m['cast'] and pname not in ('face', 'spark', 'spark_glow') and not pname.startswith('glasses_lens')
            if m['outline']:
                o['c3d_lines'] = True
                thick = ink_t * cast_rig.OUTLINE_K * (cast_rig.THIN_K if pname in THIN.get(name, ()) else 1.0) / avg_s
                if deform:
                    h = deform_hull(o, me, P, thick, ink_col, F0, NF, rdir, f'{name}_{i}')
                else:
                    h = cast_rig.outline(o, ink_col, thick)
                if len(set(hide)) > 1 or hide[0] == 1.0: bake(h, 'hide_render', 0, fids, hide, 'CONSTANT')
            if deform: o.name = f'{name}_{pname}_{i}_tube'
            objs[i] = o
            if pname == 'head' and name not in heads:
                heads[name] = (o, i)
        # head empty for QA: the head mesh's own frame (centre of the head), keyed like the mesh
        if name in heads:
            ho, hi = heads[name]
            e = bpy.data.objects.new(name + '_head', None); col.objects.link(e); e.rotation_mode = 'QUATERNION'
            M = mat_all[sel, hi, :]; locs, rots = [], []
            for r in M:
                W3 = Matrix([r[0:4].tolist(), r[4:8].tolist(), r[8:12].tolist(), r[12:16].tolist()]).transposed()
                # QA uses the engine head frame (X left, Y up, Z forward) in Blender world axes: a frame-local point p maps to C W3 p, so keep the three.js basis: matrix = C W3
                l, q, s = (C @ W3).decompose()
                if rots and rots[-1].dot(q) < 0: q = -q
                locs.append(tuple(l)); rots.append(tuple(q))
            bake_vec(e, 'location', fids, locs, 'CONSTANT'); bake_vec(e, 'rotation_quaternion', fids, rots, 'CONSTANT')
            heads[name] = e
        print(f'REPLAY {name}: {len(objs)} meshes built of {K}, {len(ch["deform"])} deforming')
    return heads


def fix_face_uv(o):
    pass


def deform_hull(o, me, P, thick, ink_col, F0, NF, rdir, tag):
    """ink hull of a deforming mesh: the mesh with flipped faces, every frame pushed out along its welded vertex normals (its own mesh cache)"""
    import numpy as np, array
    faces = [tuple(p.vertices) for p in me.polygons]
    Pt, Nv = hull_positions(P, faces, thick)
    H = (Pt + Nv * thick).astype(np.float32)                              # nv, frames, 3 (outward: front faces point out)
    Hf = np.ascontiguousarray(np.transpose(H, (1, 0, 2)))                # frames, nv, 3
    hm = bpy.data.meshes.new(o.name + '_ink'); hm.from_pydata([tuple(v) for v in P[0]], [], [tuple(reversed(f)) for f in faces])
    for p in hm.polygons: p.use_smooth = True
    hm.materials.append(cast_rig.ink_material(ink_col))
    h = bpy.data.objects.new(o.name + '_ink', hm)
    for c in o.users_collection: c.objects.link(h)
    h.parent = o; h.matrix_parent_inverse = Matrix.Identity(4)
    pc2 = os.path.join(rdir, tag + '_ink.pc2')
    write_pc2(pc2, array.array('f', Hf.tobytes()), P.shape[1], NF, F0)
    md = h.modifiers.new('c3d_cache', 'MESH_CACHE'); md.cache_format = 'PC2'; md.filepath = pc2; md.interpolation = 'NONE'; md.time_mode = 'FRAME'; md.play_mode = 'SCENE'; md.frame_start = float(F0)
    h.visible_shadow = False
    return h

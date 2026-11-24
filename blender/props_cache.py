"""Scene-level episode props (the cloth / knot an episode's props() adds to the scene) played from the dump's side files.
`node tools/dump.cjs ... --props <dir>` writes <dir>/props.json (+ props_<k>.f32 for deforming meshes); render_ep calls build() when
<dump dir>/props/props.json exists (or --props-dir). Deforming mesh = a Mesh Cache modifier (.pc2 written next to the f32, CONSTANT: no
interpolation, so a hit-stop frame repeats exactly); rigid mesh = world transform keyed CONSTANT. Visibility keyed on hide_render.
The objects join the SET collection so they get the table's key light, the set fill and the rim like everything else on the table.
Nothing here runs without a props.json (the Trà đá baseline is untouched)."""
import bpy, os, json, math, struct
from mathutils import Matrix, Vector, Quaternion
import c3d
from bake import bake, bake_vec

C = Matrix.Rotation(math.radians(90), 4, 'X'); Ci = C.inverted()      # three.js -> Blender axes: v_bl = C v  (x, -z, y)
EMIT_K = 2.2                                                          # same emission boost as cast_rig.tune_material


def material(name, m, pdir=None):
    mat = bpy.data.materials.new(name); mat.use_nodes = True
    b = next(n for n in mat.node_tree.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled')
    b.inputs['Base Color'].default_value = (*c3d.hexcol(m['color'] or '#ffffff'), 1)
    if m.get('roughness') is not None: b.inputs['Roughness'].default_value = m['roughness']
    if m.get('metalness') is not None: b.inputs['Metallic'].default_value = m['metalness']
    ei = float(m.get('emissiveIntensity') or 0); em = m.get('emissive')
    if em and em != '#000000' and ei > 0:
        b.inputs['Emission Color'].default_value = (*c3d.hexcol(em), 1); b.inputs['Emission Strength'].default_value = ei * EMIT_K
    if m.get('mapFile') and pdir:   # a canvas texture the engine drew (18/11: the notebook cover, the QR card): colour map, and the emissive map when the material has one
        tn = mat.node_tree.nodes.new('ShaderNodeTexImage'); tn.image = bpy.data.images.load(os.path.join(pdir, m['mapFile']), check_existing=True); tn.interpolation = 'Linear'
        mat.node_tree.links.new(tn.outputs['Color'], b.inputs['Base Color'])
        if em and em != '#000000' and ei > 0: mat.node_tree.links.new(tn.outputs['Color'], b.inputs['Emission Color'])
    mat.use_backface_culling = (m.get('side', 0) != 2)      # three DoubleSide = 2
    return mat


def write_pc2(path, f32, vcount, nframes, f0):
    """three.js world-space float32 (frames x vcount x xyz) -> PC2 in Blender axes"""
    import array
    a = array.array('f'); a.frombytes(open(f32, 'rb').read())
    out = array.array('f', bytes(len(a) * 4))
    for i in range(0, len(a), 3):
        out[i] = a[i]; out[i + 1] = -a[i + 2]; out[i + 2] = a[i + 1]
    with open(path, 'wb') as fh:
        fh.write(b'POINTCACHE2\0' + struct.pack('<iiffi', 1, vcount, float(f0), 1.0, nframes)); fh.write(out.tobytes())


def build(dump_path, header, frames, fids, set_col, col, a):
    pdir = c3d.flag(a, 'props-dir', None) or os.path.join(os.path.dirname(dump_path), 'props')
    pj = os.path.join(pdir, 'props.json')
    if c3d.flag(a, 'noprops', False) or not os.path.exists(pj): return []
    P = json.load(open(pj)); F0 = P['first_frame']; n = P['frame_count']
    if fids[0] < F0 or fids[-1] >= F0 + n:
        print(f'PROPS cache covers frames {F0}-{F0 + n - 1}, the dump {fids[0]}-{fids[-1]}: skipped'); return []
    made = []
    for m in P['meshes']:
        mt = m['material']
        if mt['type'] == 'MeshBasicMaterial' and mt.get('hasMap'):
            print('PROPS skip', m['id'], '(a soft contact blob: Blender casts its own shadow)'); continue
        me = bpy.data.meshes.new(m['id']); nv = m['vcount']
        if m['deform']:
            first = struct.unpack('<%df' % (nv * 3), open(os.path.join(pdir, m['file']), 'rb').read(nv * 12))
            verts = [(first[i * 3], -first[i * 3 + 2], first[i * 3 + 1]) for i in range(nv)]
        else:
            verts = [(m['pos'][i * 3], -m['pos'][i * 3 + 2], m['pos'][i * 3 + 1]) for i in range(nv)]
        ix = m['index']; faces = [tuple(ix[i:i + 3]) for i in range(0, len(ix), 3)]
        me.from_pydata(verts, [], faces)
        if m.get('uv'):
            uvl = me.uv_layers.new(name='UVMap')
            for li, loop in enumerate(me.loops): uvl.data[li].uv = (m['uv'][loop.vertex_index * 2], (m['uv'][loop.vertex_index * 2 + 1] if mt.get('mapFile') else 1 - m['uv'][loop.vertex_index * 2 + 1]))
        for p in me.polygons: p.use_smooth = True
        me.update()
        o = bpy.data.objects.new('c3dprop_' + m['name'] + m['id'][-2:], me); o['c3d_prop'] = True
        o.data.materials.append(material('c3dprop_' + m['id'], mt, pdir))
        col.objects.link(o)
        if set_col is not None and set_col is not col: set_col.objects.link(o)
        o.visible_shadow = bool(m.get('cast'))
        # visibility, fill-forward per frame
        vis = {f: v for f, v in m['vis']}; cur = 1; vals = []
        for f in fids:
            cur = vis.get(f, cur); vals.append(0.0 if cur else 1.0)
        bake(o, 'hide_render', 0, fids, vals, 'CONSTANT')
        if m['deform']:
            pc2 = os.path.join(pdir, m['file'].replace('.f32', '.pc2'))
            if not os.path.exists(pc2) or os.path.getmtime(pc2) < os.path.getmtime(os.path.join(pdir, m['file'])):
                write_pc2(pc2, os.path.join(pdir, m['file']), nv, m['frames'], F0)
            md = o.modifiers.new('c3d_cache', 'MESH_CACHE'); md.cache_format = 'PC2'; md.filepath = pc2
            md.interpolation = 'NONE'; md.time_mode = 'FRAME'; md.play_mode = 'SCENE'; md.frame_start = float(F0 - 0)
        else:
            mw = {f: w for f, w in m['mw']}; cur = None; locs, rots, scs = [], [], []; o.rotation_mode = 'QUATERNION'
            for f in fids:
                cur = mw.get(f, cur)
                W3 = Matrix([cur[0:4], cur[4:8], cur[8:12], cur[12:16]]).transposed()   # three.js column-major
                l, r, sc = (C @ W3 @ Ci).decompose()
                if rots and rots[-1].dot(r) < 0: r = -r
                locs.append(tuple(l)); rots.append(r); scs.append(tuple(sc))
            bake_vec(o, 'location', fids, locs, 'CONSTANT'); bake_vec(o, 'rotation_quaternion', fids, [tuple(r) for r in rots], 'CONSTANT'); bake_vec(o, 'scale', fids, scs, 'CONSTANT')
        made.append(o)
    print(f'PROPS {len(made)} scene props from {pj}')
    return made

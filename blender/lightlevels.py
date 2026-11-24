"""Stepped stall light levels in Blender (18/11, vay500). Opt-in: runs only when the dump has `header.light_groups` and a per-frame `lg`
(tools/dump.cjs on an episode whose stall has setOpts.steadyLights). Without them nothing changes (every other episode renders as before).
lg = [S, R, B, street, dark] 0..1 per frame (packs/trada/stall.js steadyUpd). What follows it here:
  - every emissive set piece the engine lists in light_groups (c3dset_<i>): its material's Emission Strength is multiplied by the group level (a node multiply keyed per frame,
    one copy of the material per group, so a material shared with another group is not touched);
  - stall_plus extras: STREET collection (emissive materials, lamp lights) and ATMOS light shafts (cone under the bulb = B, cones under lamps = street), BG_LIFE neon / TV / pharmacy cross = street;
  - the cast's own lights: char_key / char_fill / char_rim lose up to half and cool by `dark`; the soft set fill (set only) sinks up to 85 % so the set stays darker than the cast.
The engine's own lights already follow through the dump (their intensity is the engine's)."""
import bpy
import c3d
from bake import bake, bake_vec

COOL = '#cfdcff'


def _lerp(a, b, k): return tuple(x + (y - x) * k for x, y in zip(a, b))


def _scale_material(mat, fids, vals):
    """multiply every emission strength of this (single-user) material by a keyed value"""
    nt = mat.node_tree; socks = []
    for n in list(nt.nodes):
        if n.bl_idname == 'ShaderNodeBsdfPrincipled':
            s = n.inputs['Emission Strength']
            if s.is_linked or s.default_value > 0: socks.append(s)
        elif n.bl_idname == 'ShaderNodeEmission':
            s = n.inputs['Strength']
            if s.is_linked or s.default_value > 0: socks.append(s)
    if not socks: return False
    vn = nt.nodes.new('ShaderNodeValue'); vn.name = 'c3d_lgk'; vn.outputs[0].default_value = 1.0
    for s in socks:
        mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'
        if s.is_linked: nt.links.new(s.links[0].from_socket, mul.inputs[0])
        else: mul.inputs[0].default_value = s.default_value
        nt.links.new(vn.outputs[0], mul.inputs[1]); nt.links.new(mul.outputs[0], s)
    bake(nt, 'nodes["c3d_lgk"].outputs[0].default_value', 0, fids, vals, 'LINEAR')
    return True


def build(header, frames, fids, set_col, col):
    groups = header.get('light_groups')
    if not groups or 'lg' not in frames[0]: return
    lg = [fr['lg'] for fr in frames]
    ser = {'S': [x[0] for x in lg], 'R': [x[1] for x in lg], 'B': [x[2] for x in lg], 'street': [x[3] for x in lg]}; dark = [x[4] for x in lg]
    cache = {}; n_mat = 0

    def key_object(o, grp, mul=1.0):
        nonlocal n_mat
        vals = [v * mul for v in ser[grp]]
        if min(vals) > 0.9999: return
        for slot in o.material_slots:
            m = slot.material
            if not m or not m.use_nodes: continue
            k = (m.name, grp, mul)
            if k not in cache:
                c = m.copy(); c.name = f'{m.name}__lg{grp}'
                cache[k] = c if _scale_material(c, fids, vals) else None
            if cache[k] is not None: slot.material = cache[k]; n_mat += 1

    for grp in ('S', 'R', 'B', 'street'):
        for nm in groups.get(grp, []):
            o = bpy.data.objects.get(nm)
            if o is not None and o.type == 'MESH': key_object(o, grp)
    # stall_plus: STREET (emissive windows / lamp glass, lamp lights), ATMOS shafts, BG_LIFE neon / TV / cross
    extra_street = ('STREET', 'BG_LIFE'); coll = {c.name: c for c in bpy.data.collections}
    for cn in extra_street:
        c = coll.get(cn)
        if not c: continue
        for o in c.all_objects:
            if o.type == 'MESH' and o.name.startswith(('Building', 'street_lamp', 'bg_pharmacy', 'bg_tv')): key_object(o, 'street')
            elif o.type == 'LIGHT' and o.name.startswith(('plus_lamp_light', 'bg_cross_light', 'bg_tv_light')):
                bake(o.data, 'energy', 0, fids, [o.data.energy * v for v in ser['street']])
    a = coll.get('ATMOS')
    if a:
        for o in a.all_objects:
            if o.type != 'MESH': continue
            if o.name == 'atmos_cone_bulb': key_object(o, 'B', 0.35)   # the shaft under the bulb: a soft cone, not a floodlight
            elif o.name.startswith('atmos_cone_lamp'): key_object(o, 'street')
    # the cast's own lights follow the overall darkness (bpy.data.lights by name, made by lights.character_rig / set_fill)
    for nm, k, cool in (('char_key', 0.5, 0.6), ('char_fill', 0.5, 0.0), ('char_rim', 0.35, 0.0), ('set_fill', 0.88, 0.0)):
        ld = bpy.data.lights.get(nm)
        if ld is None: continue
        bake(ld, 'energy', 0, fids, [ld.energy * (1 - k * d) for d in dark])
        if cool > 0: bake_vec(ld, 'color', fids, [_lerp(tuple(ld.color), c3d.hexcol(COOL), cool * d) for d in dark])
    print(f'LIGHT LEVELS: {n_mat} material slots keyed, dark {min(dark):.2f}..{max(dark):.2f}')

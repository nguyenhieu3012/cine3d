"""PLACEHOLDER cast (until the exact cine3d character GLBs + joint maps land in out/chars/): simple shapes in each character's colours,
at the dump's root, body rotation, head position and head rotation, so staging, focus, light and QA can be judged now.
Tèo: yellow hoodie capsule, white head ball (r 0.17). Bíp: blue egg, blue rounded head with a dark visor and two cyan bars.
Child offsets are in the ENGINE's local frame (+Y up, +Z = the way he faces): the keyed quaternions are converted with Rx(90) * q, which maps that frame for us."""
import bpy, bmesh, math
from mathutils import Vector, Quaternion, Matrix
import c3d
from bake import bake_vec


def mat(name, hexc, rough=0.5, emit=None, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*c3d.hexcol(hexc), 1); b.inputs['Roughness'].default_value = rough
    b.inputs['Coat Weight'].default_value = coat
    if emit:
        b.inputs['Emission Color'].default_value = (*c3d.hexcol(emit[0]), 1); b.inputs['Emission Strength'].default_value = emit[1]
    return m


def prim(kind, name, col, m, parent=None, loc=(0, 0, 0), scale=(1, 1, 1), **kw):
    if kind == 'sphere':
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1)
    elif kind == 'cyl':
        bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=1, depth=1)
    else:
        bpy.ops.mesh.primitive_cube_add(size=1)
        bev = bpy.context.active_object.modifiers.new('bevel', 'BEVEL'); bev.width = kw.get('bevel', 0.05); bev.segments = 6
    o = bpy.context.active_object; o.name = name
    for c in list(o.users_collection): c.objects.unlink(o)
    col.objects.link(o)
    o.data.materials.append(m); o.location = loc; o.scale = scale
    bpy.ops.object.shade_smooth()
    if parent: o.parent = parent
    return o


def build(header, frames, fids, col):
    heads = {}
    for name in header['cast']:
        if name not in frames[0]['chars']: continue
        root = bpy.data.objects.new(name + '_root', None); col.objects.link(root); root.rotation_mode = 'QUATERNION'
        head = bpy.data.objects.new(name + '_head', None); col.objects.link(head); head.rotation_mode = 'QUATERNION'
        R = header['units']['character_size'][name]['head_radius']
        if name == 'teo':
            prim('sphere', 'teo_body', col, mat('teo_hoodie', '#f2c14a', 0.7), root, (0, 0.55, 0), (0.2, 0.24, 0.15))
            prim('sphere', 'teo_head', col, mat('teo_skin', '#f7f1e8', 0.55), head, (0, 0, 0), (R, R, R))
            prim('sphere', 'teo_hair', col, mat('teo_hairm', '#2b2633', 0.6), head, (0, 0.07, -0.02), (R * 1.05, R * 0.75, R * 0.95))
            for s in (-1, 1):
                prim('sphere', 'teo_eye', col, mat('teo_eyem', '#e0453c', 0.4), head, (s * 0.065, 0.0, R * 0.93), (0.05, 0.05, 0.015))
        else:
            prim('sphere', 'bip_egg', col, mat('bip_blue', '#3f8cf0', 0.34, coat=0.8), root, (0, 0.46, 0), (0.168, 0.19, 0.168))
            prim('box', 'bip_headbox', col, mat('bip_blue2', '#3f8cf0', 0.34, coat=0.8), head, (0, 0, 0), (0.42, 0.33, 0.31), bevel=0.14)
            prim('box', 'bip_visor', col, mat('bip_visor', '#070b1c', 0.12, coat=1.0), head, (0, -0.004, 0.03), (0.352, 0.25, 0.29), bevel=0.11)
            for s in (-1, 1):
                prim('box', 'bip_bar', col, mat('bip_eye', '#5ff2ff', 0.4, ('#5ff2ff', 6.0)), head, (s * 0.056, 0.022, 0.177), (0.075, 0.024, 0.01), bevel=0.01)
        # three.js character frame is +Z forward; the dump quaternions are world, so convert and key
        bake_vec(root, 'location', fids, [tuple(c3d.v3(fr['chars'][name]['root'])) for fr in frames])
        bake_vec(root, 'rotation_quaternion', fids, [tuple(c3d.q3(fr['chars'][name]['body_q'])) for fr in frames])
        bake_vec(head, 'location', fids, [tuple(c3d.v3(fr['chars'][name]['head'])) for fr in frames])
        qs = []; prev = None
        for fr in frames:
            q = c3d.q3(fr['chars'][name]['head_q'])
            if prev is not None and prev.dot(q) < 0: q = -q
            qs.append(tuple(q)); prev = q
        bake_vec(head, 'rotation_quaternion', fids, qs)
        heads[name] = head
    return heads

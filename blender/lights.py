"""Scene lights from the dump: one Blender light per engine light, intensity / colour / position keyed every frame.
Units: three.js point/spot intensity is in candela; a Blender point light of P watts gives P / (4 pi) W/sr, so P = 4 pi * cd * LIGHT_K.
LIGHT_K, the hemisphere (ambient) scale and the shadow choices are the knobs of the look (see BLENDER.md)."""
import bpy, math
from mathutils import Vector
import c3d
from bake import bake, bake_vec

LIGHT_K = 2.0          # global multiplier on the engine's intensities
HEMI_K = 2.5          # ambient: the engine's hemisphere light, a bit lower (the bulbs do more of the work here)
SHADOW_ROLES = ('key', 'rim')   # + the hanging key bulb over the table (see build); every other light is unshadowed (EEVEE shadow cost)


def build(header, frames, fids, col, set_col=None):
    rows = header['lights']
    made = []
    world = bpy.data.worlds.new('c3d_world'); bpy.context.scene.world = world
    world.use_nodes = True; wn = world.node_tree; bg = wn.nodes['Background']
    for i, L in enumerate(rows):
        typ = L['type']
        if typ == 'HemisphereLight':
            # sky colour from above, ground colour from below
            tc = wn.nodes.new('ShaderNodeTexCoord'); sep = wn.nodes.new('ShaderNodeSeparateXYZ'); wn.links.new(tc.outputs['Generated'], sep.inputs[0])
            mr = wn.nodes.new('ShaderNodeMapRange'); mr.inputs[1].default_value = -1; mr.inputs[2].default_value = 1
            wn.links.new(sep.outputs['Z'], mr.inputs[0])
            mix = wn.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; wn.links.new(mr.outputs[0], mix.inputs['Factor'])
            wn.links.new(mix.outputs['Result'], bg.inputs['Color'])
            r0 = frames[0]['lights'][i]
            mix.inputs['A'].default_value = (*c3d.hexcol(r0[2]), 1); mix.inputs['B'].default_value = (*c3d.hexcol(r0[1]), 1)
            vals = [fr['lights'][i][0] * HEMI_K for fr in frames]
            bake(world.node_tree, 'nodes["Background"].inputs[1].default_value', 0, fids, vals)
            made.append(None); continue
        spot = typ == 'SpotLight'
        ld = bpy.data.lights.new(f"L{i:02d}_{L['role']}_{L.get('name') or ''}", 'SPOT' if spot else 'POINT')
        ld.shadow_soft_size = 0.06 if not spot else 0.25
        ld.use_shadow = L['role'] in SHADOW_ROLES or (L.get('name') == 'stall' and (L.get('distance') or 0) == 6)
        import plus
        if plus.fk('shadow') and L['role'] not in SHADOW_ROLES: ld.use_shadow = False   # FAST: only the key and rim light cast shadows, not the hanging bulb
        if L.get('distance'):
            ld.use_custom_distance = True; ld.cutoff_distance = L['distance']
        if spot:
            ld.spot_size = 2 * L.get('angle', 0.6); ld.spot_blend = L.get('penumbra', 0.5)
        ob = bpy.data.objects.new(ld.name, ld); col.objects.link(ob)
        if L['role'] == 'key' and set_col is not None:
            ob.light_linking.receiver_collection = set_col
        if L['role'] == 'rim' and set_col is not None:
            ob['c3d_rim'] = True   # linked after the cast exists (rim_receivers): the set + Bíp, not Tèo   # the engine's side key and cold rim light the SET only; the cast gets CHAR_KEY / CHAR_RIM (its cold rim turned Tèo's cheek blue-white)
        ob.rotation_mode = 'QUATERNION'
        # keyed every frame: energy, colour, position (and aim for spots)
        bake(ld, 'energy', 0, fids, [fr['lights'][i][0] * 4 * math.pi * LIGHT_K for fr in frames])
        bake_vec(ld, 'color', fids, [c3d.hexcol(fr['lights'][i][1]) for fr in frames])
        bake_vec(ob, 'location', fids, [tuple(c3d.v3(fr['lights'][i][2:5])) for fr in frames])
        if spot:
            qs = []
            for fr in frames:
                r = fr['lights'][i]; p = c3d.v3(r[2:5]); t = c3d.v3(r[5:8])
                qs.append(tuple((t - p).to_track_quat('-Z', 'Y')))
            bake_vec(ob, 'rotation_quaternion', fids, qs)
        made.append(ob)
    return made


# characters brighter than the set (owner rule 13/11): a warm key and a cool rim that light ONLY the cast (light linking),
# so the background can stay dim while faces read. Positions follow the engine's own key / rim spots (camera-left front, back right).
CHAR_KEY = (190.0, '#ffead6', (-0.95, 2.45, 2.55), 1.6)     # watts, colour, three.js position, size (m)
CHAR_RIM = (50.0, '#ffe6cc', (1.6, 2.2, -1.6), 0.6)
CHAR_FILL = (26.0, '#fff0de', (1.1, 1.3, 2.4), 1.5)    # soft warm-neutral fill from camera-right: lifts Bíp (the far side from the key); a cool one turned Tèo's skin blue-white


PACK = None   # set by render_ep (header['pack']); 'goat' uses the GOAT_* cast light below (16/11), every other pack the lines above
GOAT_CHAR_KEY = (CHAR_KEY[0] * 0.66, '#ffcb98', CHAR_KEY[2], CHAR_KEY[3])    # warmer + a little lower: the white key pushed the cast's skin pale and pink (blue 30 % too high, red clipped)
GOAT_CHAR_RIM = CHAR_RIM
GOAT_CHAR_FILL = (CHAR_FILL[0] * 0.66, '#ffd6ac', CHAR_FILL[2], CHAR_FILL[3])


def character_rig(cast_col, col):
    out = []
    rig = (('char_key', GOAT_CHAR_KEY), ('char_rim', GOAT_CHAR_RIM), ('char_fill', GOAT_CHAR_FILL)) if PACK == 'goat' else (('char_key', CHAR_KEY), ('char_rim', CHAR_RIM), ('char_fill', CHAR_FILL))
    for nm, (w, hx, p3, size) in rig:
        ld = bpy.data.lights.new(nm, 'AREA'); ld.energy = w; ld.color = c3d.hexcol(hx); ld.size = size; ld.shape = 'DISK'
        ld.use_shadow = nm == 'char_key'; ld.volume_factor = 0.0   # no haze glow round the cast from these
        ob = bpy.data.objects.new(nm, ld); col.objects.link(ob)
        ob.location = c3d.v3(p3)
        tgt = c3d.v3((0.0, 0.85, 0.0))
        ob.rotation_mode = 'QUATERNION'; ob.rotation_quaternion = (tgt - ob.location).to_track_quat('-Z', 'Y')
        ob.light_linking.receiver_collection = cast_col
        out.append(ob)
    return out


# a soft warm fill on the SET only (light linking): lifts the wall, shelf, menu board and floor to the engine's readability
# without touching the cast (whose colours are already matched); the cast stays the brightest thing in frame
SET_FILL = (260.0, '#ffcf9a', (0.0, 2.7, 3.2), 4.0, (-0.3, 1.0, -1.5))


def set_fill(set_col, col):
    w, hx, p3, size, aim = SET_FILL
    ld = bpy.data.lights.new('set_fill', 'AREA'); ld.energy = w; ld.color = c3d.hexcol(hx); ld.size = size; ld.use_shadow = False; ld.volume_factor = 0.0
    ob = bpy.data.objects.new('set_fill', ld); col.objects.link(ob)
    ob.location = c3d.v3(p3); ob.rotation_mode = 'QUATERNION'; ob.rotation_quaternion = (c3d.v3(aim) - ob.location).to_track_quat('-Z', 'Y')
    ob.light_linking.receiver_collection = set_col
    return ob


def rim_receivers(set_col, cast_col, who=('bip',)):
    """the engine's cold rim: the set and Bíp (it is most of his light), never Tèo's face"""
    rc = bpy.data.collections.new('RIM_RECV'); rc.children.link(set_col)
    for o in cast_col.all_objects:
        if o.get('c3d_char') in who or (o.parent and o.parent.get('c3d_char') in who) or str(o.get('c3d_part', '')).startswith('hair'):
            rc.objects.link(o)   # Bíp, and Tèo's HAIR (its cool violet sheen in the engine comes from this rim)
    for ob in bpy.data.objects:
        if ob.get('c3d_rim'):
            ob.light_linking.receiver_collection = rc


BIP_FILL = (12.0, '#f2f6ff', (1.4, 0.55, 2.2), 1.4)


def bip_fill(cast_col, col, who='bip'):
    """a soft front-right fill on Bíp alone (light linking): his blue body reads like the engine's without lifting Tèo"""
    w, hx, p3, size = BIP_FILL
    rc = bpy.data.collections.new('BIP_RECV')
    for o in cast_col.all_objects:
        if o.get('c3d_char') == who or (o.parent and o.parent.get('c3d_char') == who): rc.objects.link(o)
    ld = bpy.data.lights.new('bip_fill', 'AREA'); ld.energy = w; ld.color = c3d.hexcol(hx); ld.size = size; ld.use_shadow = False; ld.volume_factor = 0.0
    ob = bpy.data.objects.new('bip_fill', ld); col.objects.link(ob); ob.location = c3d.v3(p3); ob.rotation_mode = 'QUATERNION'
    ob.rotation_quaternion = (c3d.v3((0.42, 0.45, 0.0)) - ob.location).to_track_quat('-Z', 'Y'); ob.light_linking.receiver_collection = rc
    return ob

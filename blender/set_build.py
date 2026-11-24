"""Build the static set ONCE into a cached .blend (run inside Blender):
  Blender -b --factory-startup -P blender/set_build.py -- <set.glb> <out_set_cache.blend>
The glb comes from cine3d (`node tools/export_set.cjs <ep.js> <out.glb>`), so the place is exactly the engine's (same coordinates, same pieces).
Here it gets what three.js could not do: real PBR surface detail on the big surfaces (Poly Haven CC0 plaster / brick / asphalt maps
blended UNDER the engine's own painted colours), glowing practicals that feed bloom, glossy wet pavement, clearcoat plastic.
Lights are NOT baked in: render_ep.py builds them per frame from the dump (they move and flicker)."""
import bpy, os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import c3d
from c3d import hexcol

PH = c3d.ASSETS + '/polyhaven/textures'


def tex_file(folder, key):
    d = os.path.join(PH, folder)
    for f in sorted(os.listdir(d)):
        if key in f.lower():
            return os.path.join(d, f)
    return None


def principled(m):
    return next((n for n in m.node_tree.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled'), None)


def add_detail(m, folder, scale, bump=0.25, rough_mix=0.6, rough_bias=0.0):
    """Poly Haven normal + roughness detail on a material that keeps its own base colour (world-space box mapping, no UV needed)."""
    nt = m.node_tree; b = principled(m)
    if not b:
        return
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (scale,) * 3
    nt.links.new(tc.outputs['Object'], mp.inputs[0])
    nfile = tex_file(folder, 'nor_gl'); rfile = tex_file(folder, 'rough')
    if nfile:
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = bpy.data.images.load(nfile, check_existing=True); n.image.colorspace_settings.name = 'Non-Color'; n.projection = 'BOX'; n.projection_blend = 0.3
        nt.links.new(mp.outputs[0], n.inputs[0])
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = bump
        nt.links.new(n.outputs[0], nm.inputs['Color']); nt.links.new(nm.outputs[0], b.inputs['Normal'])
    if rfile:
        r = nt.nodes.new('ShaderNodeTexImage'); r.image = bpy.data.images.load(rfile, check_existing=True); r.image.colorspace_settings.name = 'Non-Color'; r.projection = 'BOX'; r.projection_blend = 0.3
        nt.links.new(mp.outputs[0], r.inputs[0])
        old = b.inputs['Roughness'].default_value
        mx = nt.nodes.new('ShaderNodeMath'); mx.operation = 'MULTIPLY_ADD'; mx.inputs[1].default_value = rough_mix; mx.inputs[2].default_value = old * (1 - rough_mix) + rough_bias
        # keep a texture already linked into roughness (the pavement's wet map) by multiplying
        prev = b.inputs['Roughness'].links[0].from_socket if b.inputs['Roughness'].is_linked else None
        nt.links.new(r.outputs[0], mx.inputs[0])
        if prev:
            mm = nt.nodes.new('ShaderNodeMath'); mm.operation = 'MULTIPLY'; nt.links.new(prev, mm.inputs[0]); nt.links.new(mx.outputs[0], mm.inputs[1]); nt.links.new(mm.outputs[0], b.inputs['Roughness'])
        else:
            nt.links.new(mx.outputs[0], b.inputs['Roughness'])


def emission_boost(m, k):
    b = principled(m)
    if b and b.inputs['Emission Strength'].default_value > 0:
        b.inputs['Emission Strength'].default_value *= k
    for n in m.node_tree.nodes:
        if n.bl_idname == 'ShaderNodeEmission':
            n.inputs['Strength'].default_value *= k


def build(glb, out):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    col = bpy.data.collections.new('SET'); bpy.context.scene.collection.children.link(col)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=glb)
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        col.objects.link(o)
    stats = {'detail': 0, 'glow': 0, 'removed': 0, 'coat': 0}
    seen = set()
    for o in new:
        if o.type != 'MESH':
            continue
        p = o.get('c3d'); p = p.to_dict() if p else {}
        o.visible_shadow = True
        if p.get('effVisible') is False: o.hide_render = True   # hidden in the engine at export time (an fx may show it: render_ep keys it from the dump)
        if str(p.get('color') or '').lstrip('#').lower() == 'd8f4ff' and abs(float(p.get('opacity') or 1) - 0.55) < 0.02 and p.get('transparent'):   # 20/11 HYBRID: the door glass shards are drawn by the engine in the cast layer (castpass.cjs), not by Blender
            bpy.data.objects.remove(o, do_unlink=True); stats['removed'] += 1; continue
        if p.get('basic') and p.get('blending') == 'add':      # the fake light cone: real volumetric haze replaces it
            bpy.data.objects.remove(o, do_unlink=True); stats['removed'] += 1; continue
        dims = o.dimensions; big = max(dims) > 3.0
        if p.get('basic') and big:                            # the sky dome: unlit, never shadowed, never lit
            o.visible_shadow = False
            if max(dims) > 100:                                # 20/11: the engine draws the dome with BackSide; glTF keeps one side only, so Blender culled the inside = a black sky
                for m in o.data.materials:
                    if m: m.use_backface_culling = False
            continue
        for m in o.data.materials:
            if not m or m.name in seen or not m.use_nodes:
                continue
            seen.add(m.name)
            b = principled(m)
            ei = float(p.get('emissiveIntensity') or 0); em = p.get('emissive') or '000000'
            if str(em).lstrip('#').lower() == 'c8dcf0' and abs(ei - 0.6) < 0.05:   # 20/11: the door's crack ribbons (gta_shop.js crackMesh): thin 6 mm lines read dark; make them glow white
                bb = principled(m)
                if bb:
                    bb.inputs['Emission Color'].default_value = (0.78, 0.9, 1.0, 1.0); bb.inputs['Emission Strength'].default_value = 1.6; stats['glow'] += 1
                continue
            if str(p.get('color') or '').lstrip('#').lower() == 'd8f4ff' and abs(float(p.get('opacity') or 1) - 0.55) < 0.02:   # 20/11: the door glass shards (gta_shop.js): in Blender they read near-opaque white and their flight made the last second jump (smooth.py 6.16): fainter
                bb = principled(m)
                if bb:
                    bb.inputs['Alpha'].default_value = 0.06; bb.inputs['Roughness'].default_value = 0.35; bb.inputs['Coat Weight'].default_value = 0.0; bb.inputs['Emission Strength'].default_value = 0.05; bb.inputs['Specular IOR Level'].default_value = 0.2
                    m.surface_render_method = 'BLENDED'; m['c3d_keep'] = 1
                continue
            glows = (p.get('basic') and not big) or (ei >= 1.5 and em not in ('000000',))
            if glows:
                emission_boost(m, 3.0); stats['glow'] += 1      # bulbs, coals, LED strips, lamp heads: bright enough to bloom
                continue
            if not b:
                continue
            col_hex = (p.get('color') or 'ffffff')
            # what the big surfaces are, by size and colour: wall / pavement / street / side walls
            if big and dims.z < 0.05 and dims.x > 5:            # ground planes (pavement tiles, asphalt)
                add_detail(m, 'patterned_concrete_pavers' if col_hex != '14151c' else 'asphalt_02', 0.6, bump=0.35, rough_mix=0.5)
                stats['detail'] += 1
            elif big and (dims.z > 2.5):                        # walls, facades
                add_detail(m, 'plastered_wall_04', 0.45, bump=0.45, rough_mix=0.4); stats['detail'] += 1
            elif b.inputs['Coat Weight'].default_value > 0.05 or b.inputs['Roughness'].default_value < 0.45:
                b.inputs['Coat Weight'].default_value = max(0.5, b.inputs['Coat Weight'].default_value); b.inputs['Coat Roughness'].default_value = 0.15; stats['coat'] += 1
    # glass in the engine is transparent with opacity: give it real transmission so the tea glows through it
    for m in bpy.data.materials:
        b = principled(m) if m.use_nodes else None
        if b and m.get('c3d_keep'): continue
        if b and b.inputs['Alpha'].default_value < 0.5 and not b.inputs['Alpha'].is_linked:
            # keep the engine's see-through glass (alpha blended, so the tea inside reads), with a sharp clear-coat glint on top
            b.inputs['Roughness'].default_value = 0.03; b.inputs['Coat Weight'].default_value = 1.0; b.inputs['Coat Roughness'].default_value = 0.02
            m.surface_render_method = 'BLENDED'; m.use_transparency_overlap = True
    # 20/11: the door leaf's glass (0.9 x 2.1 m): the engine's pane is nearly clear (opacity 0.1); the mirror-glass look above veiled the whole door in pink haze and made the burst (pane + cracks vanish in one frame) the biggest jump of the film. A clearer copy of the material for the leaf only.
    for o in list(bpy.data.objects):
        if o.type == 'MESH' and o.data.materials and o.data.materials[0] and 0.6 < o.dimensions.x < 1.3 and 1.5 < o.dimensions.z < 2.6 and o.dimensions.y < 0.05:
            m0 = o.data.materials[0]; b0 = principled(m0) if m0.use_nodes else None
            if b0 and b0.inputs['Alpha'].default_value < 0.5:
                m1 = m0.copy(); m1.name = m0.name + '_door'; b1 = principled(m1); b1.inputs['Alpha'].default_value = 0.02; b1.inputs['Coat Weight'].default_value = 0.0; b1.inputs['Roughness'].default_value = 0.5; b1.inputs['Specular IOR Level'].default_value = 0.1; m1['c3d_keep'] = 1
                o.data.materials[0] = m1; stats['door_glass'] = stats.get('door_glass', 0) + 1
    bpy.ops.wm.save_as_mainfile(filepath=out, compress=True)
    print('SET CACHE', out, stats)


if __name__ == '__main__':
    a = c3d.args_after_dashes(sys.argv)
    build(os.path.abspath(a[0]), os.path.abspath(a[1]))

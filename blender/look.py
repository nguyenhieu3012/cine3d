"""Render settings and the picture chain: EEVEE (ray-traced reflections + fast GI, soft shadows, volumetric haze), AgX,
bloom from the compositor (Glare 'Bloom'), the episode's exposure / contrast / saturation from the dump's `look`.
Grain and vignette are added in compose.py (cheap, and they must sit UNDER the text layer)."""
import bpy, math
import c3d

HAZE = 0.0025          # world volume density (light shafts round the bulbs); 0 = off
BLOOM = (1.1, 0.4)   # (threshold, strength)
GRADE = {'sat': 1.0, 'contrast': 0.0}   # scene-linear grade here stays neutral: saturation in linear light turned yellow into salmon.
# The engine's grade (sat / contrast after the tone map) is applied display-referred in compose.py (DISPLAY_GRADE), like the engine does.
EXPOSURE_BIAS = 0.0                     # stops on top of the dump's exposure (Punchy AgX reads darker than the engine's AgX)


def setup(header, res_pct=100, samples=32, haze=HAZE, transparent=False):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 1080, 1920
    sc.render.resolution_percentage = res_pct
    sc.render.fps = header['fps']; sc.render.fps_base = 1
    sc.render.film_transparent = transparent
    sc.render.use_motion_blur = False
    import plus
    if plus.fk('haze'): haze = 0.0   # FAST: no world haze either: with no volume object left, EEVEE skips the whole volume pass
    if plus.on('mblur'):   # EEVEE motion blur on the cast's fast gestures (the camera is keyed CONSTANT: no blur across a cut)
        sc.render.use_motion_blur = True; sc.render.motion_blur_shutter = plus.MBLUR_SHUTTER; sc.eevee.motion_blur_steps = 1   # per-frame shutter (0 on a shot's first / last frame): plus.mblur_keys
    sc.render.filter_size = 1.0   # crisper than the 1.5 px default (the drawn faces and outlines)
    ee = sc.eevee
    ee.taa_render_samples = samples
    ee.use_shadows = True; ee.shadow_ray_count = 1; ee.shadow_step_count = 4
    ee.use_raytracing = True; ee.ray_tracing_method = 'SCREEN'
    ee.ray_tracing_options.resolution_scale = '1'; ee.ray_tracing_options.use_denoise = False   # the temporal denoiser broke bit-exact repeats
    if plus.fk('rt'): ee.ray_tracing_options.resolution_scale = '2'   # FAST: reflections / screen tracing at half resolution
    ee.use_fast_gi = True; ee.fast_gi_method = 'AMBIENT_OCCLUSION_ONLY'; ee.fast_gi_distance = 0.6   # AO only: full GI bounced the red floor and brown wall onto the cast (yellow hoodie went salmon)
    ee.bokeh_max_size = 60; ee.bokeh_threshold = 1000.0   # no scatter sprites: the scatter pass (GPU atomics) varied the out-of-focus pixels by 1 LSB between runs
    ee.volumetric_tile_size = '8'; ee.volumetric_samples = 128 if plus.on('atmos') else 48; ee.volumetric_end = 40; ee.use_volumetric_shadows = False
    vs = sc.view_settings; vs.view_transform = 'Khronos PBR Neutral'; vs.look = 'None'   # keeps the models' base colours (AgX Punchy pushed Bíp's blue to teal)
    sc.display_settings.display_device = 'sRGB'
    sc.render.image_settings.file_format = 'JPEG'; sc.render.image_settings.quality = 95
    sc.render.use_file_extension = True
    if haze > 0 and sc.world:
        wn = sc.world.node_tree; vol = wn.nodes.new('ShaderNodeVolumeScatter'); vol.inputs['Density'].default_value = haze; vol.inputs['Anisotropy'].default_value = 0.55
        out = next(n for n in wn.nodes if n.bl_idname == 'ShaderNodeOutputWorld'); wn.links.new(vol.outputs[0], out.inputs['Volume'])
    compositor(sc)


def compositor(sc):
    ng = bpy.data.node_groups.new('c3d_comp', 'CompositorNodeTree')
    ng.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    rl = ng.nodes.new('CompositorNodeRLayers')
    gl = ng.nodes.new('CompositorNodeGlare'); gl.inputs['Type'].default_value = 'Bloom'; gl.inputs['Quality'].default_value = ('Medium' if __import__('plus').fk('glare') else 'High')
    gl.inputs['Threshold'].default_value = BLOOM[0]; gl.inputs['Strength'].default_value = BLOOM[1]; gl.inputs['Size'].default_value = 0.5
    # grade (the engine's split of contrast / saturation, toned for AgX): saturation up, a touch of contrast
    hs = ng.nodes.new('CompositorNodeHueSat'); hs.inputs['Saturation'].default_value = GRADE['sat']
    bc = ng.nodes.new('CompositorNodeBrightContrast'); bc.inputs['Contrast'].default_value = GRADE['contrast']
    out = ng.nodes.new('NodeGroupOutput')
    ng.links.new(rl.outputs['Image'], gl.inputs['Image']); ng.links.new(gl.outputs['Image'], hs.inputs['Image'])
    ng.links.new(hs.outputs['Image'], bc.inputs['Image'])
    import plus
    if plus.on('atmos'):   # PLUS: Bíp's body a little less saturated, through a cryptomatte mask of his body parts (his base colour is never touched)
        bpy.context.view_layer.use_pass_cryptomatte_object = True   # (EEVEE has no object-index pass; cryptomatte is its id mask)
        cr = ng.nodes.new('CompositorNodeCryptomatteV2'); cr.matte_id = ','.join(plus.BIP_NAMES)
        ng.links.new(rl.outputs['Image'], cr.inputs['Image'])
        idm = cr
        ds = ng.nodes.new('CompositorNodeHueSat'); ds.inputs['Saturation'].default_value = plus.BIP_SAT
        ng.links.new(bc.outputs['Image'], ds.inputs['Image'])
        mx = ng.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'
        ng.links.new(cr.outputs['Matte'], mx.inputs['Factor']); ng.links.new(bc.outputs['Image'], mx.inputs['A']); ng.links.new(ds.outputs['Image'], mx.inputs['B'])
        ng.links.new(mx.outputs['Result'], out.inputs[0])
    else:
        ng.links.new(bc.outputs['Image'], out.inputs[0])
    sc.compositing_node_group = ng
    sc.render.use_compositing = True


def grade_from_dump(frames, fids):
    """exposure from the dump (stops = log2); contrast / saturation go to compose.py (ffmpeg eq), recorded in qa.json"""
    from bake import bake
    sc = bpy.context.scene
    bake(sc, 'view_settings.exposure', 0, fids, [math.log2(max(1e-3, fr['look']['exposure'])) + EXPOSURE_BIAS for fr in frames])


INNER_INK_PX = 3.0   # Freestyle line thickness at 1080 wide (inner ink lines: a hand over the body, cuffs, plate edges)


def inner_ink(cast_col, color='#150f28', px=INNER_INK_PX):
    """the engine's hull draws ink wherever one part's silhouette crosses another (a hand in front of the hoodie, a cuff, Bíp's plate).
    In Blender the hull of a part pressed against the body hides behind it, so those inner lines are drawn by Freestyle on the CAST only
    (silhouette / contour / border of each object, constant pixel width); the outer outline stays the hull (its width follows distance like the engine's)."""
    sc = bpy.context.scene
    sc.render.use_freestyle = True; sc.render.line_thickness_mode = 'ABSOLUTE'; sc.render.line_thickness = 1.0
    vl = sc.view_layers[0]; vl.use_freestyle = True
    fs = vl.freestyle_settings; fs.crease_angle = math.radians(120); fs.use_culling = True
    for ls in list(fs.linesets): fs.linesets.remove(ls)
    ls = fs.linesets.new('cast_ink'); ls.select_by_collection = True; ls.collection = cast_col; ls.select_by_visibility = True; ls.visibility = 'VISIBLE'
    ls.select_by_edge_types = True
    for k in ('select_silhouette', 'select_border', 'select_contour', 'select_crease', 'select_external_contour', 'select_material_boundary', 'select_suggestive_contour', 'select_ridge_valley', 'select_edge_mark'):
        setattr(ls, k, k in ('select_silhouette', 'select_contour', 'select_border'))
    st = ls.linestyle; st.color = c3d.hexcol(color, lin=True); st.thickness = px * sc.render.resolution_percentage / 100.0; st.thickness_position = 'CENTER'
    st.caps = 'ROUND'; st.chaining = 'PLAIN'
    return ls


LINE_RADIUS = 0.0028   # m: inner ink line half-width (Line Art); the outer outline stays the hull (OUTLINE_K)


def inner_lines(cast_col, color='#150f28', radius=LINE_RADIUS):
    """inner ink lines like the engine's (a hand over the hoodie, cuffs, drawstrings, Bíp's plate edge): Grease Pencil Line Art on the cast,
    one silhouette per object (silhouette_filtering INDIVIDUAL: no seam / intersection clutter). The ink hulls are moved to a child
    collection that Line Art ignores (they enclose their part and would hide every line)."""
    sc = bpy.context.scene
    ink = bpy.data.collections.new('CAST_INK'); cast_col.children.link(ink); ink.lineart_usage = 'EXCLUDE'
    for o in list(cast_col.all_objects):
        if o.name.endswith('_ink') or (o.type == 'MESH' and (not o.get('c3d_lines') or o.get('c3d_part') == 'visor' or o.name.endswith('_tube'))):   # tube limbs: their hull outlines them; Line Art drew X creases where a forearm meets the torso   # visor: its silhouette inside the head left specks   # hulls, and parts the engine draws no ink on (face patch, lenses, glasses, glow screens)
            for c in list(o.users_collection): c.objects.unlink(o)
            ink.objects.link(o)
    gpd = (bpy.data.grease_pencils_v3 if hasattr(bpy.data, 'grease_pencils_v3') else bpy.data.grease_pencils).new('cast_lines'); ob = bpy.data.objects.new('cast_lines', gpd); sc.collection.objects.link(ob)
    gpd.layers.new('lines')
    mat = bpy.data.materials.new('cast_lines_ink'); bpy.data.materials.create_gpencil_data(mat); mat.grease_pencil.color = (*c3d.hexcol(color), 1)
    gpd.materials.append(mat)
    md = ob.modifiers.new('lineart', 'LINEART'); md.source_type = 'COLLECTION'; md.source_collection = cast_col
    md.target_layer = 'lines'; md.target_material = mat; md.radius = radius
    md.use_contour = True; md.silhouette_filtering = 'INDIVIDUAL'
    md.use_intersection = False; md.use_crease = False; md.use_material = False; md.use_edge_mark = False; md.use_loose = False
    import plus
    if plus.PLUS: md.use_back_face_culling = True   # PLUS: back-face contours showed through the front faces as dotted dashes (Bíp's head, f75 / f358)
    return ob

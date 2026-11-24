"""The EXACT cine3d characters, rigged in Blender (the models never change: same meshes, colours, face drawings, ink outline).
Input (written by cine3d, see ENGINE.md "Export for other renderers"): out/chars/<who>_seated.glb + <who>.joints.json (bones, parts, face patch,
outline), and the per-frame face drawings out/<id>/blender/faces/<who>/f_%05d.png (exact emotion blend, mouth from the voice, blinks).

Motion (all keyed per frame from the dump, so any frame renders the same whatever range is asked):
  - body: root + yaw from the dump; spine lean = the engine's body rotation; the root is nudged so the head centre lands EXACTLY on the
    dump's head (camera framing and eye lines stay the engine's);
  - head: the engine's head rotation, passed through a damped spring (follow-through: a turn settles with a small overshoot) plus a
    speech nod that follows the voice envelope;
  - arms: analytic two-bone IK to the engine's hand targets (so hands meet the table / phone / body exactly as staged), elbows out and
    down, tubes skinned with a smooth bend at the elbow; a talking-gesture layer retargeted from the Quaternius 'Sitting_Talking_Loop'
    clip (studio-assets) moves the free hands while a character speaks;
  - breathing: a slow chest rise and fall.
Face: the drawn face is an image-sequence texture on the face patch (Tèo: alpha over the head; Bíp: additive glow on the visor)."""
import bpy, json, math, os
from mathutils import Vector, Quaternion, Matrix, Euler
import c3d
import plus
from bake import bake, bake_vec

SPRING_HZ, SPRING_ZETA = 2.4, 0.55     # head follow-through
NOD_RAD = 0.035                        # speech nod amplitude (pitch)
BREATH_RAD, BREATH_HZ = 0.012, 0.26
GESTURE = 0.55                         # talking-gesture amplitude (fraction of the retargeted clip motion)
CONTACT_POSES = {'phone', 'cross', 'cup', 'chin', 'head', 'facepalm', 'hug', 'cover', 'grip', 'beg'}
POLE = Vector((1.0, 0.35, -0.75))
OUTLINE_K = 1.7          # the engine's hull reads thicker on screen than a Solidify of the same metres (measured on close-ups)
# trims that sit ON a bigger part get a THIN hull (THIN_K x): the engine draws their ink lines (cuffs, eyelets, Bíp's plate edge) and a full one cut through the part
THIN_K = 0.4
THIN_OUTLINE = {'teo': {'spine_box', 'spine_torus', 'hips_torus', 'cuff_L', 'cuff_R'},   # the drawstrings keep a full hull: the engine's rounded dark eyelets
              'bip': {'plate', 'spine_box', 'neck', 'spine_torus', 'visor'}}     # elbow direction for the character's LEFT arm (+X), armature space (character faces -Y)


def available(chars_dir, header):
    return all(os.path.exists(os.path.join(chars_dir, f'{n}.joints.json')) and os.path.exists(os.path.join(chars_dir, f'{n}_seated.glb')) for n in header['cast'])


# ---------------------------------------------------------------- materials
def ink_material(hexc):
    m = bpy.data.materials.get('c3d_ink_' + hexc)
    if m: return m
    m = bpy.data.materials.new('c3d_ink_' + hexc); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    e = nt.nodes.new('ShaderNodeEmission'); e.inputs['Color'].default_value = (*c3d.hexcol(hexc), 1); e.inputs['Strength'].default_value = 1.0
    o = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(e.outputs[0], o.inputs[0])
    m.use_backface_culling = True
    return m


def outline(o, hexc, thick, fade=None):
    """ink outline = the engine's inverted hull: a COPY of the mesh, welded (the glTF has split vertices per face: pushing those
    apart left cracks = a grid of background lines), pushed out along the vertex normals by `thick`, faces flipped, back faces only,
    unlit, never in shadows. The copy follows the same bone / armature as the part."""
    import bmesh
    me = o.data.copy(); me.name = o.name + '_ink'
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.reverse_faces(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    if me.has_custom_normals:
        bpy.context.view_layer.update()
    me.materials.clear(); me.materials.append(ink_material(hexc))
    for p in me.polygons: p.use_smooth = True
    h = bpy.data.objects.new(o.name + '_ink', me)
    for c in o.users_collection: c.objects.link(h)
    skinned = any(m.type == 'ARMATURE' for m in o.modifiers)
    if skinned:   # a skinned tube: same parent, same deform
        h.parent = o.parent; h.parent_type = o.parent_type; h.parent_bone = o.parent_bone; h.matrix_parent_inverse = o.matrix_parent_inverse.copy()
        h.matrix_basis = o.matrix_basis.copy()
    else:         # anything else rides its part (so it follows every key of the part: the phone's scale, a bone)
        h.parent = o; h.matrix_parent_inverse = Matrix.Identity(4); h.matrix_basis = Matrix.Identity(4)
    for vg in o.vertex_groups:
        if vg.name not in h.vertex_groups: h.vertex_groups.new(name=vg.name)
    for m in o.modifiers:
        if m.type == 'ARMATURE':
            a = h.modifiers.new('rig', 'ARMATURE'); a.object = m.object
    d = h.modifiers.new('ink', 'DISPLACE'); d.direction = 'NORMAL'; d.mid_level = 0.0; d.strength = -thick   # faces are flipped: inward normal, so push by -thick
    if fade:   # PLUS: an arm tube starts INSIDE the torso, and its hull (r + thick) stuck out of the body's silhouette as black spikes (Bíp, f358): grow the hull in from the shoulder end
        sh, ax, ln = fade
        vg = h.vertex_groups.new(name='ink_w')
        for v in me.vertices: vg.add([v.index], c3d.smooth(max(0.0, (v.co - sh).dot(ax)) / ln), 'REPLACE')
        d.vertex_group = 'ink_w'
    h.visible_shadow = False
    return h


def principled(m):
    return next((n for n in m.node_tree.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled'), None) if m and m.node_tree else None


def tune_material(o, p):
    """rebuild what glTF could not carry (from extras.c3d): additive glow, emissive > 1; a little extra life on plastic"""
    for m in o.data.materials:
        b = principled(m)
        if not b: continue
        ei = float(p.get('emissiveIntensity') or 0); em = p.get('emissive') or '000000'
        if em not in ('000000', None) and ei > 0:
            b.inputs['Emission Color'].default_value = (*c3d.hexcol(em), 1); b.inputs['Emission Strength'].default_value = ei * 2.2
        if p.get('color') == '#070b1c':   # Bíp's visor: a dark glossy screen, but the bulb's mirror blob covered his eye bars: soft, low specular, no coat
            b.inputs['Roughness'].default_value = 0.32; b.inputs['Specular IOR Level'].default_value = 0.18; b.inputs['Coat Weight'].default_value = 0.0
            continue
        if (p.get('roughness') or 1) < 0.45 and p.get('color') not in ('#17141f',):   # glossy plastic gets a clear coat; never the hair (it read as black lacquer)
            b.inputs['Coat Weight'].default_value = 0.6; b.inputs['Coat Roughness'].default_value = 0.12
        if p.get('color') == '#17141f':   # Tèo's hair: the model's colour exactly (#17141f, never changed); the engine's look is a near-black with a cool
            # violet sheen and sharp stretched highlights: low roughness, sheen #5b4f8a (chars.js), and the engine's cold rim lights the hair (lights.rim_receivers)
            b.inputs['Roughness'].default_value = 0.25
            b.inputs['Sheen Weight'].default_value = 1.0; b.inputs['Sheen Tint'].default_value = (*c3d.hexcol('#5b4f8a'), 1); b.inputs['Sheen Roughness'].default_value = 0.4



def additive(m, strength=2.0):
    """three.js AdditiveBlending: colour * alpha added on top (emission + transparent)"""
    nt = m.node_tree; b = principled(m)
    tex = next((n for n in nt.nodes if n.bl_idname == 'ShaderNodeTexImage'), None)
    keep = tex.name if tex else None
    for n in list(nt.nodes):
        if n.name != keep: nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission'); tr = nt.nodes.new('ShaderNodeBsdfTransparent'); add = nt.nodes.new('ShaderNodeAddShader')
    em.inputs['Strength'].default_value = strength
    if tex:
        mul = nt.nodes.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs['Factor'].default_value = 1
        nt.links.new(tex.outputs['Color'], mul.inputs[6]); nt.links.new(tex.outputs['Alpha'], mul.inputs[7])   # colour A / B sockets
        nt.links.new(mul.outputs[2], em.inputs['Color'])
    nt.links.new(em.outputs[0], add.inputs[0]); nt.links.new(tr.outputs[0], add.inputs[1]); nt.links.new(add.outputs[0], out.inputs[0])
    m.surface_render_method = 'BLENDED'; m.use_backface_culling = True
    return tex


def face_sequence(o, face_dir, f0, count, blend):
    """the drawn face of every frame as an image sequence on the face patch"""
    first = os.path.join(face_dir, f'f_{f0:05d}.png')
    img = bpy.data.images.load(first, check_existing=False); img.source = 'SEQUENCE'; img.colorspace_settings.name = 'sRGB'; img.alpha_mode = 'STRAIGHT'
    m = o.data.materials[0]; nt = m.node_tree
    tex = next((n for n in nt.nodes if n.bl_idname == 'ShaderNodeTexImage'), None)
    if blend == 'additive':
        if tex is None:
            tex = nt.nodes.new('ShaderNodeTexImage')
            uv = nt.nodes.new('ShaderNodeUVMap'); nt.links.new(uv.outputs[0], tex.inputs[0])
        tex.image = img
        additive(m, 3.6)
    else:
        b = principled(m)
        if tex is None:
            tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = img
        nt.links.new(tex.outputs['Color'], b.inputs['Base Color']); nt.links.new(tex.outputs['Alpha'], b.inputs['Alpha'])
        m.surface_render_method = 'BLENDED'
    tex.interpolation = 'Closest'   # with the 2x faces (faces_hires.py): crispest lines; Cubic blurred them
    # the PNGs are upright; on this mesh's UVs they need V flipped (checked against the engine stills)
    if not tex.inputs['Vector'].is_linked:
        uv = nt.nodes.new('ShaderNodeUVMap'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1, -1, 1); mp.inputs['Location'].default_value = (0, 1, 0)
        nt.links.new(uv.outputs[0], mp.inputs[0]); nt.links.new(mp.outputs[0], tex.inputs['Vector'])
    else:
        src = tex.inputs['Vector'].links[0].from_socket
        mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1, -1, 1); mp.inputs['Location'].default_value = (0, 1, 0)
        nt.links.new(src, mp.inputs[0]); nt.links.new(mp.outputs[0], tex.inputs['Vector'])
    iu = tex.image_user; iu.frame_start = f0; iu.frame_offset = f0 - 1; iu.frame_duration = count; iu.use_auto_refresh = True; iu.use_cyclic = False
    return img


# ---------------------------------------------------------------- build one character
def build_char(name, chars_dir, faces_dir, col, f0, count):
    J = json.load(open(os.path.join(chars_dir, f'{name}.joints.json'))); S = J['poses']['seated']
    ad = bpy.data.armatures.new(name + '_skel'); arm = bpy.data.objects.new(name + '_rig', ad); col.objects.link(arm)
    bpy.context.view_layer.objects.active = arm; arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for b in S['bone_blender']:
        eb = ad.edit_bones.new(b['name']); eb.head = b['head']; eb.tail = b['tail']
        if (eb.tail - eb.head).length < 1e-4: eb.tail = eb.head + Vector((0, 0, 0.02))
    for b in S['bone_blender']:
        if b['parent']: ad.edit_bones[b['name']].parent = ad.edit_bones[b['parent']]
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'
    # meshes
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(chars_dir, f'{name}_seated.glb'))
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        for c in list(o.users_collection): c.objects.unlink(o)
    for o in [o for o in new if o.type != 'MESH']:
        bpy.data.objects.remove(o, do_unlink=True)
    objs = {o.name.split('.')[0]: o for o in bpy.data.objects if o in new and o.type == 'MESH'}
    part = {p['name']: p for p in S['parts']}
    ol = S['outline']; ol_set = set(ol['meshes_with_outline'])
    # tube limbs: join the two halves and skin them with a smooth bend
    tubes = []
    for up, lo in (('upperarm_L', 'forearm_L'), ('upperarm_R', 'forearm_R'), ('thigh_L', 'shin_L'), ('thigh_R', 'shin_R')):
        if up in objs and lo in objs:
            a, b = objs[up], objs[lo]
            for o in bpy.context.selected_objects: o.select_set(False)
            col.objects.link(a); col.objects.link(b)
            a.select_set(True); b.select_set(True); bpy.context.view_layer.objects.active = a
            bpy.ops.object.join()
            a.name = name + '_' + up + '_tube'; del objs[lo]; objs[up] = a; tubes.append((a, up, lo))
    for pname, o in objs.items():
        if o.name not in col.objects: col.objects.link(o)
        p = part.get(pname, {}); e = o.get('c3d'); e = e.to_dict() if e else {}
        tube = next((t for t in tubes if t[0] is o), None)
        if tube:
            _, up, lo = tube
            gu = o.vertex_groups.new(name=up); gl = o.vertex_groups.new(name=lo)
            bu = ad.bones[up]; bl = ad.bones[lo]
            elbow = bu.tail_local; du = (bu.tail_local - bu.head_local).normalized(); dl = (bl.tail_local - bl.head_local).normalized(); n = (du + dl).normalized()
            for v in o.data.vertices:
                d = (v.co - elbow).dot(n); w = c3d.smooth((d + 0.03) / 0.06)
                gu.add([v.index], 1 - w, 'REPLACE'); gl.add([v.index], w, 'REPLACE')
            o.parent = arm; md = o.modifiers.new('rig', 'ARMATURE'); md.object = arm
        else:
            bone = p.get('bone', 'spine')
            o.parent = arm; o.parent_type = 'BONE'; o.parent_bone = bone
            B = ad.bones[bone]
            o.matrix_parent_inverse = (arm.matrix_world @ B.matrix_local @ Matrix.Translation((0, B.length, 0))).inverted()
        tune_material(o, e)
        if pname.startswith('glasses_lens'):   # the engine's lens is a faint see-through disc: no mirror (its screen-space reflection was noise)
            b = principled(o.data.materials[0])
            if b: b.inputs['Roughness'].default_value = 0.35; b.inputs['Coat Weight'].default_value = 0.0; b.inputs['Specular IOR Level'].default_value = 0.2
            o.data.materials[0].surface_render_method = 'BLENDED'
        if pname == 'face':
            face_sequence(o, os.path.join(faces_dir, name), f0, count, S['face'].get('blend', 'alpha'))
        elif e.get('blending') == 'add':
            additive(o.data.materials[0], 1.6)
        if pname in ol_set or (tube and (tube[1] in ol_set or tube[2] in ol_set)):
            o['c3d_lines'] = True
            fade = None
            if plus.PLUS and tube and tube[1].startswith('upperarm'):
                bu_ = ad.bones[tube[1]]; fade = (bu_.head_local.copy(), (bu_.tail_local - bu_.head_local).normalized(), SHOULDER_FADE)
            outline(o, ol['color'], ol['thickness_m'] * OUTLINE_K * (THIN_K if pname in THIN_OUTLINE.get(name, ()) else 1.0), fade)
        o['c3d_char'] = name; o['c3d_part'] = pname
        o.visible_shadow = pname not in ('face', 'spark', 'spark_glow') and not pname.startswith('glasses_lens')
    return arm, J, S


def attach_phone(arm, col, fids, vis):
    """the phone rides the hand bone (hand_L = the engine's slot r): placed once where the engine puts it relative to the hand
    (hand + (-0.02, 0.07, 0.03), Euler(-0.35, 0.25, 0.08) in the body frame) at a frame where he holds it, then it follows every wrist move"""
    ph = phone_prop(col)
    f_ref = fids[vis.index(1.0)]
    sc = bpy.context.scene; sc.frame_set(f_ref)
    pb = arm.pose.bones['hand_L']
    M_tail = arm.matrix_world @ pb.matrix @ Matrix.Translation((0, pb.bone.length, 0))
    sp = arm.pose.bones['spine']; R_body = (arm.matrix_world.to_quaternion() @ (sp.matrix.to_quaternion() @ sp.bone.matrix_local.to_quaternion().inverted()))
    hand_c = arm.matrix_world @ (pb.matrix @ Vector((0, pb.bone.length * 0.5, 0)))
    pos = hand_c + R_body @ (M3 @ Vector((-0.02, 0.07, 0.03)))
    R3 = Euler((-0.35, 0.25, 0.08), 'ZYX').to_matrix()   # three.js 'XYZ' = Rx*Ry*Rz = mathutils 'ZYX'
    rot = R_body @ (M3 @ R3 @ M3.transposed()).to_quaternion()
    W = Matrix.Translation(pos) @ rot.to_matrix().to_4x4()
    ph.parent = arm; ph.parent_type = 'BONE'; ph.parent_bone = 'hand_L'; ph.matrix_parent_inverse = Matrix.Identity(4)
    local = M_tail.inverted() @ W
    ph.rotation_mode = 'QUATERNION'; ph.location = local.to_translation(); ph.rotation_quaternion = local.to_quaternion()
    bake_vec(ph, 'scale', fids, [((1.0, 1.0, 1.0) if v else (1e-4, 1e-4, 1e-4)) for v in vis], 'CONSTANT')
    for fc in ph.animation_data.action.fcurves if hasattr(ph.animation_data.action, 'fcurves') else []:
        for k in fc.keyframe_points: k.interpolation = 'CONSTANT'
    return ph


def phone_prop(col):
    """the engine's phone: a 0.075 x 0.15 x 0.009 m rounded slab with a glowing screen; real size in the MESH (object scale 1) so its ink hull keeps its thickness"""
    import bmesh
    me = bpy.data.meshes.new('c3d_phone'); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector((0.075, 0.009, 0.15)), verts=bm.verts); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('c3d_phone', me); col.objects.link(o)
    bv = o.modifiers.new('b', 'BEVEL'); bv.width = 0.004; bv.segments = 3
    m = bpy.data.materials.new('c3d_phone'); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.008, 0.008, 0.012, 1); b.inputs['Roughness'].default_value = 0.25; b.inputs['Metallic'].default_value = 0.4
    o.data.materials.append(m)
    bpy.ops.mesh.primitive_plane_add(size=1); s = bpy.context.active_object; s.name = 'c3d_phone_screen'
    for c in list(s.users_collection): c.objects.unlink(s)
    col.objects.link(s); s.parent = o; s.location = (0, 0.0047, 0); s.rotation_euler = (math.radians(90), 0, 0); s.scale = (0.066, 0.138, 1)
    sm = bpy.data.materials.new('c3d_phone_screen'); sm.use_nodes = True; sb = sm.node_tree.nodes['Principled BSDF']
    sb.inputs['Base Color'].default_value = (0, 0, 0, 1); sb.inputs['Emission Color'].default_value = (*c3d.hexcol('#bcd8ff'), 1); sb.inputs['Emission Strength'].default_value = 1.6
    s.data.materials.append(sm)
    outline(o, '#150f28', 0.005); o['c3d_lines'] = True
    return o


# ---------------------------------------------------------------- motion helpers
M3 = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))     # three.js -> Blender axes


def body_local(v_world, root, yaw, off=None):
    """world three.js point -> Blender armature space of the character (before the root nudge; GOAT: `off` = the nudge, so a body lift is not counted twice)"""
    r = c3d.v3(root) if off is None else c3d.v3(root) + off
    return Quaternion((0, 0, 1), -yaw) @ (c3d.v3(v_world) - r)


def two_bone(S, L1, L2, T, pole):
    d = T - S; dist = max(1e-5, min(d.length, (L1 + L2) * 0.999)); dn = d.normalized()
    a = (L1 * L1 + dist * dist - L2 * L2) / (2 * dist); h = math.sqrt(max(0.0, L1 * L1 - a * a))
    p = pole - dn * pole.dot(dn)
    p = p.normalized() if p.length > 1e-6 else Vector((0, 0, -1))
    return S + dn * a + p * h, S + dn * dist


def spring_rot(qs, fps, hz=SPRING_HZ, zeta=SPRING_ZETA):
    """damped spring on a quaternion track (rotation-vector space), deterministic over the whole track"""
    w = 2 * math.pi * hz; dt = 1.0 / fps; sub = 4; h = dt / sub
    x = qs[0].to_exponential_map() if hasattr(qs[0], 'to_exponential_map') else Vector(qs[0].to_axis_angle()[0]) * qs[0].to_axis_angle()[1]
    x = Vector(x); v = Vector((0, 0, 0)); out = []
    for q in qs:
        tgt = Vector(q.to_exponential_map())
        for _ in range(sub):
            acc = (tgt - x) * (w * w) - v * (2 * zeta * w)
            v += acc * h; x += v * h
        out.append(Quaternion(x))
    return out


def smooth_track(vals, half):
    n = len(vals); out = []
    for i in range(n):
        lo, hi = max(0, i - half), min(n, i + half + 1)
        out.append(sum(vals[lo:hi]) / (hi - lo))
    return out


def gesture_track(fps):
    """hand offsets of a seated talker, retargeted from the Quaternius clip 'Sitting_Talking_Loop' (VRM rig of studio-assets):
    wrist positions relative to the shoulder, minus their mean, scaled to the chibi arm. Returns (fn(t) -> (dL, dR) in armature space) or None."""
    import sys
    sys.path.insert(0, os.path.join(c3d.ASSETS, '_scripts'))
    try:
        import kitlib as K
    except Exception:
        return None
    lib = os.path.join(c3d.ASSETS, 'characters', 'Teo_B_BaseMale.blend')
    if not os.path.exists(lib): return None
    with bpy.data.libraries.load(lib) as (src, dst):
        dst.objects = [n for n in src.objects]
    rig = next(o for o in dst.objects if o and o.type == 'ARMATURE')
    tmp = bpy.data.collections.new('_gesture_tmp'); bpy.context.scene.collection.children.link(tmp); tmp.objects.link(rig)
    act = K.apply_clip(rig, 'Sitting_Talking_Loop')
    f_a, f_b = [int(x) for x in act.frame_range]
    sc = bpy.context.scene; keep = sc.frame_current
    samp = []
    for f in range(f_a, f_b):
        sc.frame_set(f)
        row = []
        for s in ('L', 'R'):
            sh = rig.pose.bones[f'J_Bip_{s}_UpperArm'].head; wr = rig.pose.bones[f'J_Bip_{s}_Hand'].head
            row.append((wr - sh))
        samp.append(row)
    sc.frame_set(keep)
    for o in list(dst.objects):
        if o: bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.collections.remove(tmp)
    n = len(samp); mean = [sum((r[k] for r in samp), Vector()) / n for k in (0, 1)]
    scale = 0.37 / 0.52           # chibi arm (engine arm_length_used) / VRoid arm
    # the VRM rig faces +Y, the chibi armature faces -Y: turn the offsets 180 degrees about Z; VRM 'L' (+X? -X) is matched by side sign
    rot = Quaternion((0, 0, 1), math.pi)
    offs = [[rot @ ((r[k] - mean[k]) * scale) for k in (0, 1)] for r in samp]
    clip_fps = 24.0
    def fn(t):
        u = (t * clip_fps) % n; i = int(u); fr = u - i; j = (i + 1) % n
        a, b = offs[i], offs[j]
        return [a[k].lerp(b[k], fr) for k in (0, 1)]
    return fn


# ---------------------------------------------------------------- per-frame bake
def spring_vec(vs, fps, hz, zeta):
    """damped spring on a Vector track (follow-through: the hand overshoots a little and settles)"""
    w = 2 * math.pi * hz; h = 1.0 / fps / 4; x = vs[0].copy(); v = Vector((0, 0, 0)); out = []
    for tgt in vs:
        for _ in range(4):
            v += ((tgt - x) * (w * w) - v * (2 * zeta * w)) * h; x += v * h
        out.append(x.copy())
    return out


def spring_1d(xs, fps, hz, zeta):
    w = 2 * math.pi * hz; h = 1.0 / fps / 4; x = xs[0]; v = 0.0; out = []
    for tgt in xs:
        for _ in range(4):
            v += ((tgt - x) * w * w - v * 2 * zeta * w) * h; x += v * h
        out.append(x)
    return out


def anticipate(vs, lead, amt):
    """pull back against the coming move: A(i) = T(i) - amt * (T(i + lead) - T(i))"""
    n = len(vs)
    return [vs[i] - (vs[min(n - 1, i + lead)] - vs[i]) * amt for i in range(n)]


def beats(env, fps, thr=0.55, gap=0.36):
    """stressed syllables: peaks of the voice envelope that rise clearly above the frames before them"""
    n = len(env); out = []; last = -1e9
    for i in range(3, n - 3):
        if env[i] >= thr and env[i] >= max(env[i - 3:i + 4]) and env[i] - min(env[max(0, i - 9):i]) > 0.22 and (i - last) / fps >= gap:
            out.append(i); last = i
    return out


def bell(i, b, half):
    d = abs(i - b) / half
    return 0.5 * (1 + math.cos(math.pi * d)) if d < 1 else 0.0


# table (engine stall): top 0.4775 m, x -0.43..0.43, z 0.17..0.67 (three.js world) -> Blender world
GOAT_TRACKS = {}   # name -> {'hand_L': Blender world hand centre per frame} for the held mate (goat.mate)
TABLE = {'top': 0.4775, 'x': (-0.43, 0.43), 'y': (-0.67, -0.17)}
HAND_R = 0.045
SHOULDER_FADE = 0.07   # m: PLUS: the arm's ink hull grows from 0 to full over this length from the shoulder (spikes out of the torso)
SLAM_LIFT = 0.04      # m: PLUS props slam: hand target higher so the fist rests on the table top (not under it)
SLAM_POLE_Z = 0.55    # PLUS props slam: elbow pole pulled up (POLE.z is -0.75) so the forearm stays above the table edge


def keep_out(T, root_bl, yaw, hipsv, ds):
    """hands never inside the table top or the body: T is armature space"""
    qy = Quaternion((0, 0, 1), yaw); W = root_bl + qy @ T
    if TABLE['x'][0] - HAND_R < W.x < TABLE['x'][1] + HAND_R and TABLE['y'][0] - HAND_R < W.y < TABLE['y'][1] + HAND_R:
        top = TABLE['top']
        if W.z > top - 0.02: W.z = max(W.z, top + HAND_R)          # above: rest on / over the top
        else: W.z = min(W.z, top - 0.035 - HAND_R)                   # below: stay under the board
    T2 = qy.inverted() @ (W - root_bl)
    # body: a capsule round the spine (radius 0.2 at chest height, front is -Y)
    axis = hipsv + ds @ Vector((0, 0, 0.4)); d = T2 - axis; d.z = 0
    if d.length < 0.2 + HAND_R * 0.6 and 0.3 < T2.z < 0.8:
        d = d.normalized() if d.length > 1e-4 else Vector((0, -1, 0))
        T2 = axis + d * (0.2 + HAND_R * 0.6) + Vector((0, 0, T2.z - axis.z))
    return T2


def animate(name, arm, S, header, frames, fids):
    """the engine's staging + an acting layer: anticipation and follow-through on every pose change, overlapping action
    (head first, shoulders, then each hand on its own spring), beat gestures on stressed syllables, listening nods on the
    partner's stresses, weight shifts in the seat, breathing, a handled phone. Pure functions of the whole dump (deterministic)."""
    fps = header['fps']; n = len(frames)
    GOAT = header.get('pack') == 'goat'   # 16/11: standing cast (body lift), hands on the table / the flag, stretchy arms (blender/goat.py); every other pack keeps the old rig
    bones = {b.name: b for b in arm.data.bones}
    Brest = {nm: b.matrix_local.to_quaternion() for nm, b in bones.items()}
    J = {k: Vector(v) for k, v in S['joints_blender'].items()}
    hips = Vector(S['bone_blender'][0]['head']); headp = Vector(next(b for b in S['bone_blender'] if b['name'] == 'head')['head'])
    L = {s: ((J['elbow_' + s] - J['shoulder_' + s]).length, (J['hand_' + s] - J['elbow_' + s]).length) for s in ('L', 'R')}
    lines = [l for l in header['lines'] if l['who'] == name]
    partner = (header.get('partners') or {}).get(name) or next((c for c in header['cast'] if c != name), None)
    gest = gesture_track(fps) if GESTURE > 0 else None
    seed = 5.0 if name == 'teo' else 9.0
    Dsp, Dhd, mouth, pmouth = [], [], [], []
    for fr in frames:
        c = fr['chars'][name]; qy = Quaternion((0, 0, 1), -c['yaw'])
        Dsp.append(qy @ c3d.q3c(c['body_q'])); Dhd.append(qy @ c3d.q3c(c['head_q'])); mouth.append(c.get('mouth') or 0.0)
        pmouth.append((fr['chars'].get(partner) or {}).get('mouth') or 0.0)
    nudge = [Vector() for _ in range(n)]
    if GOAT:   # the armature is moved so the head centre lands where the engine has it (a body lift = 22 cm): hand targets must be taken from the MOVED origin
        for i, fr in enumerate(frames):
            c = fr['chars'][name]; qyaw_ = Quaternion((0, 0, 1), c['yaw'])
            nudge[i] = c3d.v3(c['head']) - (c3d.v3(c['root']) + qyaw_ @ (hips + Dsp[i] @ (headp - hips)))
    env = smooth_track(mouth, 2); penv = smooth_track(pmouth, 2)
    my_beats = beats(env, fps); their_beats = beats(penv, fps)
    # head: lead by 3 frames (it arrives first), then a damped spring (follow-through)
    rel = [Dsp[i].inverted() @ Dhd[i] for i in range(n)]
    for i in range(1, n):
        if rel[i].dot(rel[i - 1]) < 0: rel[i] = -rel[i]
    rel = [rel[min(n - 1, i + 3)] for i in range(n)]
    rel = spring_rot(rel, fps)
    # hand targets from the engine (armature space, engine spine), slot l = the character's RIGHT hand
    base = {'L': [], 'R': []}; poses = []
    for i, fr in enumerate(frames):
        c = fr['chars'][name]; hands = c.get('hands') or {}; poses.append(c.get('pose') or ['rest', 'rest', 1])
        for s, slot in (('R', 'l'), ('L', 'r')):
            base[s].append(body_local(hands[slot], c['root'], c['yaw'], nudge[i] if GOAT else None) if slot in hands else hips + Dsp[i] @ (J['hand_' + s] - hips))
    cw = {'L': [0.0] * n, 'R': [0.0] * n}
    if GOAT:   # hands on the table / the flag / carrying it: the engine's hand, not the acting layer's (goat.contact_weight)
        import goat
        cw = goat.contact_weights(frames, name, poses, n)
    def free_w(p, s):
        w = min(1.0, max(0.0, p[2])); hand_busy = lambda nm: nm in CONTACT_POSES or (nm in ('point', 'raise', 'give', 'push') and s == 'L') or (nm == 'pointL' and s == 'R')
        return (1 - w) * (0 if hand_busy(p[0]) else 1) + w * (0 if hand_busy(p[1]) else 1)
    # beat gestures: on each stressed syllable one hand dips forward-down and comes back (alternating when both are free); a pointing hand jabs
    beat_off = {'L': [Vector() for _ in range(n)], 'R': [Vector() for _ in range(n)]}
    spine_beat = [0.0] * n; head_beat = [0.0] * n
    for k, b in enumerate(my_beats):
        p = poses[b]; amp = min(1.0, env[b])
        for i in range(max(0, b - 8), min(n, b + 9)):
            spine_beat[min(n - 1, max(0, i - 2))] += 0.022 * amp * bell(i, b, 7)      # shoulders lead the hand by 2 frames
            head_beat[min(n - 1, max(0, i - 3))] += 0.05 * amp * bell(i, b, 6)       # the head leads by 3
        side = 'L' if k % 2 == 0 else 'R'
        for s in ('L', 'R'):
            fw = free_w(p, s); pointing = (s == 'L' and p[1] in ('point', 'raise')) or (s == 'R' and p[1] == 'pointL')
            if pointing:
                d = (base[s][b] - (hips + Vector((0, 0, 0.62)))).normalized() * 0.05 * amp
            elif fw > 0.5 and (s == side or free_w(p, 'L' if s == 'R' else 'R') < 0.5):
                d = Vector((0, -0.03, -0.04)) * amp
            elif p[1] == 'phone' and s == 'L':
                d = Vector((0, -0.012, 0.025)) * amp                                   # gestures with the phone in hand
            else:
                continue
            for i in range(max(0, b - 9), min(n, b + 9)):
                beat_off[s][i] = beat_off[s][i] + d * bell(i, b + 1, 8)
    # listening: small nods on the partner's stressed words, a slow head tilt, glances
    listen_nod = [0.0] * n
    for b in their_beats:
        if env[b] < 0.15:
            for i in range(max(0, b), min(n, b + 16)):
                listen_nod[i] += 0.06 * bell(i, b + 7, 8)
    tracks = {b: [] for b in bones}; loc = []; phone_vis = []; phone_rot = []
    GT = {'L': [], 'R': [], 'hand_L': []}
    # ---- SHOWCASE layers (plus.py; off in the baseline) ----
    PM = plus.on('motion'); PP = plus.on('props'); PT = plus.on('toon')
    talkw = spring_1d([1.0 if any(l['t0'] - 0.1 <= fr['t'] <= l['t1'] + 0.2 for l in lines) else 0.0 for fr in frames], fps, 1.0, 1.0) if PM else None
    PX = {'hand': {'L': [], 'R': []}, 'spine_q': [], 'events': [], 'phone_w': [], 'phone_turn': []}
    drink = slam = None
    if PP and name == 'bip':
        drink = (0.95, 3.0)                      # Bíp drinks his tea while Tèo talks (shots 1-2: two-shot, over his shoulder)
    if PP and name == 'teo':
        l8 = next((l for l in lines if 'khác' in l['text']), None)
        slam = (l8['t0'] + 0.1) if l8 else None  # "Thầy tao khác!": the free hand hits the table
    TABLE_C = Vector((0.0, -0.42, 0.4775))      # Blender world: table centre top
    def W2A(Pw, c):                               # Blender world point -> armature space (before the root nudge)
        return Quaternion((0, 0, 1), -c['yaw']) @ (Pw - c3d.v3(c['root']))
    phone_spot_w = c3d.v3((-0.2, 0.4835 + 0.06, 0.30)); glass_w = {'bip': c3d.v3((0.24, 0.478 + 0.06, 0.44)), 'teo': c3d.v3((-0.22, 0.478 + 0.06, 0.47))}
    ease = lambda x: 0.5 - 0.5 * math.cos(math.pi * min(1.0, max(0.0, x)))
    T_ant = {s: anticipate([base[s][i] + beat_off[s][i] for i in range(n)], 5, 0.35) for s in ('L', 'R')}
    T_spr = {'L': spring_vec(T_ant['L'], fps, 2.6, 0.5), 'R': spring_vec(T_ant['R'], fps, 3.0, 0.5)}   # two springs: the hands never land on the same frame
    # weight shifts and body follow: twist toward the moving hands (lagging spring), slow lean drift
    twist_raw = [0.9 * ((T_ant['L'][i] - hips).x + (T_ant['R'][i] - hips).x) for i in range(n)]
    twist = spring_1d([max(-0.14, min(0.14, x)) for x in twist_raw], fps, 1.6, 0.7)
    for i, fr in enumerate(frames):
        c = fr['chars'][name]; t = fr['t']; yaw = c['yaw']; p = poses[i]
        talking = any(l['t0'] - 0.1 <= t <= l['t1'] + 0.2 for l in lines)
        listening = penv[i] > 0.1 and env[i] < 0.1
        br = BREATH_RAD * (1.5 if not talking else 1.0) * math.sin(2 * math.pi * BREATH_HZ * t + (0.0 if name == 'teo' else 1.7))
        roll = 0.03 * c3d.vnoise(t * 0.09, seed) ; lean = 0.025 * c3d.vnoise(t * 0.07, seed + 2) + spine_beat[i]
        extra = Quaternion((0, 0, 1), twist[i]) @ Quaternion((0, 1, 0), roll) @ Quaternion((1, 0, 0), -(lean + br))
        ds_eng = Dsp[i]; ds = ds_eng @ extra
        tilt = (0.05 * c3d.vnoise(t * 0.25, seed + 4) if listening else 0.0) - 0.6 * roll
        glance = 0.0
        if listening:
            g = c3d.vnoise(t * 0.33, seed + 6)
            glance = 0.09 * max(0.0, g - 0.45) / 0.55
        nod = NOD_RAD * (env[i] - 0.5 * env[max(0, i - 6)]) + head_beat[i] + listen_nod[i]
        if PM:
            bq, hq = plus.body_layer(t, talkw[i]); ds = ds @ bq
        dh = ds @ Quaternion((0, 0, 1), -0.5 * twist[i] + glance) @ rel[i] @ Quaternion((0, 1, 0), tilt) @ Quaternion((1, 0, 0), -nod)
        if PM: dh = dh @ hq
        if PP or PT: PX['spine_q'].append(ds); PX.setdefault('head_q', []).append(dh)
        D = {'hips': Quaternion(), 'spine': ds, 'neck': ds, 'head': dh}
        free = {s: free_w(p, s) for s in ('L', 'R')}
        g = gest(t) if (gest and talking) else None
        root_bl = c3d.v3(c['root'])
        for s, sign in (('R', -1), ('L', 1)):
            Srest = J['shoulder_' + s]; Sh = hips + ds @ (Srest - hips)
            T = T_spr[s][i] + (ds @ (ds_eng.inverted() @ (T_spr[s][i] - hips)) - (T_spr[s][i] - hips))   # the hands ride along with the extra body motion
            if g is not None:
                T = T + g[0 if s == 'L' else 1] * (GESTURE * free[s] * min(1.0, env[i] * 2.5))
            phone_on = s == 'L' and ((p[1] == 'phone' and p[2] > 0.5) or (p[0] == 'phone' and p[2] <= 0.5))
            if phone_on:   # handling the phone: small thumb-scroll bob
                T = T + Vector((0, 0, 0.006 * math.sin(2 * math.pi * 1.3 * t))) 
            k_ = min(1.0, max(0.0, p[2])); wc = (1 - k_) * (p[0] in ('cross', 'hug')) + k_ * (p[1] in ('cross', 'hug'))
            if wc > 0:   # arms crossed: the chibi forearms sank into the torso (X-shaped ink creases); hold them a few cm in front, hands a touch higher
                T = T + ds @ Vector((0, -0.06 * wc, 0.015 * wc))
            if PM and p[0] != p[1]:
                T = T + ds @ plus.arc_offset(p, s, min(1.0, max(0.0, p[2])))
            if PP and name == 'teo' and s == 'L':   # the phone goes down to the table / comes back from it on a pose change
                wph = (1 - k_) * (p[0] == 'phone') + k_ * (p[1] == 'phone')
                if p[0] != p[1] and 'phone' in (p[0], p[1]):
                    b_ = math.sin(math.pi * min(1.0, max(0.0, k_)))
                    T = T.lerp(W2A(phone_spot_w, c) + Vector((0, 0, 0.03)), 0.85 * b_)
                PX['phone_w'].append(wph)
                tw = ease((t - 1.35) / 0.35) * (1 - ease((t - 2.55) / 0.35))   # turns the screen to Bíp at the end of l1
                PX['phone_turn'].append(tw)
            if drink and s == ('R' if (W2A(glass_w['bip'], c) - J['hand_R']).length < (W2A(glass_w['bip'], c) - J['hand_L']).length else 'L'):
                t0, t1 = drink; gA = W2A(glass_w['bip'], c)
                mouthA = hips + ds @ (headp - hips) + ds @ Vector((0.0, -0.2, -0.06))
                if t0 <= t <= t1:
                    u = (t - t0) / (t1 - t0)
                    if u < 0.17: T = T.lerp(gA, ease(u / 0.17))
                    elif u < 0.34: T = gA.lerp(mouthA, ease((u - 0.17) / 0.17))
                    elif u < 0.72: T = mouthA + Vector((0, 0, 0.01 * math.sin((u - 0.34) * 30)))
                    elif u < 0.88: T = mouthA.lerp(gA, ease((u - 0.72) / 0.16))
                    else: T = gA.lerp(T, ease((u - 0.88) / 0.12))
            slam_w = 0.0
            if slam and s == 'R':
                hitA = W2A(c3d.v3((-0.27, 0.4775 + 0.045, 0.3)), c)
                a_ = ease((t - (slam - 0.22)) / 0.14) * (1 - ease((t - (slam - 0.06)) / 0.06))     # wind-up
                h_ = ease((t - (slam - 0.06)) / 0.06) * (1 - ease((t - (slam + 0.18)) / 0.5))     # down on the table, then away (slower retreat: 16/11, the drop in two frames made smooth.py fail)
                hitA = hitA + Vector((0, 0, SLAM_LIFT))   # 16/11 review: the fist stopped 1.5 cm under the top; lifted so it rests ON the surface
                T = T.lerp(hitA + Vector((0, 0.03, 0.16)), a_ * (1 - h_)).lerp(hitA, h_)
                slam_w = max(a_ * (1 - h_), h_)
                # the fist never dips under the top: on the way down, and on the way out while any of it is still over the table (then the plain eased path drops it past the edge)
                m_ = (root_bl + Quaternion((0, 0, 1), yaw) @ T).x - TABLE['x'][0]
                T.z += max(0.0, hitA.z - T.z) * min(1.0, slam_w * 8.0) * (1.0 if t < slam + 0.1 else c3d.smooth((m_ + 0.075) / 0.03))
            if GOAT: T = T.lerp(base[s][i], cw[s][i])
            else: T = keep_out(T, root_bl, yaw, hips, ds)
            pole = ds @ Vector((sign * POLE.x, POLE.y, POLE.z))
            if slam and s == 'R' and slam_w > 0:   # slam: the elbow rides up so the forearm comes down onto the fist from above the table edge
                pole = ds @ Vector((sign * POLE.x, POLE.y, POLE.z + (SLAM_POLE_Z - POLE.z) * slam_w))
            ks = 1.0
            if GOAT:   # the engine's arm is a stretchy tube: when the hand is further than the bones reach, the bones lengthen (goat.py)
                ks = max(1.0, (T - Sh).length / ((L[s][0] + L[s][1]) * 0.995)); GT[s].append(ks)
            E, Tc = two_bone(Sh, L[s][0] * ks, L[s][1] * ks, T, pole)
            if GOAT and s == 'L': GT['hand_L'].append(Tc.copy())
            u0 = ds @ (J['elbow_' + s] - Srest)
            du = u0.rotation_difference(E - Sh) @ ds
            f0 = du @ (J['hand_' + s] - J['elbow_' + s])
            dfo = f0.rotation_difference(Tc - E) @ du
            wrist = Quaternion((1, 0, 0), 0.12 * math.sin(2 * math.pi * 0.7 * t)) if phone_on else Quaternion()
            D['upperarm_' + s] = du; D['forearm_' + s] = dfo; D['hand_' + s] = dfo @ wrist
            if s == 'L' and name == 'teo':
                phone_vis.append(1.0 if phone_on else 0.0)
        if PP or PT:
            for s_ in ('L', 'R'): PX['hand'][s_].append(None)
        for bname, bone in bones.items():
            d = D.get(bname, Quaternion()); par = bone.parent.name if bone.parent else None
            dp = D.get(par, Quaternion()) if par else Quaternion()
            tracks[bname].append(Brest[bname].inverted() @ (dp.inverted() @ d) @ Brest[bname])
        # root: the head centre where the engine has it, measured on the ENGINE's body motion (the acting layer then moves it a few cm)
        qyaw = Quaternion((0, 0, 1), yaw)
        head_now = root_bl + qyaw @ (hips + ds_eng @ (headp - hips))
        loc.append(root_bl + (c3d.v3(c['head']) - head_now))
    arm.rotation_mode = 'QUATERNION'
    if GOAT:
        for s_ in ('L', 'R'):
            for bn in ('upperarm_' + s_, 'forearm_' + s_): bake_vec(arm, f'pose.bones["{bn}"].scale', fids, [(1.0, k, 1.0) for k in GT[s_]])
            for bn in ('forearm_' + s_, 'hand_' + s_):
                if bn in arm.data.bones: arm.data.bones[bn].inherit_scale = 'NONE'
        GOAT_TRACKS[name] = {'hand_L': [tuple(loc[i] + Quaternion((0, 0, 1), frames[i]['chars'][name]['yaw']) @ GT['hand_L'][i]) for i in range(n)]}
    bake_vec(arm, 'location', fids, [tuple(v) for v in loc])
    bake_vec(arm, 'rotation_quaternion', fids, [tuple(Quaternion((0, 0, 1), fr['chars'][name]['yaw'])) for fr in frames])
    for bname, qs in tracks.items():
        prev = None; out = []
        for q in qs:
            if prev is not None and prev.dot(q) < 0: q = -q
            out.append(tuple(q)); prev = q
        bake_vec(arm, f'pose.bones["{bname}"].rotation_quaternion', fids, out)
    if PT:   # squash-and-stretch: a damped, volume-preserving pulse on the spine (head and arms ride along) on each strong reaction
        ev = []
        for i in range(1, n):
            e0, e1 = frames[i - 1]['chars'][name].get('emo'), frames[i]['chars'][name].get('emo')
            if e0 and e1 and e1[1] != e0[1] and e1[1] in ('angry', 'shock', 'happy', 'smug'): ev.append((i, 0.05 if e1[1] in ('angry', 'shock') else 0.03))
        for b in my_beats: ev.append((b, 0.012))
        if slam: ev.append((int((slam - frames[0]['t']) * fps), 0.06))
        sq = plus.impulse_series(n, ev, fps, hz=3.4, zeta=0.32)
        bake_vec(arm, 'pose.bones["spine"].scale', fids, [(1 / math.sqrt(1 + a), 1 + a, 1 / math.sqrt(1 + a)) for a in sq])
        PX['events'] = ev
    PX.update({'slam': slam, 'drink': drink, 'name': name})
    plus.LAST[name] = PX
    print(f'RIG {name}: beats {len(my_beats)}, listening nods {len(their_beats)}, gesture layer {"on" if gest else "off"}' + (f', plus {sorted(plus.PLUS)}' if plus.PLUS else ''))
    return phone_vis, None


def build(header, frames, fids, col, chars_dir):
    faces_dir = os.path.join(os.path.dirname(os.path.abspath(header.get('_dump_path', ''))), 'faces')
    if os.path.isdir(faces_dir + '2x'): faces_dir += '2x'      # blender/faces_hires.py: crisper lines in close-ups
    if plus.on('faces'):   # the FACES agent's richer face acting, same numbering (faces_plus2x if upscaled)
        fp = os.path.join(os.path.dirname(os.path.abspath(header.get('_dump_path', ''))), 'faces_plus')
        if os.path.isdir(fp + '2x'): faces_dir = fp + '2x'
        elif os.path.isdir(fp): faces_dir = fp
    f0 = fids[0]; count = len(fids)
    heads = {}
    for name in header['cast']:
        if name not in frames[0]['chars']: continue
        arm, J, S = build_char(name, chars_dir, faces_dir, col, f0, count)
        pv, _ = animate(name, arm, S, header, frames, fids)
        if name == 'teo' and pv and any(pv):
            attach_phone(arm, col, fids, pv)
        if header.get('pack') == 'goat' and (header.get('cast_opts', {}).get(name) or {}).get('cup') == 'mate':
            import goat; goat.mate(name, col, fids, frames, header, GOAT_TRACKS.get(name), J)
        # an empty at the head centre, oriented like the head bone, for QA (engine head frame: +Y up, +Z forward)
        e = bpy.data.objects.new(name + '_head', None); col.objects.link(e)
        e.parent = arm; e.parent_type = 'BONE'; e.parent_bone = 'head'
        # a bone child sits at the bone's TAIL in bone space; the head bone points up with roll 0, so its frame is the engine's head frame
        # (X = the character's left, Y = up, Z = forward): step back down the bone to the pivot (sphere centre)
        B = arm.data.bones['head']
        e.matrix_parent_inverse = Matrix.Identity(4); e.location = (0, -B.length, 0)
        heads[name] = e
    return heads

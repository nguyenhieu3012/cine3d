"""Render a cine3d episode dump in Blender (run inside Blender):
  Blender -b --factory-startup -P blender/render_ep.py -- --dump out/t61/blender/dump.json --out out/t61/blender/bl \
      [--set out/t61/blender/set_cache.blend] [--from 0 --to 15.6] [--at 0.42,1.4] [--res 100] [--samples 48] [--nodrift] [--noqa] [--save scene.blend]
--at renders single stills (stills/t<t>.jpg, nearest dump frame); otherwise frames/f_<abs frame>.jpg for [--from, --to).
Everything is keyed from the dump before anything renders, so any frame renders the same picture whatever range is asked (determinism)."""
import bpy, os, sys, time, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import c3d, lights, camera, look, qa, plus
from c3d import flag


def append_set(path, names=('SET',)):
    """append the set's collection(s) from a .blend (set_build.py writes one collection 'SET'; a hand-built set such as
    ~/studio-assets/goat/pub_set.blend can name several: --set-collections pub,street). Returns one collection holding them."""
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        dst.collections = [c for c in src.collections if c in names]
    got = [c for c in dst.collections if c]
    if len(got) == 1:
        bpy.context.scene.collection.children.link(got[0]); return got[0]
    holder = bpy.data.collections.new('SET'); bpy.context.scene.collection.children.link(holder)
    for c in got: holder.children.link(c)
    return holder


def set_dynamic(frames, fids):
    """set pieces that set fx move / show / hide (dump.cjs --set-dyn deltas; names from export_set.cjs): unparented and keyed every frame
    (world transform converted to Blender axes, visibility as hide_render), CONSTANT keys. Returns the animated objects."""
    if 'set_dyn' not in frames[0]: return []
    from mathutils import Matrix, Vector, Quaternion
    from bake import bake, bake_vec
    ids = set(); [ids.update(fr['set_dyn'].keys()) for fr in frames[1:]]
    C = Matrix.Rotation(math.radians(90), 4, 'X'); Ci = C.inverted()
    out = []
    for i in sorted(ids):
        o = bpy.data.objects.get(i)
        if o is None: print('SETDYN missing object', i); continue
        st = frames[0]['set_dyn'].get(i); locs, rots, scs, hid = [], [], [], []
        if st is None:   # 21/11: an object that first appears after this chunk's first frame: hold its first state, hidden, until it shows up
            st = next(fr['set_dyn'][i] for fr in frames if i in fr['set_dyn']); st = [0] + list(st[1:])
        mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw; o.rotation_mode = 'QUATERNION'
        for fr in frames:
            st = fr['set_dyn'].get(i, st)
            if any(v is None for v in st[1:11]):   # 21/11: a zero-scale (hidden) object dumps a NaN rotation: identity rotation, tiny scale, hidden
                st = [0] + [(v if v is not None else 0.0) for v in st[1:4]] + [0.0, 0.0, 0.0, 1.0, 1e-4, 1e-4, 1e-4]
            W3 = Matrix.LocRotScale(Vector(st[1:4]), Quaternion((st[7], st[4], st[5], st[6])), Vector(st[8:11]))
            l, r, sc = (C @ W3 @ Ci).decompose()
            if rots and rots[-1].dot(r) < 0: r = -r
            locs.append(tuple(l)); rots.append(r); scs.append(tuple(sc)); hid.append(0.0 if st[0] else 1.0)
        bake_vec(o, 'location', fids, locs, 'CONSTANT'); bake_vec(o, 'rotation_quaternion', fids, [tuple(r) for r in rots], 'CONSTANT')
        bake_vec(o, 'scale', fids, scs, 'CONSTANT'); bake(o, 'hide_render', 0, fids, hid, 'CONSTANT')
        o['c3d_dyn'] = True; out.append(o)
    print(f'SETDYN {len(out)} animated set pieces')
    return out


def swap_keeps(o, header):
    """the engine's set-swap keep rule (core/player.js swapKeeps): a piece whose bounding box centre lies in the seating zone
    (cast seats' x and z +-0.65 m, z up to +1.0 m in front), lower than 1.3 m and narrower than 2.2 m: the table, what is on it, the stools"""
    from mathutils import Vector
    seats = [header['seats'][n]['pos'] for n in header['cast'] if n in header['seats']]
    xs = [p[0] for p in seats]; zs = [p[2] for p in seats]
    x0, x1, z0, z1 = min(xs) - 0.65, max(xs) + 0.65, min(zs) - 0.65, max(zs) + 1.0
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo = Vector((min(v.x for v in bb), min(v.y for v in bb), min(v.z for v in bb))); hi = Vector((max(v.x for v in bb), max(v.y for v in bb), max(v.z for v in bb)))
    c = (lo + hi) / 2; cz3 = -c.y   # Blender y = -three z
    return hi.z < 1.3 and x0 < c.x < x1 and z0 < cz3 < z1 and (hi.x - lo.x) < 2.2 and (hi.y - lo.y) < 2.2


def cast_pass(sc, set_col, header, jobs, outdir):
    """set swap: the cast + the kept table/stools on a TRANSPARENT film (RGBA PNG), no depth of field, no haze, the rest of the set hidden
    (lights stay: the cast keeps its look). compose.py lays the engine's board under it with the dump's fade."""
    os.makedirs(outdir, exist_ok=True)
    hidden = []
    bpy.context.view_layer.update()
    for o in list(set_col.all_objects):   # a list: changing hide_render rebuilds all_objects and cut a live iteration short
        if o.type == 'MESH' and not swap_keeps(o, header):
            hidden.append((o, o.visible_camera, o.visible_shadow, o.hide_render))
            o.visible_camera = False; o.visible_shadow = False   # (animated pieces keep their hide_render keys: ray visibility hides them here)
            if not o.get('c3d_dyn'): o.hide_render = True
    w = sc.world.node_tree; vout = next(n for n in w.nodes if n.bl_idname == 'ShaderNodeOutputWorld')
    vol_links = [(l.from_socket, l.to_socket) for l in vout.inputs['Volume'].links]
    for l in list(vout.inputs['Volume'].links): w.links.remove(l)
    sc.render.film_transparent = True
    fmt = sc.render.image_settings; old = (fmt.file_format, fmt.color_mode)
    fmt.file_format = 'PNG'; fmt.color_mode = 'RGBA'; fmt.color_depth = '8'; fmt.compression = 90   # ~1500 swap frames: keep the disk low
    cam = sc.camera.data; dof = cam.dof.use_dof; cam.dof.use_dof = False
    if cam.animation_data and cam.animation_data.action:
        pass
    sc.frame_set(jobs[0][0]); bpy.ops.render.render(write_still=False)   # warm-up (determinism)
    for f, _ in jobs:
        sc.frame_set(f); cam.dof.use_dof = False
        sc.render.filepath = os.path.join(outdir, f'f_{f:05d}.png'); bpy.ops.render.render(write_still=True)
    for o, vc, vs, hr in hidden: o.visible_camera = vc; o.visible_shadow = vs; o.hide_render = hr
    for a, b in vol_links: w.links.new(a, b)
    sc.render.film_transparent = False; fmt.file_format, fmt.color_mode = old; cam.dof.use_dof = dof
    print(f'CAST PASS {len(jobs)} frames -> {outdir} (set meshes {sum(1 for o in set_col.all_objects if o.type == "MESH")}, hidden {len(hidden)})')


def build_cast(header, frames, fids, col):
    chars_dir = os.path.join(c3d.CINE, 'out', 'chars')
    try:
        import cast_rig                           # the exact cine3d characters, once out/chars/ exists
        if cast_rig.available(chars_dir, header):
            return cast_rig.build(header, frames, fids, col, chars_dir)
    except ImportError:
        pass
    import cast_proxy
    print('CAST: placeholders (out/chars/ not there yet)')
    return cast_proxy.build(header, frames, fids, col)


def swap_first(frames, f):
    return next((fr.get('swap', 0) for fr in frames if fr['f'] == f), 0)


def main():
    a = c3d.args_after_dashes(sys.argv)
    dump = os.path.abspath(flag(a, 'dump')); out = os.path.abspath(flag(a, 'out'))
    setf = os.path.abspath(flag(a, 'set', os.path.join(os.path.dirname(dump), 'set_cache.blend')))
    header, frames = c3d.load_dump(dump)
    header['_dump_path'] = dump
    plus.PLUS.clear(); plus.PLUS.update(x for x in str(flag(a, 'plus', '') or '').split(',') if x and x != 'True')
    if plus.PLUS: print('PLUS', sorted(plus.PLUS))
    fps = header['fps']; fids = [fr['f'] for fr in frames]
    T0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = fids[0], fids[-1]
    set_col = append_set(setf, tuple(str(flag(a, 'set-collections', 'SET')).split(',')))
    plus.atmos_boost(set_col)
    col = bpy.data.collections.new('EPISODE'); sc.collection.children.link(col)
    set_dynamic(frames, fids)
    try:   # GOAT 16/11: scene-level episode props (the flag cloth...) from <dump dir>/props/props.json; no file = nothing happens (Trà đá unchanged)
        import props_cache; props_cache.build(dump, header, frames, fids, set_col, col, a)
    except ImportError:
        pass
    lights.build(header, frames, fids, col, set_col)
    NOCAST = bool(flag(a, 'nocast', False))   # HYBRID (20/11): Blender draws the SET only; cine3d draws the cast (blender/castpass.cjs) and blender/hybrid.py lays it over. The camera must then be the engine's, exactly
    camera.EXACT = NOCAST
    camera.build(header, frames, fids, col, drift=not (flag(a, 'nodrift', False) or NOCAST))
    cast_col = bpy.data.collections.new('CAST'); col.children.link(cast_col)
    heads = {} if NOCAST else build_cast(header, frames, fids, cast_col)
    if plus.PLUS & {'props', 'toon'}:
        arms = {n: h.parent for n, h in heads.items()}
        if plus.on('toon'):
            for n, arm in arms.items(): plus.springs(arm, n, fids, fps)
        if plus.on('props'): plus.props_post(arms, set_col, header, frames, fids)
    plus.bip_mask(cast_col)
    lights.PACK = header.get('pack')
    if not NOCAST: lights.character_rig(cast_col, col)
    lights.set_fill(set_col, col)
    lights.rim_receivers(set_col, cast_col)
    if plus.fk('shadow'):   # FAST: the set's shadow casters are the cast's neighbourhood only (the engine's swap keep rule: table, what is on it, stools); walls, shelves, street cast none
        bpy.context.view_layer.update(); n_ = 0
        for o in list(set_col.all_objects):
            if o.type == 'MESH' and not o.get('c3d_dyn') and not swap_keeps(o, header): o.visible_shadow = False; n_ += 1
        print(f'PLUS fast shadows: {n_} set meshes no longer cast')
    if not NOCAST: lights.bip_fill(cast_col, col)
    try:   # 18/11: stepped stall light levels (only when the dump carries light_groups + lg)
        import lightlevels; lightlevels.build(header, frames, fids, set_col, col)
    except ImportError:
        pass
    look.setup(header, res_pct=int(flag(a, 'res', 100)), samples=int(flag(a, 'samples', 32)))
    look.grade_from_dump(frames, fids)
    plus.mblur_keys(frames, fids)
    if not flag(a, 'noink', False) and not NOCAST:
        look.inner_lines(cast_col)   # (look.inner_ink = the Freestyle variant: its lines hid inside the hulls)
    os.makedirs(out, exist_ok=True)
    if (not flag(a, 'noqa', False) or flag(a, 'qaonly', False)) and not NOCAST:
        qa.run(header, frames, fids, heads, os.path.join(out, 'qa.json'))
    if flag(a, 'qaonly', False):
        print('QAONLY done'); return
    if flag(a, 'save', None):
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(flag(a, 'save')))
    print(f'SETUP {time.time() - T0:.1f} s')
    at = flag(a, 'at', None); fsel = flag(a, 'frames', None)   # --frames 100,101,...: exact frame numbers, normal-run behaviour (swap frames: cast pass only), per-frame timings (benchmarks)
    if fsel:
        jobs = [(int(x), os.path.join(out, 'frames', f'f_{int(x):05d}.jpg')) for x in str(fsel).split(',') if fids[0] <= int(x) <= fids[-1]]
    elif at:
        jobs = []
        for t in str(at).split(','):
            t = float(t); f = int(t * fps)   # frame whose t = (f + 0.5) / fps is nearest
            if f < fids[0] or f > fids[-1]: continue
            jobs.append((f, os.path.join(out, 'stills', f't{t:.2f}.jpg')))
    else:
        f0 = int(round(float(flag(a, 'from', header['from'])) * fps)); f1 = int(round(float(flag(a, 'to', header['to'])) * fps))
        jobs = [(f, os.path.join(out, 'frames', f'f_{f:05d}.jpg')) for f in range(max(f0, fids[0]), min(f1, fids[-1] + 1))]
    # determinism: no time stamps in the files, and one throw-away warm-up render (the first EEVEE render after loading differs
    # in a few pixels from every later one: shader / texture / shadow caches); after it the same frame is bit-identical (md5)
    for p in dir(sc.render):
        if p.startswith('use_stamp'):
            try: setattr(sc.render, p, False)
            except Exception: pass
    T1 = time.time()
    if flag(a, 'prof', False):   # cost profile of the first --frames frame (blender/prof.py), then stop
        import prof; f_ = jobs[0][0]
        if swap_first(frames, f_) >= 0.999:
            def cast_fn(f):
                t0_ = time.time(); cast_pass(sc, set_col, header, [(f, 'x'), (f, 'x')], os.path.join(out, 'prof_cast')); return (time.time() - t0_) / 3
            (prof.run_shadow if str(flag(a, 'prof')) == '2' else prof.run_fixed if str(flag(a, 'prof')) == '3' else prof.run)(sc, f_, cast_fn)
        else: (prof.run_shadow if str(flag(a, 'prof')) == '2' else prof.run_fixed if str(flag(a, 'prof')) == '3' else prof.run)(sc, f_)
        return
    resume = bool(flag(a, 'resume', False))
    swap = {fr['f']: fr.get('swap', 0) for fr in frames}
    todo = [j for j in jobs if not (resume and os.path.exists(j[1])) and not (swap.get(j[0], 0) >= 0.999 and not at)]
    if todo:
        sc.frame_set(todo[0][0]); bpy.ops.render.render(write_still=False)
    swap = {fr['f']: fr.get('swap', 0) for fr in frames}
    ptime = {}
    for f, path in jobs:
        if swap.get(f, 0) >= 0.999 and not at:   # fully swapped: only the cast pass is needed
            continue
        if resume and os.path.exists(path):       # --resume: a frame already on disk is kept
            continue
        t_f = time.time(); sc.frame_set(f); sc.render.filepath = path
        bpy.ops.render.render(write_still=True); ptime[f] = round(time.time() - t_f, 2)
    sw_jobs = [(f, p) for f, p in jobs if swap.get(f, 0) > 0]
    if resume and sw_jobs and not at:
        cdir = os.path.dirname(sw_jobs[0][1]).rstrip('/') + '_cast'
        sw_jobs = [(f, p) for f, p in sw_jobs if not os.path.exists(os.path.join(cdir, f'f_{f:05d}.png'))]
    t_c = time.time()
    if sw_jobs:
        cast_pass(sc, set_col, header, sw_jobs, os.path.dirname(sw_jobs[0][1]).rstrip('/') + '_cast' if not at else os.path.join(out, 'stills_cast'))
    t_c = time.time() - t_c
    dt = time.time() - T1
    rep = {'frames': len(jobs), 'seconds': round(dt, 1), 's_per_frame': round(dt / max(1, len(jobs)), 3), 'setup_s': round(T1 - T0, 1), 'res_pct': int(flag(a, 'res', 100)), 'samples': int(flag(a, 'samples', 32)), 'main_s': round(sum(ptime.values()), 2), 'main_n': len(ptime), 'cast_s': round(t_c, 2), 'cast_n': len(sw_jobs)}
    if fsel: rep['ptime'] = ptime
    json.dump(rep, open(os.path.join(out, 'render_report.json'), 'w'))
    print('RENDER', json.dumps(rep))


if __name__ == '__main__':
    main()

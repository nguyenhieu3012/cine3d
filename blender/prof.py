"""render cost profile (17/11): `render_ep.py ... --prof 1 --frames F` times one frame with one thing switched off at a time. Not used by any normal run."""
import bpy, time


def _t(sc, f, n=2):
    sc.frame_set(f); bpy.ops.render.render(write_still=False)   # warm
    t = time.time()
    for _ in range(n): sc.frame_set(f); bpy.ops.render.render(write_still=False)
    return (time.time() - t) / n


def run(sc, f, cast_fn=None):
    ee = sc.eevee; res = {}
    lines = [o for o in bpy.data.objects if o.type in ('GREASEPENCIL', 'GPENCIL')]
    def meas(name):
        if cast_fn: res[name] = cast_fn(f)
        else: res[name] = _t(sc, f)
        print(f'PROF {name}: {res[name]:.2f} s', flush=True)
    meas('base')
    for o in lines: o.hide_render = True
    meas('no_lineart'); [setattr(o, 'hide_render', False) for o in lines]
    old = ee.taa_render_samples
    for s in (16, 8): ee.taa_render_samples = s; meas(f'samples_{s}')
    ee.taa_render_samples = old
    ee.use_shadows = False; meas('no_shadows'); ee.use_shadows = True
    ee.use_raytracing = False; meas('no_raytracing'); ee.use_raytracing = True
    old = ee.ray_tracing_options.resolution_scale; ee.ray_tracing_options.resolution_scale = '2'; meas('rt_half'); ee.ray_tracing_options.resolution_scale = old
    ee.use_fast_gi = False; meas('no_ao'); ee.use_fast_gi = True
    sc.render.use_compositing = False; meas('no_compositor'); sc.render.use_compositing = True
    cam = sc.camera.data
    if not cast_fn:
        d = cam.dof.use_dof; cam.dof.use_dof = False; meas('no_dof'); cam.dof.use_dof = d
        w = sc.world.node_tree; vout = next(n for n in w.nodes if n.bl_idname == 'ShaderNodeOutputWorld'); links = [(l.from_socket, l.to_socket) for l in vout.inputs['Volume'].links]
        for l in list(vout.inputs['Volume'].links): w.links.remove(l)
        meas('no_world_haze')
        for a, b in links: w.links.new(a, b)
    old = sc.render.resolution_percentage
    for p in (85, 70): sc.render.resolution_percentage = p; meas(f'res_{p}')
    sc.render.resolution_percentage = old
    return res


def run_shadow(sc, f, cast_fn=None):
    """what costs in the shadows: scale, steps, each shadowed light on its own"""
    ee = sc.eevee
    def meas(name):
        r = cast_fn(f) if cast_fn else _t(sc, f, 1)
        print(f'PROF {name}: {r:.2f} s', flush=True)
    meas('base')
    lights = [o for o in bpy.data.objects if o.type == 'LIGHT' and o.data.use_shadow]
    print('PROF shadowed lights:', [(o.name, o.data.type) for o in lights], flush=True)
    for s in (0.5, 0.25): ee.shadow_resolution_scale = s; meas(f'shadow_res_{s}')
    ee.shadow_resolution_scale = 1.0
    for st in (1, 2): old = ee.shadow_step_count; ee.shadow_step_count = st; meas(f'steps_{st}'); ee.shadow_step_count = old
    for o in lights:
        o.data.use_shadow = False; meas('off_' + o.name); o.data.use_shadow = True
    for o in lights: o.data.use_shadow = False
    meas('all_off')
    for o in lights: o.data.use_shadow = True
    ee.light_threshold = 0.1; meas('light_threshold_0.1'); ee.light_threshold = 0.01


def run_fixed(sc, f, cast_fn=None):
    """fixed cost per frame: frame_set alone, and a 10 % render (almost no pixels)"""
    t = time.time()
    for k in range(5): sc.frame_set(f + k)
    print(f'PROF frame_set x5 (avg): {(time.time() - t) / 5:.2f} s', flush=True)
    r = (cast_fn(f) if cast_fn else _t(sc, f, 1)); print(f'PROF base: {r:.2f} s', flush=True)
    sc.render.resolution_percentage = 10
    r = (cast_fn(f) if cast_fn else _t(sc, f, 1)); print(f'PROF res_10: {r:.2f} s', flush=True)
    sc.render.resolution_percentage = 100; ee = sc.eevee
    ee.use_shadows = False; ee.taa_render_samples = 1; sc.render.use_compositing = False
    r = (cast_fn(f) if cast_fn else _t(sc, f, 1)); print(f'PROF full res, 1 sample, no shadows, no compositor: {r:.2f} s', flush=True)
    sc.render.resolution_percentage = 10
    r = (cast_fn(f) if cast_fn else _t(sc, f, 1)); print(f'PROF res_10 + same: {r:.2f} s', flush=True)

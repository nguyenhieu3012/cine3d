"""Fast keyframe baking: one key per frame straight into an F-curve (foreach_set), LINEAR between frames.
Frames are rendered on integers only, so interpolation never shows; LINEAR keeps a cut a cut."""
import bpy


def fcurve(idblock, path, index=0):
    ad = idblock.animation_data or idblock.animation_data_create()
    if ad.action is None:
        act = bpy.data.actions.new(idblock.name + '_bake')
        ad.action = act
    act = ad.action
    # Blender 5 slotted actions: fcurve_ensure_for_datablock creates layer/strip/slot as needed
    fc = act.fcurve_ensure_for_datablock(idblock, path, index=index)
    return fc


def bake(idblock, path, index, frames, values, interp='LINEAR'):
    fc = fcurve(idblock, path, index)
    fc.keyframe_points.clear()
    n = len(frames)
    fc.keyframe_points.add(n)
    co = [0.0] * (2 * n)
    for i, (f, v) in enumerate(zip(frames, values)):
        co[2 * i] = float(f); co[2 * i + 1] = float(v)
    fc.keyframe_points.foreach_set('co', co)
    fc.keyframe_points.foreach_set('interpolation', [bpy.types.Keyframe.bl_rna.properties['interpolation'].enum_items[interp].value] * n)
    fc.update()
    return fc


def bake_vec(idblock, path, frames, vecs, interp='LINEAR'):
    for i in range(len(vecs[0])):
        bake(idblock, path, i, frames, [v[i] for v in vecs], interp)

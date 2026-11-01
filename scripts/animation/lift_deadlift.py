"""LIFT toon scene: stylised 3D conventional barbell deadlift with the ElegantMesh "Strong Male Superhero" rig (derived from lift_squat.py).

Run headless (embedded scripts in the asset stay disabled):
  Blender -b --factory-startup --disable-autoexec CHAR.blend --python lift_toon_scene.py -- OUT_DIR [P]
P is the bar position, 0 = lockout, 1 = on the chest, "anim" for the 6 s HD rep (180 frames), or
"tile" for the app tile (spec in lift_palette.json "tile": 3 s at 24 fps rendered at 1440; lift_tile_encode.sh makes the 720x720 MP4).
Writes OUT_DIR/lift_toon_bench.blend and the render.

The character stays upright in world space and the set is built around him: lying-frame axes are
X_l along the bench towards the head = world +Z, Y_l up from the floor = world -Y, Z_l along the bar
= world +X. This keeps the Rigify controls in their rest orientation.
Asset licence: ElegantMesh Extended Use License (RenderHub), commercial use allowed.
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = Path(argv[0])
TILE = len(argv) > 1 and argv[1] == "tile"     # app tile, spec in lift_palette.json "tile"
CHECK_ONLY = len(argv) > 1 and argv[1] == "check"   # solve + check all 72 frames, no render (about a minute)
ANIM = len(argv) > 1 and argv[1] in ("anim", "tile", "check")
P = 0.0 if ANIM or len(argv) < 2 or "=" in argv[1] else float(argv[1])
DEBUG = "--debug" in argv
# Look: every colour, light and effect comes from lift_palette.json (style=neon by default, or studio).
STYLE = next((a.split("=")[1] for a in argv if a.startswith("style=")), "neon")
PALETTES = json.loads((Path(__file__).with_name("lift_palette.json")).read_text())
PAL, TILE_SPEC = PALETTES[STYLE], PALETTES["tile"]
FPS, SECONDS = (TILE_SPEC["fps"], float(TILE_SPEC["seconds"])) if (TILE or CHECK_ONLY) else (30, 6.0)
OUT.mkdir(parents=True, exist_ok=True)
TEX = Path(bpy.data.filepath).parent.parent / "textures" / "Textures"

RIG = bpy.data.objects["Man3NT_Rigify"]
BODY = bpy.data.objects["NUG_Base_Body"]


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c) + (1.0,)


# ---------------------------------------------------------------- measure the body

def body_points(pred):
    m = BODY.matrix_world
    return [m @ v.co for v in BODY.data.vertices if pred(m @ v.co)]


chest = body_points(lambda p: 1.28 < p.z < 1.45 and abs(p.x) < 0.12)
Y_BACK = max(p.y for p in chest)            # back surface (rests on the pad)
Y_FRONT = min(p.y for p in chest)           # chest surface (where the bar touches)
HIP_Z = RIG.pose.bones["thigh_parent.L"].head.z
SH = RIG.matrix_world @ RIG.pose.bones["upper_arm_parent.L"].head
EYE_Z = bpy.data.objects["NUG_Base_Eye"].matrix_world.translation.z
eye_pts = [bpy.data.objects["NUG_Base_Eye"].matrix_world @ v.co for v in bpy.data.objects["NUG_Base_Eye"].data.vertices]
EYE_Z = sum(p.z for p in eye_pts) / len(eye_pts)
PAD_H = 0.43
FLOOR_Y = Y_BACK + PAD_H                    # world y of the floor plane


def W(xl, yl, zl):
    """Lying-frame metres (X_l from the hip towards the head, Y_l above the floor) to world."""
    return Vector((zl, FLOOR_Y - yl, HIP_Z + xl))


print("MEASURE", dict(y_back=round(Y_BACK, 3), y_front=round(Y_FRONT, 3), hip_z=round(HIP_Z, 3),
                      shoulder=[round(v, 3) for v in SH], eye_z=round(EYE_Z, 3)))

# ---------------------------------------------------------------- materials

def principled(name, color, rough=0.5, sss=0.0, alpha_img=None, alpha=1.0, sheen=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = srgb(color) if isinstance(color, str) else color
    b.inputs["Roughness"].default_value = rough
    if sss:
        b.inputs["Subsurface Weight"].default_value = sss
        b.inputs["Subsurface Radius"].default_value = (1.0, 0.35, 0.2)
        b.inputs["Subsurface Scale"].default_value = 0.02
    if sheen:
        b.inputs["Sheen Weight"].default_value = sheen
    if alpha_img and (TEX / alpha_img).exists():
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = bpy.data.images.load(str(TEX / alpha_img))
        t.image.colorspace_settings.name = "Non-Color"
        nt.links.new(t.outputs["Color"], b.inputs["Alpha"])
    elif alpha < 1:
        b.inputs["Alpha"].default_value = alpha
    return m


def image_material(name, img, rough=0.3):
    m = principled(name, "#ffffff", rough)
    if (TEX / img).exists():
        nt = m.node_tree
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = bpy.data.images.load(str(TEX / img))
        nt.links.new(t.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
    return m


SKIN = principled("Toon_Skin", PAL["skin"], rough=PAL["skin_roughness"], sss=PAL["skin_sss"])
NAILS = principled("Toon_Nails", "#f2c3ad", rough=0.3)
SHORTS = principled("Toon_Shorts", PAL["shorts"], rough=0.7, sheen=0.15)
HAIR = principled("Toon_Hair", "#3b2a20", rough=0.55)
BROWS = principled("Toon_Brows", "#2f2119", rough=0.6, alpha_img="Female_Flat_Transparency_Opacity.jpg")
LASH = principled("Toon_Lash", "#1a1210", rough=0.6, alpha_img="Std_Eyelash_Opacity.jpg")
CLEAR = principled("Toon_Clear", "#ffffff", alpha=0.0)
TEETH = principled("Toon_Teeth", "#f4efe6", rough=0.25)
TONGUE = principled("Toon_Tongue", "#c96b6b", rough=0.4)
EYE_L = image_material("Toon_Eye_L", "Std_Eye_L_Diffuse.png")
EYE_R = image_material("Toon_Eye_R", "Std_Eye_R_Diffuse.png")

remap = {"NUG_Skin_Head": SKIN, "NUG_Skin_Body": SKIN, "NUG_Skin_Arm": SKIN, "NUG_Skin_Leg": SKIN,
         "NUG_Nails": NAILS, "NUG_Eyelash": LASH, "Boxers": SHORTS,
         "Female_Flat_Transparency": BROWS, "Female_Flat_Base_Transparency": CLEAR,
         "NUG_Eye_R": EYE_R, "NUG_Eye_L": EYE_L, "NUG_Cornea_R": CLEAR, "NUG_Cornea_L": CLEAR,
         "NUG_Eye_ONUGlusion_R": CLEAR, "NUG_Eye_ONUGlusion_L": CLEAR, "NUG_Tearline_R": CLEAR,
         "NUG_Tearline_L": CLEAR, "NUG_Upper_Teeth": TEETH, "NUG_Lower_Teeth": TEETH, "NUG_Tongue": TONGUE}
if PAL["mannequin"]:
    # Mannequin: one matte grey surface, no hair, brows, lashes or coloured eyes.
    remap.update({"NUG_Nails": SKIN, "NUG_Eyelash": CLEAR, "Female_Flat_Transparency": CLEAR,
                  "NUG_Eye_R": SKIN, "NUG_Eye_L": SKIN})
for ob in bpy.data.objects:
    if ob.type == "MESH" and ob.parent == RIG:
        for slot in ob.material_slots:
            if slot.material and slot.material.name in remap:
                slot.material = remap[slot.material.name]

# ---------------------------------------------------------------- flatten the groin

def flatten_groin():
    """Push the shorts' pouch and the body under it back onto a smooth line from the lower belly
    down (Matt: keep that area flat). Moves every shape key by the same amount."""
    ss = lambda e0, e1, x: (lambda u: u * u * (3 - 2 * u))(min(max((x - e0) / (e1 - e0), 0.0), 1.0))
    for ob, inset in ((bpy.data.objects["Boxers"], 0.0), (BODY, 0.012)):
        mw = ob.matrix_world
        to_local = mw.inverted().to_3x3()
        keys = ob.data.shape_keys.key_blocks if ob.data.shape_keys else []
        for v in ob.data.vertices:
            p = mw @ v.co
            # Front slopes back steeply from the lower belly to the crotch (a flat athletic brief).
            y_flat = -0.095 + min(max((0.965 - p.z) / 0.145, 0.0), 1.0) * 0.068 + inset
            w = ss(0.085, 0.05, abs(p.x)) * ss(0.8, 0.825, p.z) * ss(0.99, 0.96, p.z)
            if w <= 0 or p.y >= y_flat:
                continue
            d = to_local @ Vector((0.0, (y_flat - p.y) * w, 0.0))
            v.co += d
            for k in keys:
                k.data[v.index].co += d



def hide_under_shorts():
    """Skin faces fully covered by the shorts get the clear material, so none can poke through."""
    BODY.data.materials.append(CLEAR)
    idx = len(BODY.data.materials) - 1
    mw = BODY.matrix_world
    for poly in BODY.data.polygons:
        c = mw @ poly.center
        if 0.83 < c.z < 1.02 and abs(c.x) < 0.15:
            poly.material_index = idx


flatten_groin()
hide_under_shorts()

# ---------------------------------------------------------------- worked muscles: red glow

def worked_mask():
    """Per-vertex 0..1 'work' from rest-pose geometry: hamstrings and glutes (back of the thigh and hip) and the
    erector spinae along the lower back."""
    ss = lambda e0, e1, x: (lambda u: u * u * (3 - 2 * u))(min(max((x - e0) / (e1 - e0), 0.0), 1.0))
    legs = {}
    for side in ("L", "R"):
        legs[side] = (RIG.matrix_world @ RIG.data.bones[f"DEF-thigh.{side}"].head_local,
                      RIG.matrix_world @ RIG.data.bones[f"DEF-shin.{side}"].head_local)
    attr = BODY.data.attributes.new("work", "FLOAT", "POINT")
    mw = BODY.matrix_world
    for v in BODY.data.vertices:
        p = mw @ v.co
        work = 0.0
        for side, (hd, kn) in legs.items():
            axis = kn - hd
            t = (p - hd).dot(axis) / axis.length_squared
            off = p - (hd + axis * t)
            w = 0.085 - 0.03 * min(max(t, 0.0), 1.0)
            ham = ss(0.30, 0.42, t) * ss(0.95, 0.80, t) * ss(0.005, 0.035, off.y) * ss(w, w * 0.45, abs(off.x))
            glute = ss(0.0, 0.1, t) * ss(0.45, 0.22, t) * ss(0.005, 0.04, off.y) * ss(0.14, 0.10, off.length)
            work = max(work, ham, glute * 0.9)
        erector = ss(0.075, 0.04, abs(p.x)) * ss(1.02, 1.1, p.z) * ss(1.42, 1.32, p.z) * ss(0.02, 0.07, p.y)
        work = max(work, erector)
        attr.data[v.index].value = work


def glow_skin():
    """Skin shader: worked muscles in the palette's core colour with an edge band of a second colour,
    a cool fresnel rim on the rest of the body, and a 'GlowPulse' value the animation keys with effort."""
    nt = SKIN.node_tree
    b = nt.nodes["Principled BSDF"]
    new = nt.nodes.new
    link = nt.links.new
    attr = new("ShaderNodeAttribute")
    attr.attribute_name = "work"
    core = new("ShaderNodeMapRange")                    # 0 -> 1 across the muscle's inner edge
    core.interpolation_type = "SMOOTHSTEP"
    core.inputs["From Min"].default_value, core.inputs["From Max"].default_value = 0.2, 0.4
    rise = new("ShaderNodeMapRange")
    rise.interpolation_type = "SMOOTHSTEP"
    rise.inputs["From Min"].default_value, rise.inputs["From Max"].default_value = 0.08, 0.22
    fall = new("ShaderNodeMapRange")
    fall.interpolation_type = "SMOOTHSTEP"
    fall.inputs["From Min"].default_value, fall.inputs["From Max"].default_value = 0.42, 0.28
    edge = new("ShaderNodeMath")
    edge.operation = "MULTIPLY"                         # a band around the muscle's outline
    for n in (core, rise, fall):
        link(attr.outputs["Fac"], n.inputs["Value"])
    link(rise.outputs["Result"], edge.inputs[0])
    link(fall.outputs["Result"], edge.inputs[1])

    col = new("ShaderNodeMix")
    col.data_type = "RGBA"
    col.inputs["A"].default_value = b.inputs["Base Color"].default_value[:]
    tone = new("ShaderNodeValToRGB")                    # red at the muscle's rim -> orange -> hot amber core
    stops = PAL["muscle_ramp"]
    while len(tone.color_ramp.elements) < len(stops):
        tone.color_ramp.elements.new(0.5)
    for el, (pos, hexc) in zip(tone.color_ramp.elements, stops):
        el.position, el.color = pos, srgb(hexc)
    tone_in = new("ShaderNodeMapRange")
    tone_in.inputs["From Min"].default_value, tone_in.inputs["From Max"].default_value = 0.2, 1.0
    link(attr.outputs["Fac"], tone_in.inputs["Value"])
    link(tone_in.outputs["Result"], tone.inputs["Fac"])
    link(tone.outputs["Color"], col.inputs["B"])
    link(core.outputs["Result"], col.inputs["Factor"])
    link(col.outputs["Result"], b.inputs["Base Color"])

    fres = new("ShaderNodeLayerWeight")
    fres.inputs["Blend"].default_value = 0.35
    rim = new("ShaderNodeMath")
    rim.operation = "POWER"
    rim.inputs[1].default_value = 3.0   # a thin edge, not a halo over the whole body
    link(fres.outputs["Facing"], rim.inputs[0])

    e_col = new("ShaderNodeMix")                        # rim colour -> edge colour -> glow colour
    e_col.data_type = "RGBA"
    e_col.inputs["A"].default_value = srgb(PAL["rim_fresnel"])
    e_col.inputs["B"].default_value = srgb(PAL["muscle_edge"])
    link(edge.outputs[0], e_col.inputs["Factor"])
    e_col2 = new("ShaderNodeMix")
    e_col2.data_type = "RGBA"
    link(tone.outputs["Color"], e_col2.inputs["B"])
    link(e_col.outputs["Result"], e_col2.inputs["A"])
    link(core.outputs["Result"], e_col2.inputs["Factor"])
    link(e_col2.outputs["Result"], b.inputs["Emission Color"])

    pulse = new("ShaderNodeValue")
    pulse.name = pulse.label = "GlowPulse"
    pulse.outputs[0].default_value = 1.0
    def scaled(sock, k):
        m = new("ShaderNodeMath")
        m.operation = "MULTIPLY"
        link(sock, m.inputs[0])
        m.inputs[1].default_value = k
        return m.outputs[0]
    def add(x, y):
        m = new("ShaderNodeMath")
        m.operation = "ADD"
        link(x, m.inputs[0])
        link(y, m.inputs[1])
        return m.outputs[0]
    def mul(x, y):
        m = new("ShaderNodeMath")
        m.operation = "MULTIPLY"
        link(x, m.inputs[0])
        link(y, m.inputs[1])
        return m.outputs[0]
    muscle = mul(add(scaled(core.outputs["Result"], PAL["muscle_glow_strength"]),
                     scaled(edge.outputs[0], PAL["muscle_edge_strength"])), pulse.outputs[0])
    strength = add(muscle, scaled(rim.outputs[0], PAL["rim_fresnel_strength"]))
    link(strength, b.inputs["Emission Strength"])


worked_mask()
glow_skin()

# ---------------------------------------------------------------- short hair, painted on the scalp

def paint_hair():
    """Buzz cut: scalp faces get the hair material (a copied shell flickers against the skin)."""
    if PAL["mannequin"]:
        return  # bald mannequin: the scalp stays skin
    nt = HAIR.node_tree
    noise, bump = nt.nodes.new("ShaderNodeTexNoise"), nt.nodes.new("ShaderNodeBump")
    noise.inputs["Scale"].default_value = 900.0
    bump.inputs["Strength"].default_value = 0.25
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], nt.nodes["Principled BSDF"].inputs["Normal"])
    BODY.data.materials.append(HAIR)
    idx = len(BODY.data.materials) - 1
    m = BODY.matrix_world
    for poly in BODY.data.polygons:
        c = m @ poly.center
        ear = abs(c.x) > 0.072 and c.z < EYE_Z + 0.035
        if (c.z > EYE_Z + 0.062 or (c.z > EYE_Z - 0.06 and c.y > 0.025)) and not ear and c.z > 1.62:
            poly.material_index = idx


paint_hair()

# ---------------------------------------------------------------- neon line on the skin

NEON = {}   # frame -> neon line points (world), recorded as the pose is solved


def neon_points():
    """The line of force from the bar to the floor: hand -> elbow -> shoulder -> spine -> hip -> knee -> ankle."""
    m = RIG.matrix_world
    h = lambda n: m @ pb[n].head
    return [h("DEF-hand.L"), h("DEF-forearm.L"), h("DEF-upper_arm.L"), h("DEF-spine.003"), h("DEF-spine.001"),
            h("DEF-thigh.L"), h("DEF-shin.L"), h("DEF-foot.L")]


def build_neon_line(cam):
    """One glowing curve through the recorded skeleton points, keyed per frame. It sits inside the body;
    the "NeonLine" render layer (see line_layers) shows it through the body but behind the barbell."""
    if PAL["neon_line_strength"] <= 0 or not NEON:
        return
    mat = bpy.data.materials.new("Neon_Line")
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(n)
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = srgb(PAL["neon_line"])
    em.inputs["Strength"].default_value = PAL["neon_line_strength"]
    nt.links.new(em.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
    first = NEON[min(NEON)]
    cu = bpy.data.curves.new("Neon_Line", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth, cu.bevel_resolution = PAL["neon_line_radius"], 3
    sp = cu.splines.new("POLY")
    sp.points.add(len(first) - 1)
    ob = bpy.data.objects.new("Neon_Line", cu)
    bpy.context.scene.collection.objects.link(ob)
    ob.data.materials.append(mat)
    for f, pts in sorted(NEON.items()):
        for pt, q in zip(sp.points, pts):
            pt.co = (*q, 1.0)
            if len(NEON) > 1:
                pt.keyframe_insert("co", frame=f)



# ---------------------------------------------------------------- pose

pb = RIG.pose.bones
for side in ("L", "R"):
    for limb in ("upper_arm_parent", "thigh_parent"):
        b = pb[f"{limb}.{side}"]
        b["IK_FK"], b["IK_Stretch"], b["pole_vector"] = 0.0, 0.0, True
    pb[f"upper_arm_parent.{side}"]["IK_FK"] = 1.0       # arms in FK: true lengths (see arm_fk)

# ================================================================ DEADLIFT: pose, set, animation
# World frame: x lateral (L = +x), y front-back (the lifter faces -y), z up, floor at z = 0.
RGW = RIG.matrix_world
rx4 = lambda deg: Matrix.Rotation(math.radians(deg), 4, "X")
ry4 = lambda deg: Matrix.Rotation(math.radians(deg), 4, "Y")
X_AXIS = Vector((1.0, 0.0, 0.0))
BAR_R = 0.0145
PLATE_R = 0.225
GRIP = float(next((a.split("=")[1] for a in argv if a.startswith("grip=")), "0.27"))     # half grip, m (outside the thighs)
WRIST_EXT = 0.0
PALM_Y = 0.07
FINGER_R = 0.025
HAND_UP = Vector((0.0, 0.0, -1.0))       # fingers point down (named HAND_UP for the shared helpers)
PALM_N = Vector((0.0, 1.0, 0.0))         # palm faces the legs: the bar is between the palm and the thighs
for side in ("L", "R"):
    pb[f"thigh_parent.{side}"]["IK_FK"] = 1.0
bpy.context.view_layer.update()
wb = lambda n: RGW @ pb[n].head
HIP0 = (wb("thigh_parent.L") + wb("thigh_parent.R")) / 2
ANK = {s: RGW @ pb[f"ORG-foot.{s}"].head for s in ("L", "R")}
L1 = RIG.data.bones["ORG-thigh.L"].length
L2 = RIG.data.bones["ORG-shin.L"].length
SH0 = (wb("ORG-upper_arm.L") + wb("ORG-upper_arm.R")) / 2
SHL0 = wb("ORG-upper_arm.L")
SHR0 = wb("ORG-upper_arm.R")
ARM_LEN = RIG.data.bones["ORG-upper_arm.L"].length + RIG.data.bones["ORG-forearm.L"].length
_rest = [BODY.matrix_world @ v.co for v in BODY.data.vertices]
FOOT_IDX = [i for i, p in enumerate(_rest) if p.z < 0.12]
LEG_IDX = [i for i, p in enumerate(_rest) if p.z < 1.0 and abs(p.x) < 0.24 and p.z > 0.12]
foot_y = [_rest[i].y for i in FOOT_IDX]
MIDFOOT_Y, TOE_Y = (min(foot_y) + max(foot_y)) / 2, min(foot_y)
STANCE = float(next((a.split("=")[1] for a in argv if a.startswith("stance=")), "0.13"))
A_T = {"L": Vector((STANCE, ANK["L"].y, ANK["L"].z)), "R": Vector((-STANCE, ANK["R"].y, ANK["R"].z))}
THIGH_FRONT = min(_rest[i].y for i in LEG_IDX if 0.65 < _rest[i].z < 0.9)
print("MEASURE", dict(hip=[round(v, 3) for v in HIP0], sh=[round(v, 3) for v in SH0], arm=round(ARM_LEN, 3),
                      l1=round(L1, 3), l2=round(L2, 3), midfoot_y=round(MIDFOOT_Y, 3), thigh_front=round(THIGH_FRONT, 3)))

def body_world_np():
    import numpy as np
    ev = BODY.evaluated_get(bpy.context.evaluated_depsgraph_get())
    me = ev.to_mesh()
    co = np.empty(len(me.vertices) * 3, dtype=np.float32)
    me.vertices.foreach_get("co", co)
    ev.to_mesh_clear()
    m = np.array(BODY.matrix_world)
    return co.reshape(-1, 3) @ m[:3, :3].T + m[:3, 3]


def reset(names):
    for n in names:
        b = pb[n]
        b.location, b.scale = (0, 0, 0), (1, 1, 1)
        b.rotation_quaternion, b.rotation_euler = (1, 0, 0, 0), (0, 0, 0)
    bpy.context.view_layer.update()


def move_bone(name, world):
    b = pb[name]
    b.matrix = world @ b.matrix
    bpy.context.view_layer.update()


def rotate_about(name, axis, angle):
    b = pb[name]
    h = RGW @ b.head
    b.matrix = Matrix.Translation(h) @ Matrix.Rotation(angle, 4, axis) @ Matrix.Translation(-h) @ b.matrix
    bpy.context.view_layer.update()


def aim_bone(name, target):
    b = pb[name]
    m = RGW.inverted()
    cur = (b.tail - b.head).normalized()
    want = (m @ target - b.head).normalized()
    q = cur.rotation_difference(want).to_matrix().to_4x4()
    h = b.head.copy()
    b.matrix = Matrix.Translation(h) @ q @ Matrix.Translation(-h) @ b.matrix
    bpy.context.view_layer.update()


# --- arms: solved once (the bar is rigid on the back, so the arms are rigid with the trunk)
PALM, BASE = {}, {}
HAND_UP = Vector((0.0, 0.0, 1.0))


def find_palm():
    for side in ("L", "R"):
        b = RIG.data.bones[f"DEF-hand.{side}"]
        inv = (RGW @ b.matrix_local).inverted()
        gi = BODY.vertex_groups[f"DEF-hand.{side}"].index
        pts = [inv @ (BODY.matrix_world @ v.co) for v in BODY.data.vertices
               if any(g.group == gi and g.weight > 0.6 for g in v.groups)]
        sign = 1.0 if (inv.to_3x3() @ Vector((0.0, 0.0, -1.0))).x > 0 else -1.0
        z_mid = (min(q.z for q in pts) + max(q.z for q in pts)) / 2
        band = [q for q in pts if abs(q.y - PALM_Y) < 0.012 and abs(q.z - z_mid) < 0.025]
        x_palm = sign * max(sign * q.x for q in band)
        PALM[side] = (Vector((x_palm, PALM_Y, z_mid)), Vector((sign, 0.0, 0.0)))
        rest = (RGW @ RIG.data.bones[f"hand_ik.{side}"].matrix_local).to_3x3()
        y_r = rest.col[1].normalized()
        n_r = ((RGW @ b.matrix_local).to_3x3() @ Vector((sign, 0.0, 0.0))).normalized()
        n_r = (n_r - y_r * n_r.dot(y_r)).normalized()
        src = Matrix((y_r, n_r, y_r.cross(n_r))).transposed()
        y_d, n_d = HAND_UP, PALM_N
        dst = Matrix((y_d, n_d, y_d.cross(n_d))).transposed()
        BASE[side] = dst @ src.transposed()


def bone_world(name):
    return RGW @ pb[name].matrix


def bar_contact(side):
    m = bone_world(f"DEF-hand.{side}")
    pt, nrm = PALM[side]
    return m @ pt + (m.to_3x3() @ nrm).normalized() * BAR_R


def forearm_line(side):
    a = RGW @ pb[f"DEF-forearm.{side}"].head
    b = RGW @ pb[f"DEF-hand.{side}"].head
    return a, (b - a).normalized()


def dist_to_line(p, a, d):
    v = p - a
    return (v - d * v.dot(d)).length


def set_limb(name, head, tail, hinge):
    y = (tail - head).normalized()
    x = (hinge - y * hinge.dot(y)).normalized()
    z = x.cross(y)
    m = RGW.inverted()
    rot = m.to_3x3() @ Matrix((x, y, z)).transposed()
    pb[name].matrix = Matrix.Translation(m @ head) @ rot.to_4x4()
    bpy.context.view_layer.update()


def hinge_signs():
    out = {}
    for side in ("L", "R"):
        up, fo = RIG.data.bones[f"upper_arm_fk.{side}"], RIG.data.bones[f"forearm_fk.{side}"]
        yu = (up.tail_local - up.head_local).normalized()
        yf = (fo.tail_local - fo.head_local).normalized()
        bend = yu.cross(yf)
        xu = up.matrix_local.to_3x3().col[0]
        out[side] = 1.0 if bend.length < 1e-4 or bend.dot(xu) >= 0 else -1.0
    return out


def arm_fk(side, wrist, elbow_hint, rot):
    sh = RGW @ pb[f"ORG-upper_arm.{side}"].head
    l1, l2 = pb[f"ORG-upper_arm.{side}"].bone.length, pb[f"ORG-forearm.{side}"].bone.length
    v = wrist - sh
    d = min(v.length, (l1 + l2) * 0.995)
    u = v.normalized()
    a = (l1 ** 2 - l2 ** 2 + d ** 2) / (2 * d)
    hgt = math.sqrt(max(l1 ** 2 - a ** 2, 0.0))
    pole = elbow_hint - sh
    pole = (pole - u * pole.dot(u)).normalized()
    elbow, wr = sh + u * a + pole * hgt, sh + u * d
    hinge = u.cross(pole).normalized() * -ELBOW_HINGE_SIGN[side]
    set_limb(f"upper_arm_fk.{side}", sh, elbow, hinge)
    set_limb(f"forearm_fk.{side}", elbow, wr, hinge)
    hb = pb[f"hand_fk.{side}"]
    ik_rest = RIG.data.bones[f"hand_ik.{side}"].matrix_local.to_3x3()
    hb.matrix = Matrix.Translation(hb.matrix.translation) @ (rot @ ik_rest).to_4x4()
    bpy.context.view_layer.update()


ELBOW_OUT = float(next((a.split("=")[1] for a in argv if a.startswith("elbow=")), "0.04"))   # elbow flare, m
ELBOW_BACK = float(next((a.split("=")[1] for a in argv if a.startswith("eback=")), "0.30"))


def solve_side(side, s, bar, trunk):
    """Hand on the bar: palm (facing forward) on its back, wrist tipped back WRIST_EXT, elbow down and behind."""
    sh = RGW @ pb[f"ORG-upper_arm.{side}"].head
    hint = sh + trunk.to_3x3() @ Vector((ELBOW_OUT * s, ELBOW_BACK, -0.30))
    wrist = bar.copy()
    arm_fk(side, wrist, hint, BASE[side])
    for _ in range(10):
        a, d = forearm_line(side)
        fore = Matrix.Rotation(-math.radians(WRIST_EXT), 3, "X") @ d
        fore = (fore - X_AXIS * fore.dot(X_AXIS)).normalized()
        rot = HAND_UP.rotation_difference(fore).to_matrix() @ BASE[side]
        arm_fk(side, wrist, hint, rot)
        wrist = wrist + (bar - bar_contact(side))
        arm_fk(side, wrist, hint, rot)
        if DEBUG:
            hd = (bone_world(f"DEF-hand.{side}").to_3x3() @ Vector((0, 1, 0))).normalized()
            print("ARMIT", side, _, "fore", [round(x, 2) for x in d], "want", [round(x, 2) for x in fore], "hand", [round(x, 2) for x in hd],
                  "err_cm", round((bar - bar_contact(side)).length * 100, 2))


def wrap_fingers(bar_pts):
    for side, s in (("L", 1), ("R", -1)):
        bar = bar_pts[side]
        dist = lambda q: dist_to_line(q, bar, X_AXIS)
        for f in ("f_index", "f_middle", "f_ring", "f_pinky", "thumb"):
            for k in (1, 2, 3):
                ctrl = pb[f"{f}.0{k}.{side}"]
                d = pb[f"DEF-{f}.0{k + 1}.{side}"] if k < 3 else None
                tip = (lambda: RGW @ d.head) if d else (lambda: RGW @ pb[f"DEF-{f}.03.{side}"].tail)
                axes = ("X", "Z") if (f == "thumb" and k == 1) else ("X",)
                best = None
                for ang in range(-20 if f == "thumb" else 0, 125, 5):
                    for ang2 in (range(-40, 45, 10) if len(axes) == 2 else (0,)):
                        q = Matrix.Rotation(math.radians(ang), 3, "X")
                        if len(axes) == 2:
                            q = Matrix.Rotation(math.radians(ang2), 3, "Z") @ q
                        ctrl.rotation_quaternion = q.to_quaternion()
                        bpy.context.view_layer.update()
                        r = dist(tip())
                        e = abs(r - FINGER_R) + 3 * max(0.0, FINGER_R - 0.006 - r)
                        if best is None or e < best[0]:
                            best = (e, q.to_quaternion())
                ctrl.rotation_quaternion = best[1]
                bpy.context.view_layer.update()


# --- the movement: depth 0 standing lockout, 1 the bar on the floor
ss_ = lambda u: u * u * (3 - 2 * u)
TH_TOP, TH_BOT = float(next((a.split("=")[1] for a in argv if a.startswith("lean0=")), "2.0")), float(next((a.split("=")[1] for a in argv if a.startswith("lean1=")), "62.0"))
HY_TOP, HY_BOT = -0.02, float(next((a.split("=")[1] for a in argv if a.startswith("hipback=")), "0.20"))   # hip y relative to the ankles
TILT_DEG = float(next((a.split("=")[1] for a in argv if a.startswith("tilt=")), "1.2"))
BAR_Y_FLOOR = MIDFOOT_Y - float(next((a.split("=")[1] for a in argv if a.startswith("barfwd=")), "0.03"))
BAR_Y_TOP = THIGH_FRONT - BAR_R + 0.004
KNEE_CLEAR = float(next((a.split("=")[1] for a in argv if a.startswith("kneeclear=")), "0.035"))
PR = 0.076                                              # bar centre beyond the wrist along the hand (palm + bar radius)
LEG_MOVERS = [f"{n}.{s}" for n in ("thigh_fk", "shin_fk", "foot_fk") for s in ("L", "R")]
SPINE_MOVERS = ["torso", "neck", "head"]
AY = (A_T["L"].y + A_T["R"].y) / 2
AZ = A_T["L"].z
HIPX = abs(wb("thigh_parent.L").x)
SHX = abs(wb("ORG-upper_arm.L").x)
LAT = abs(A_T["L"].x) - HIPX


def max_hip_z(hy):
    """Highest the hips can be above the ankles with the legs at 99.2% of their length (a straight, unlocked knee)."""
    reach = (L1 + L2) * 0.992
    return AZ + math.sqrt(max(reach ** 2 - LAT ** 2 - (hy - AY) ** 2, 0.0))


def trunk_T(h, th, roll=0.0):
    return Matrix.Translation(h) @ ry4(roll) @ Matrix.Rotation(th, 4, "X") @ Matrix.Translation(-HIP0)


BAR_EXTRA = [float(next((a.split("=")[1] for a in argv if a.startswith("hipx=")), "0"))]   # per-frame extra hip setback (m), found by a first pass: moving the hips back takes the knees off the bar (moving the bar out does not: the knees follow it)


def bar_path(d, z_top):
    """Where the bar centre is for depth d: over mid-foot at the floor, sliding up the shins and thighs."""
    g = ss_(min(max(d, 0.0), 1.0))
    z = z_top + (PLATE_R - z_top) * g
    yk = ss_(min(max((0.40 - d) / 0.40, 0.0), 1.0))     # moves in to the thighs only in the top 40% of the pull
    y = BAR_Y_FLOOR + (BAR_Y_TOP - BAR_Y_FLOOR) * yk - KNEE_CLEAR * math.sin(math.pi * min(max(d, 0.0), 1.0)) ** 2   # a little further out while it passes the knees
    return Vector((0.0, y, z))


O0 = Vector((0.0, 0.0, -PR))          # bar centre relative to the wrist when the hand points straight down (measured on the floor)


def need_reach(shL, barL):
    """Straight-arm reach needed from the shoulder to put the bar in the palm: the bar sits at a fixed offset in the
    hand's frame, and the hand turns with the arm, so the offset is rotated to the arm's direction."""
    u = HAND_UP.copy()
    for _ in range(8):
        o = HAND_UP.rotation_difference(u).to_matrix() @ O0
        u = (barL - o - shL).normalized()
    o = HAND_UP.rotation_difference(u).to_matrix() @ O0
    return (barL - o - shL).length


HOLD_FROM = float(next((a.split("=")[1] for a in argv if a.startswith("hold=")), "0.6"))


def hips_for(d, bar):
    """Hip centre for depth d: trunk lean and hip setback follow the depth; the hip height is the one value
    that puts the straight arms from the shoulders exactly onto the bar."""
    k = ss_(min(max(d / HOLD_FROM, 0.0), 1.0))          # back angle holds off the floor (knees straighten first), then the hips come through
    th = math.radians(TH_TOP + (TH_BOT - TH_TOP) * k)
    hy = AY + HY_TOP + (HY_BOT - HY_TOP) * k + BAR_EXTRA[0]
    a = math.radians(tilt_of(d))
    barL = bar + Vector((GRIP * math.cos(a), 0, -GRIP * math.sin(a)))
    barRm = bar + Vector((GRIP * math.cos(a), 0, GRIP * math.sin(a)))      # right grip, mirrored into the left arm's frame
    lo, hi = 0.15, 1.2
    for _ in range(40):
        zh = (lo + hi) / 2
        T = trunk_T(Vector((0.0, hy, zh)), th, tilt_of(d))
        shL = T @ SHL0
        shR = T @ SHR0
        if max(need_reach(shL, barL), need_reach(Vector((-shR.x, shR.y, shR.z)), barRm)) > ARM_LEN * 0.99:
            hi = zh                                      # shoulders too far from the bar: lower the hips
        else:
            lo = zh
    zh = (lo + hi) / 2
    return Vector((0.0, hy, zh)), th


def solve_top():
    """Top of the lift: legs straight, trunk near upright; the bar hangs from the straight arms."""
    hy = AY + HY_TOP
    T = trunk_T(Vector((0.0, hy, max_hip_z(hy))), math.radians(TH_TOP))
    shL = T @ SHL0
    lo, hi = 0.2, 1.4
    for _ in range(40):
        z = (lo + hi) / 2
        if need_reach(shL, Vector((GRIP, BAR_Y_TOP, z))) > ARM_LEN * 0.99:
            lo = z                                       # bar too far below the shoulders: raise it
        else:
            hi = z
    return (lo + hi) / 2


Z_TOP = solve_top()
print("TOP bar z", round(Z_TOP, 3), "hip z", round(max_hip_z(AY + HY_TOP), 3))



def pose_body(d, bar, roll=0.0):
    """Legs, trunk and head for depth d (arms are solved separately)."""
    reset(SPINE_MOVERS + LEG_MOVERS)
    h, th = hips_for(d, bar)
    T = trunk_T(h, th, roll if roll else tilt_of(d))      # shoulders follow the bar's tilt, so both arms stay straight
    move_bone("torso", T)
    rotate_about("neck", X_AXIS, -0.45 * th)             # eyes stay forward-down, neck in line with the spine
    rotate_about("head", X_AXIS, -0.3 * th)
    for side, s in (("L", 1), ("R", -1)):
        hip = RGW @ pb[f"ORG-thigh.{side}"].head
        v = A_T[side] - hip
        dd = min(v.length, (L1 + L2) * 0.998)
        u = v.normalized()
        a = (L1 ** 2 - L2 ** 2 + dd ** 2) / (2 * dd)
        hgt = math.sqrt(max(L1 ** 2 - a ** 2, 0.0))
        pole = Vector((0.18 * s, -1.0, 0.0))
        pole = (pole - u * pole.dot(u)).normalized()
        aim_bone(f"thigh_fk.{side}", hip + u * a + pole * hgt)
        aim_bone(f"shin_fk.{side}", hip + u * dd)
        b = pb[f"foot_fk.{side}"]
        b.matrix = Matrix.Translation(b.matrix.translation) @ b.bone.matrix_local.to_3x3().to_4x4()
        bpy.context.view_layer.update()
    return T, th


def grip_pts(bar, tilt_deg):
    r = ry4(tilt_deg).to_3x3()
    return {"L": bar + r @ Vector((GRIP, 0, 0)), "R": bar + r @ Vector((-GRIP, 0, 0))}


ROLL_SIGN = {}


def solve_side(side, s, bar):
    """Straight arm down to the bar: palm toward the legs, bar in the palm; elbow guide out and back."""
    sh = RGW @ pb[f"ORG-upper_arm.{side}"].head
    hint = sh + Vector((0.30 * s, 0.12, 0.0))
    wrist = bar + Vector((0.0, 0.0, PR))
    arm_fk(side, wrist, hint, BASE[side])
    for _ in range(14):
        a, dv = forearm_line(side)
        rot = HAND_UP.rotation_difference(dv).to_matrix() @ BASE[side]
        arm_fk(side, wrist, hint, rot)
        # roll the hand about the arm so its finger row lies along the bar (world X): the fingers then wrap square
        u = dv.normalized()
        zx = bone_world(f"DEF-hand.{side}").to_3x3() @ Vector((0.0, 0.0, 1.0))
        zp = zx - u * zx.dot(u)
        xs = X_AXIS - u * X_AXIS.dot(u)
        ROLL_SIGN.setdefault(side, 1.0 if zp.dot(xs) >= 0 else -1.0)      # fixed at the first solve: no flip between frames
        xs = xs * ROLL_SIGN[side]
        ang = math.atan2(u.dot(zp.cross(xs)), zp.dot(xs))
        rot = Matrix.Rotation(ang, 3, u) @ rot
        arm_fk(side, wrist, hint, rot)
        wrist = wrist + (bar - bar_contact(side))
        arm_fk(side, wrist, hint, rot)
        if DEBUG:
            print("ARMIT", side, _, "err_cm", round((bar - bar_contact(side)).length * 100, 2))


def pose_arms(bar, tilt_deg):
    g = grip_pts(bar, tilt_deg)
    for side, s in (("L", 1), ("R", -1)):
        solve_side(side, s, g[side])


def wrap_fingers(bar_pts):
    for side, s in (("L", 1), ("R", -1)):
        bar = bar_pts[side]
        dist = lambda q: dist_to_line(q, bar, X_AXIS)
        for f in ("f_index", "f_middle", "f_ring", "f_pinky", "thumb"):
            for k in (1, 2, 3):
                ctrl = pb[f"{f}.0{k}.{side}"]
                d_ = pb[f"DEF-{f}.0{k + 1}.{side}"] if k < 3 else None
                tip = (lambda: RGW @ d_.head) if d_ else (lambda: RGW @ pb[f"DEF-{f}.03.{side}"].tail)
                axes = ("X", "Z") if (f == "thumb" and k == 1) else ("X",)
                best = None
                for ang in range(-20 if f == "thumb" else 0, 125, 5):
                    for ang2 in (range(-40, 45, 10) if len(axes) == 2 else (0,)):
                        q = Matrix.Rotation(math.radians(ang), 3, "X")
                        if len(axes) == 2:
                            q = Matrix.Rotation(math.radians(ang2), 3, "Z") @ q
                        ctrl.rotation_quaternion = q.to_quaternion()
                        bpy.context.view_layer.update()
                        r = dist(tip())
                        e = abs(r - FINGER_R) + 3 * max(0.0, FINGER_R - 0.006 - r)
                        if best is None or e < best[0]:
                            best = (e, q.to_quaternion())
                ctrl.rotation_quaternion = best[1]
                bpy.context.view_layer.update()


def tilt_of(d):
    """Natural variation (nothing perfectly level): the bar tilts about a degree while it travels, zero on the floor
    and at the top so the loop closes seamlessly."""
    return TILT_DEG * math.sin(math.pi * d) ** 2


find_palm()
ELBOW_HINGE_SIGN = hinge_signs()
# solve the arms once on the floor to find the grip, measure the hand's offset to the bar, wrap the fingers
bar1 = bar_path(1.0, Z_TOP)
pose_body(1.0, bar1)
pose_arms(bar1, 0.0)
_wl = RGW @ pb["DEF-hand.L"].head
_a, _dv = forearm_line("L")
O0 = _dv.rotation_difference(HAND_UP).to_matrix() @ ((bar1 + Vector((GRIP, 0, 0))) - _wl)
print("HAND offset O0", [round(v, 3) for v in O0])
Z_TOP = solve_top()
print("TOP bar z", round(Z_TOP, 3))
bar1 = bar_path(1.0, Z_TOP)
pose_body(1.0, bar1)
pose_arms(bar1, 0.0)
wrap_fingers(grip_pts(bar1, 0.0))
for _ in range(3):                                      # soles flat on the floor
    pose_body(1.0, bar1)
    g = float(body_world_np()[FOOT_IDX][:, 2].min())
    if abs(g) < 0.0008:
        break
    for sd in A_T:
        A_T[sd].z -= g
pose_body(1.0, bar1)
pose_arms(bar1, 0.0)
print("FLOOR hips", [round(v, 3) for v in hips_for(1.0, bar1)[0]], "lean", round(math.degrees(hips_for(1.0, bar1)[1]), 1))


def joint_flex(side, joint):
    a, b, c = (("ORG-upper_arm", "ORG-forearm", "ORG-hand") if joint == "elbow" else ("ORG-thigh", "ORG-shin", "ORG-foot"))
    p1, p2, p3 = (RGW @ pb[f"{n}.{side}"].head for n in (a, b, c))
    return math.degrees((p2 - p1).angle(p3 - p2))


def max_stretch():
    worst = (0.0, "")
    for b in pb:
        if b.name.startswith("ORG-") and b.bone.length > 0.02 and not any(
                k in b.name for k in ("face", "lip", "lid", "brow", "cheek", "jaw", "nose", "ear", "tongue",
                                      "teeth", "chin", "temple", "forehead", "eye", "heel", "palm", "breast")):
            dd = abs((b.tail - b.head).length / b.bone.length - 1) * 100
            if dd > worst[0]:
                worst = (dd, b.name)
    return worst


def physics_check(bar, d, tilt_deg):
    """Gravity, bar path, joint and grip rules for a conventional deadlift."""
    import numpy as np
    out, fails = {}, []
    co = body_world_np()
    foot_gap = float(co[FOOT_IDX][:, 2].min()) * 100
    out["foot_gap_cm"] = round(foot_gap, 2)
    if foot_gap > 0.5 or foot_gap < -1.5:
        fails.append(f"feet {'floating' if foot_gap > 0.5 else 'sunk'} ({foot_gap:.2f} cm)")
    if d > 0.999 and abs(bar.z - PLATE_R) > 0.004:
        fails.append("bar not resting on the floor at the start")
    # the bar does not pass through the legs: distance from the bar axis to the leg skin
    pts = co[LEG_IDX]
    v = pts - np.array(bar)
    dist = np.linalg.norm(v - np.outer(v @ np.array(X_AXIS), np.array(X_AXIS)), axis=1)
    gap = (float(dist.min()) - BAR_R) * 100
    out["bar_leg_gap_cm"] = round(gap, 2)
    if DEBUG:
        j = int(dist.argmin()); r = _rest[LEG_IDX[j]]
        print("GAPDBG nearest vertex rest", [round(r.x, 3), round(r.y, 3), round(r.z, 3)], "world", [round(float(c), 3) for c in pts[j]], "bar", [round(c, 3) for c in bar])
    if gap < -0.8:
        fails.append(f"bar passes through the legs ({gap:.2f} cm)")
    if d < 0.02 and gap > 2.5:
        fails.append(f"bar not against the thighs at lockout ({gap:.2f} cm)")
    for side in ("L", "R"):
        for joint, lo, hi in (("elbow", 0.0, 25.0), ("knee", 0.0, 150.0)):
            f = joint_flex(side, joint)
            out.setdefault("joints_deg", {})[f"{joint}.{side}"] = round(f, 1)
            if not lo <= f <= hi:
                fails.append(f"{joint}.{side} out of range ({f:.1f} deg)")
        if d < 0.02 and joint_flex(side, "knee") > 25.0:
            fails.append(f"knee.{side} not extended at lockout ({joint_flex(side, 'knee'):.1f} deg)")
        g = grip_pts(bar, tilt_deg)[side]
        seat = (g - bar_contact(side)).length * 100
        a, dv = forearm_line(side)
        flat = lambda q: (q - X_AXIS * q.dot(X_AXIS))
        hand_dir = (bone_world(f"DEF-hand.{side}").to_3x3() @ Vector((0, 1, 0))).normalized()
        wrist = math.degrees(flat(dv).normalized().angle(flat(hand_dir).normalized()))
        gp = lambda f_: max(abs(dist_to_line(RGW @ q, g, X_AXIS) - FINGER_R) * 100
                            for q in (pb[f"DEF-{f_}.03.{side}"].head, pb[f"DEF-{f_}.03.{side}"].tail))
        wrap = max(gp(f_) for f_ in ("f_index", "f_middle", "f_ring", "f_pinky"))
        if DEBUG:
            print("FINGERS", side, {f_: round(gp(f_), 2) for f_ in ("f_index", "f_middle", "f_ring", "f_pinky", "thumb")})
        thumb = gp("thumb")
        out[side] = dict(seat_cm=round(seat, 2), wrist_deg=round(wrist, 1), finger_gap_cm=round(wrap, 2), thumb_gap_cm=round(thumb, 2))
        for name, ok in (("bar on palm", seat <= 0.7), ("wrist angle", wrist <= 32), ("fingers on bar", wrap <= 1.0), ("thumb round bar", thumb <= 2.0)):
            if not ok:
                fails.append(f"{side}: {name}")
    stretch, bone = max_stretch()
    out["max_bone_stretch_pct"] = round(stretch, 2)
    if stretch > 2.0:
        fails.append(f"{bone} stretched {stretch:.1f}%")
    out["fails"] = fails
    return out


# Tempo, 3 s loop: bar on the floor, pull, lockout hold, lower, touch the floor.
def rep(t):
    ease = lambda u: (1 - math.cos(math.pi * min(max(u, 0.0), 1.0))) / 2
    u = (t % SECONDS) / SECONDS
    if u < 0.08:
        return 1.0
    if u < 0.46:
        return 1 - ease((u - 0.08) / 0.38)
    if u < 0.58:
        return 0.0
    if u < 0.94:
        return ease((u - 0.58) / 0.36)
    return 1.0


TWIST_STEP_MAX, TWIST_JERK_MAX = 4.0, 1.5
PREV_TWIST, PREV_STEP = {}, {}


def arm_twists():
    out = {}
    ref = Vector((0.0, -1.0, 0.0))
    for side in ("L", "R"):
        for n in (f"DEF-upper_arm.{side}", f"DEF-upper_arm.{side}.001", f"DEF-forearm.{side}",
                  f"DEF-forearm.{side}.001", f"DEF-hand.{side}"):
            m = (RGW @ pb[n].matrix).to_3x3()
            y, x = m.col[1].normalized(), m.col[0].normalized()
            r = (ref - y * ref.dot(y)).normalized()
            out[n] = math.degrees(math.atan2(y.dot(r.cross(x)), r.dot(x)))
    return out


def natural_motion_check(series):
    fails = []
    if DEBUG:
        print("SERIES", [(f, round(series[f]["knee"], 1), round(series[f]["lean"], 1), round(series[f]["tilt"], 2), round(series[f]["barz"], 3)) for f in sorted(series)])
    tilts = [series[f]["tilt"] for f in sorted(series)]
    if max(tilts) - min(tilts) < 0.4:
        fails.append("bar is perfectly level (no natural attitude variation)")
    if max(abs(t) for t in tilts) > 4.0:
        fails.append("bar tilts more than 4 deg")
    for key, step_max, jerk_max in (("tilt", 0.35, 0.2), ("knee", 8.0, 1.6), ("lean", 6.0, 1.3), ("barz", 0.02, 0.004)):
        v = [series[f][key] for f in sorted(series)]
        steps = [v[i + 1] - v[i] for i in range(len(v) - 1)] + [v[0] - v[-1]]
        if max(abs(x) for x in steps) > step_max:
            fails.append(f"{key} jumps {max(abs(x) for x in steps):.3f}/frame")
        jerk = [abs(steps[i] - steps[i - 1]) for i in range(len(steps))]
        if max(jerk) > jerk_max:
            fails.append(f"{key} twitch {max(jerk):.3f}/frame^2")
    return fails



# ---------------------------------------------------------------- set: platform, barbell
def box(name, lo, hi, mat, bevel=0.01):
    lo, hi = Vector(lo), Vector(hi)
    bpy.ops.mesh.primitive_cube_add(location=(lo + hi) / 2)
    ob = bpy.context.object
    ob.name = name
    ob.scale = (hi - lo) / 2
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = ob.modifiers.new("Bevel", "BEVEL")
        mod.width, mod.segments = bevel, 3
    ob.data.materials.append(mat)
    for poly in ob.data.polygons:
        poly.use_smooth = True
    return ob


def cylinder_x(name, cy, cz, x0, x1, r, mat, verts=48, bevel=0.004):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=abs(x1 - x0),
                                        location=((x0 + x1) / 2, cy, cz), rotation=(0, math.radians(90), 0))
    ob = bpy.context.object
    ob.name = name
    if bevel:
        mod = ob.modifiers.new("Bevel", "BEVEL")
        mod.width, mod.segments = bevel, 2
        mod.limit_method = "ANGLE"
    ob.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return ob


PAD = principled("Set_Pad", PAL["pad"], rough=0.45, sheen=0.2)
METAL = principled("Set_Metal", PAL["plate_hub"], rough=0.3)
METAL.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 0.8
DARKMETAL = principled("Set_DarkMetal", PAL["bar"], rough=0.3)
DARKMETAL.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 0.9
RUBBER = principled("Set_Rubber", PAL["rubber"], rough=0.65)
FLOOR = principled("Set_Floor", PAL["floor"], rough=0.9)
MAT = principled("Set_Mat", PAL["mat"], rough=0.8)
FRAME = principled("Set_Frame", PAL["frame"], rough=0.4)
FRAME.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = PAL["frame_metallic"]

box("Platform", (-1.25, AY - 0.85, -0.04), (1.25, AY + 0.85, 0.0), MAT, bevel=0.01)       # lifting platform, top at the floor
box("Platform_Wood", (-0.55, AY - 0.55, -0.0005), (0.55, AY + 0.55, 0.0), FRAME, bevel=0.0)  # (flush insert keeps the floor plane clean)

bar_parts = [cylinder_x("Bar_Shaft", 0.0, 0.0, -1.0, 1.0, BAR_R, DARKMETAL)]
for zs in (1, -1):
    bar_parts += [cylinder_x(f"Bar_Collar{zs}", 0.0, 0.0, 0.66 * zs, 0.70 * zs, 0.026, DARKMETAL),
                  cylinder_x(f"Bar_Plate{zs}", 0.0, 0.0, 0.705 * zs, 0.75 * zs, PLATE_R, RUBBER, verts=96, bevel=0.008),
                  cylinder_x(f"Bar_PlateHub{zs}", 0.0, 0.0, 0.70 * zs, 0.755 * zs, 0.05, METAL)]
BAR = bpy.data.objects.new("Bar", None)
bpy.context.scene.collection.objects.link(BAR)
BAR.rotation_mode = "QUATERNION"
bpy.context.view_layer.update()
for ob in bar_parts:
    ob.parent = BAR

FAILS, SERIES = [], {}
ARM_KEYS = [f"{n}.{s}" for n in ("upper_arm_fk", "forearm_fk", "hand_fk") for s in ("L", "R")]


def key_frame(f, bar, tilt_deg, d):
    BAR.location = bar
    BAR.rotation_quaternion = ry4(tilt_deg).to_quaternion()
    BAR.keyframe_insert("location", frame=f)
    BAR.keyframe_insert("rotation_quaternion", frame=f)
    for n in SPINE_MOVERS + LEG_MOVERS + ARM_KEYS:
        pb[n].keyframe_insert("location", frame=f)
        pb[n].keyframe_insert("rotation_quaternion", frame=f)
    glow = SKIN.node_tree.nodes["GlowPulse"].outputs[0]
    glow.default_value = 1.0 + PAL["glow_pulse"] * (0.4 + 0.6 * d)           # loaded hardest at the floor
    glow.keyframe_insert("default_value", frame=f)


EXTRA = {}


def solve_frame(f, d):
    BAR_EXTRA[0] = EXTRA.get(f, 0.0) if ANIM else BAR_EXTRA[0]
    bar = bar_path(d, Z_TOP)
    tilt = tilt_of(d)
    T, th = pose_body(d, bar)
    pose_arms(bar, tilt)
    chk = physics_check(bar, d, tilt)
    twists = arm_twists()
    if PREV_TWIST:
        steps = {n: ((twists[n] - PREV_TWIST[n] + 180) % 360) - 180 for n in twists}
        jerk = {n: abs(steps[n] - PREV_STEP.get(n, steps[n])) for n in steps}
        chk["fails"] += [f"{n} twist step {steps[n]:.1f} deg" for n in steps if abs(steps[n]) > TWIST_STEP_MAX] + \
                        [f"{n} twist jerk {jerk[n]:.1f} deg" for n in jerk if jerk[n] > TWIST_JERK_MAX]
        PREV_STEP.update(steps)
    PREV_TWIST.update(twists)
    SERIES[f] = dict(tilt=tilt, knee=joint_flex("L", "knee"), lean=math.degrees(th), barz=bar.z)
    return bar, tilt, chk


if ANIM:
    sc0 = bpy.context.scene
    sc0.render.fps = FPS
    sc0.frame_start, sc0.frame_end = 1, int(FPS * SECONDS)
    NF = sc0.frame_end
    gaps = {}
    for f in (range(1, NF + 1) if "adapt" in argv else ()):     # opt-in: 2026-11-01 the setback made the floor frames worse                     # pass 1: where does the bar press into the legs?
        gaps[f] = solve_frame(f, rep((f - 1) / FPS))[2].get("bar_leg_gap_cm", 1.0)
    need = [0.0] * NF if not gaps else [min(0.06, 1.5 * max(0.0, 0.30 - gaps[f]) / 100.0) for f in range(1, NF + 1)]
    dil = [max(need[(i + k) % NF] for k in range(-4, 5)) for i in range(NF)]       # widen, then smooth: the bar glides, never jerks
    smooth = [sum(dil[(i + k) % NF] for k in range(-2, 3)) / 5.0 for i in range(NF)]
    EXTRA.update({i + 1: smooth[i] for i in range(NF)})
    print("CLEARANCE extra cm max", round(max(smooth) * 100, 2))
    PREV_TWIST.clear(); PREV_STEP.clear(); SERIES.clear()
    for f in range(sc0.frame_start, sc0.frame_end + 1):
        sc0.frame_set(f)
        d = rep((f - 1) / FPS)
        bar, tilt, chk = solve_frame(f, d)
        if chk["fails"]:
            FAILS.append((f, chk))
        key_frame(f, bar, tilt, d)
        NEON[f] = neon_points()
    nm = natural_motion_check(SERIES)
    if nm:
        FAILS.append(("motion", {"fails": nm}))
    if CHECK_ONLY:
        OUT.mkdir(parents=True, exist_ok=True)
        lines = [f"frame {f}: {c['fails']} bar_leg_gap={c.get('bar_leg_gap_cm')} joints={c.get('joints_deg')}" if f != "motion" else f"motion: {c['fails']}" for f, c in FAILS]
        (OUT / "physics_report.txt").write_text("\n".join(lines) + "\n" if lines else "all 72 frames pass the grip, arm, gravity, proportion and smoothness rules\n")
        print("CHECK-ONLY", "FAILED on %d entries" % len(FAILS) if FAILS else "PASSED")
        raise SystemExit(1 if FAILS else 0)
else:
    bar, tilt, chk = solve_frame(1, P)
    print("PHYSICS", chk)
    BAR.location = bar
    BAR.rotation_quaternion = ry4(tilt).to_quaternion()
    SKIN.node_tree.nodes["GlowPulse"].outputs[0].default_value = 1.0 + PAL["glow_pulse"]
bpy.context.view_layer.update()

bpy.ops.mesh.primitive_plane_add(size=14, location=(0, 0, -0.041))
bpy.context.object.name = "Floor"
bpy.context.object.data.materials.append(FLOOR)

# ---------------------------------------------------------------- light
for ob in [o for o in bpy.data.objects if o.type == "LIGHT"]:
    bpy.data.objects.remove(ob, do_unlink=True)


def area(name, direction, dist, size, energy, color="#ffffff"):
    d_ = Vector(direction).normalized()
    target = Vector((0.0, AY, 0.85))
    lamp = bpy.data.lights.new(name, "AREA")
    lamp.shape, lamp.size, lamp.energy, lamp.color = "DISK", size, energy, srgb(color)[:3]
    ob = bpy.data.objects.new(name, lamp)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = target + d_ * dist
    ob.rotation_euler = (-d_).to_track_quat("-Z", "Y").to_euler()


# The camera sees him from behind-left (back and hamstrings are the worked muscles): key from the camera side,
# cool rim lights from the front, behind him as the camera sees it.
area("Key", (0.55, 0.75, 0.75), 4.0, 3.0, PAL["key_light_energy"], PAL["key_light"])
area("Fill", (-0.8, 0.6, 0.35), 4.0, 4.0, PAL["fill_light_energy"], PAL["fill_light"])
area("Rim", (-0.5, -0.85, 0.55), 4.0, 2.0, PAL["rim_light_energy"], PAL["rim_light"])
if PAL["mannequin"]:
    area("RimBack", (0.75, -0.75, 0.45), 4.0, 2.5, PAL["rim_light_energy"], PAL["rim_light"])
    area("RimHead", (-0.2, -0.3, 1.0), 4.0, 2.0, PAL["rim_light_energy"] * 0.6, PAL["rim_light"])

world = bpy.context.scene.world or bpy.data.worlds.new("World")
bpy.context.scene.world = world
world.use_nodes = True
wn = world.node_tree
for n in list(wn.nodes):
    if n.type != "OUTPUT_WORLD":
        wn.nodes.remove(n)
coord, sep, ramp = wn.nodes.new("ShaderNodeTexCoord"), wn.nodes.new("ShaderNodeSeparateXYZ"), wn.nodes.new("ShaderNodeValToRGB")
bg_cam, bg_amb = wn.nodes.new("ShaderNodeBackground"), wn.nodes.new("ShaderNodeBackground")
lp, mix = wn.nodes.new("ShaderNodeLightPath"), wn.nodes.new("ShaderNodeMixShader")
wn.links.new(coord.outputs["Window"], sep.inputs[0])
wn.links.new(sep.outputs["Y"], ramp.inputs["Fac"])
ramp.color_ramp.elements[0].color = srgb(PAL["background_bottom"])
ramp.color_ramp.elements[1].color = srgb(PAL["background_top"])
# Faint horizontal scan lines across the background.
lines, frac, step, lmix = (wn.nodes.new("ShaderNodeMath"), wn.nodes.new("ShaderNodeMath"),
                           wn.nodes.new("ShaderNodeMath"), wn.nodes.new("ShaderNodeMix"))
lines.operation, frac.operation, step.operation = "MULTIPLY", "FRACT", "GREATER_THAN"
lines.inputs[1].default_value, step.inputs[1].default_value = PAL["scanline_count"], 0.5
wn.links.new(sep.outputs["Y"], lines.inputs[0])
wn.links.new(lines.outputs[0], frac.inputs[0])
wn.links.new(frac.outputs[0], step.inputs[0])
fac = wn.nodes.new("ShaderNodeMath")
fac.operation = "MULTIPLY"
fac.inputs[1].default_value = PAL["scanline_strength"]
wn.links.new(step.outputs[0], fac.inputs[0])
lmix.data_type = "RGBA"
lmix.inputs["B"].default_value = srgb(PAL["scanline"])
wn.links.new(ramp.outputs["Color"], lmix.inputs["A"])
wn.links.new(fac.outputs[0], lmix.inputs["Factor"])
wn.links.new(lmix.outputs["Result"], bg_cam.inputs["Color"])
bg_amb.inputs["Color"].default_value = srgb(PAL["ambient"])
bg_amb.inputs["Strength"].default_value = PAL["ambient_strength"]
wn.links.new(lp.outputs["Is Camera Ray"], mix.inputs["Fac"])
wn.links.new(bg_amb.outputs[0], mix.inputs[1])
wn.links.new(bg_cam.outputs[0], mix.inputs[2])
wn.links.new(mix.outputs[0], wn.nodes["World Output"].inputs["Surface"])

# Camera: three-quarter from behind, from his left, a little above.
yaw = math.radians(float(next((a.split("=")[1] for a in argv if a.startswith("yaw=")), "128")))
pitch = math.radians(float(next((a.split("=")[1] for a in argv if a.startswith("pitch=")), "14")))
view = Vector((math.sin(yaw) * math.cos(pitch), -math.cos(yaw) * math.cos(pitch), math.sin(pitch)))
up = Vector((0, 0, 1))
zc = view
xc = up.cross(zc).normalized()
yc = zc.cross(xc)
cam_data = bpy.data.cameras.new("Cam")
cam_data.lens = 55
cam = bpy.data.objects.new("Cam", cam_data)
bpy.context.scene.collection.objects.link(cam)
if TILE:
    pts = []
    for dd in (0.0, 1.0):
        b_ = bar_path(dd, Z_TOP)
        pose_body(dd, b_)
        pose_arms(b_, 0.0)
        pts += [Vector(q) for q in body_world_np()[::40]]
        for zs in (-1, 1):
            for a in range(0, 360, 30):
                pts.append(Vector((0.75 * zs, b_.y + PLATE_R * math.cos(math.radians(a)), b_.z + PLATE_R * math.sin(math.radians(a)))))
    pts += [Vector((x, y, 0.0)) for x in (-0.3, 0.3) for y in (AY - 0.3, AY + 0.45)]
    pose_body(0.0, bar_path(0.0, Z_TOP))
    us = [p.dot(xc) for p in pts]
    vs = [p.dot(yc) for p in pts]
    centre = xc * (min(us) + max(us)) / 2 + yc * (min(vs) + max(vs)) / 2
    depth = sum(p.dot(zc) for p in pts) / len(pts)
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = max(max(us) - min(us), max(vs) - min(vs)) * 1.04
    cam.location = centre + zc * (depth + 8.0)
else:
    cam.location = Vector((0.0, AY, 0.85)) + view * 5.0

cam_data.clip_end = 40.0
cam.matrix_world = Matrix.Translation(cam.location) @ Matrix((xc, yc, zc)).transposed().to_4x4()
if not NEON:
    NEON[1] = neon_points()
bpy.context.view_layer.update()
build_neon_line(cam)
bpy.context.scene.camera = cam

sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x = sc.render.resolution_y = TILE_SPEC["render_size"]  # scaled down on export
if not TILE:
    sc.render.resolution_x, sc.render.resolution_y = 1920, 1080
sc.eevee.taa_render_samples = TILE_SPEC.get("samples", 64) if TILE else 64   # Matt: quality first; fewer samples made the glow shimmer
try:
    sc.eevee.use_raytracing = True
    sc.eevee.use_shadows = True
except AttributeError:
    pass
try:
    sc.view_settings.view_transform = PAL.get("view_transform", "AgX")   # neon: keeps glowing colours saturated
except TypeError:
    sc.view_settings.view_transform = "AgX"
for look in (PAL["look"], PAL["look"].replace("AgX - ", ""), "None"):   # look names differ per transform
    try:
        sc.view_settings.look = look
        break
    except TypeError:
        continue
def line_layers():
    """Physics for the neon line: it may show through the body, never through the barbell. A second
    render layer holds only the line and the barbell; the body is left out, so nothing of him hides the
    line, while the barbell is a holdout, so the line vanishes wherever the bar or plates are in front.
    The compositor lays that layer over the main image."""
    line = bpy.data.objects.get("Neon_Line")
    if line is None:
        return None
    master = sc.collection
    def coll(name):
        c = bpy.data.collections.new(name)
        master.children.link(c)
        return c
    bar_c, neon_c, set_c = coll("LIFT_Barbell"), coll("LIFT_Neon"), coll("LIFT_Set")
    bar_objs = {BAR} | set(BAR.children)
    for ob in list(master.objects):
        if ob.type in ("CAMERA", "LIGHT"):
            continue
        target = neon_c if ob == line else bar_c if ob in bar_objs else set_c
        master.objects.unlink(ob)
        target.objects.link(ob)
    main = sc.view_layers[0]
    main.layer_collection.children["LIFT_Neon"].exclude = True
    lyr = sc.view_layers.new("NeonLine")
    for lc in lyr.layer_collection.children:
        lc.exclude = lc.name not in ("LIFT_Neon", "LIFT_Barbell")
    lyr.layer_collection.children["LIFT_Barbell"].holdout = True
    if hasattr(lyr, "use_sky"):
        lyr.use_sky = False                             # no background: the line sits on black
    # Barbell mask: white copies of the barbell parts (same meshes, same animated parent), seen only by
    # the "BarMask" layer, to cut the line's glow off the bar. (EEVEE ignores per-layer material
    # overrides, so the copies carry the white material themselves.)
    white = bpy.data.materials.new("Mask_White")
    white.use_nodes = True
    wn_ = white.node_tree
    for n in list(wn_.nodes):
        if n.type != "OUTPUT_MATERIAL":
            wn_.nodes.remove(n)
    em = wn_.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    wn_.links.new(em.outputs[0], wn_.nodes["Material Output"].inputs["Surface"])
    mask_c = coll("LIFT_BarMask")
    mask_c.objects.link(BAR)                            # the animated parent, in this layer too
    for ob in BAR.children:
        dup = ob.copy()
        mask_c.objects.link(dup)
        for slot in dup.material_slots:
            slot.link, slot.material = "OBJECT", white
    main.layer_collection.children["LIFT_BarMask"].exclude = True
    lyr.layer_collection.children["LIFT_BarMask"].exclude = True
    mask = sc.view_layers.new("BarMask")
    for lc in mask.layer_collection.children:
        lc.exclude = lc.name != "LIFT_BarMask"
    if hasattr(mask, "use_sky"):
        mask.use_sky = False
    return main.name, lyr.name, mask.name


LAYERS = None if "nolayers" in argv else line_layers()
if PAL["bloom"] or LAYERS:
    try:
        tree = bpy.data.node_groups.new("LIFT_Compositor", "CompositorNodeTree")
        sc.compositing_node_group = tree
        out = tree.nodes.new("NodeGroupOutput")
        tree.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")

        def mix(blend, a, b):
            """Colour mix node (MixRGB before Blender 5, the generic Mix node after). a/b: socket or RGBA."""
            try:
                node = tree.nodes.new("CompositorNodeMixRGB")
                node.blend_type = blend
                ins, res = [i for i in node.inputs if i.type == "RGBA"], node.outputs[0]
            except RuntimeError:
                node = tree.nodes.new("ShaderNodeMix")
                node.data_type, node.blend_type = "RGBA", blend
                node.inputs["Factor"].default_value = 1.0
                ins, res = [node.inputs["A"], node.inputs["B"]], node.outputs["Result"]
            for sock, v in zip(ins, (a, b)):
                if isinstance(v, tuple):
                    sock.default_value = v
                else:
                    tree.links.new(v, sock)
            return res

        def glare(image, threshold, strength, size):
            g = tree.nodes.new("CompositorNodeGlare")
            for k, v in (("glare_type", "BLOOM"), ("quality", "HIGH")):
                if hasattr(g, k):
                    setattr(g, k, v)
            if "Type" in g.inputs:                          # Blender 5: the glare type is an input
                g.inputs["Type"].default_value = "Bloom"
            if "Quality" in g.inputs:
                g.inputs["Quality"].default_value = "High"
            for name, v in (("Threshold", threshold), ("Strength", strength), ("Size", size)):
                if name in g.inputs:
                    g.inputs[name].default_value = v
            tree.links.new(image, g.inputs["Image"])
            return g.outputs["Image"]

        rl = tree.nodes.new("CompositorNodeRLayers")
        image = rl.outputs["Image"]
        if LAYERS:
            rl.layer = LAYERS[0]
        if PAL["bloom"]:
            # Soft glow round the bright muscles and rim, as in the reference style.
            image = glare(image, PAL["bloom_threshold"], PAL["bloom_strength"], PAL["bloom_size"])
        if LAYERS:
            rl_line, rl_mask = tree.nodes.new("CompositorNodeRLayers"), tree.nodes.new("CompositorNodeRLayers")
            rl_line.layer, rl_mask.layer = LAYERS[1], LAYERS[2]
            # The line with its own glow, then multiplied by (1 - barbell): neither the line nor its glow
            # may cross the bar or plates. Added on top, it shows through the body like a neon overlay.
            line = glare(rl_line.outputs["Image"], 0.0, 1.0, PAL["bloom_size"])
            keep = mix("SUBTRACT", (1.0, 1.0, 1.0, 1.0), rl_mask.outputs["Image"])
            image = mix("ADD", image, line)
        tree.links.new(image, out.inputs[0])
        print("COMPOSITOR on", LAYERS)
    except Exception as exc:  # compositor API differs between Blender versions
        print("COMPOSITOR failed:", exc)
for ob in bpy.data.objects:
    if ob.name.startswith("WGT-") or ob.name == "Man3NT_metarig":
        ob.hide_render = True
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "lift_deadlift.blend"))
if ANIM and FAILS and "--force" not in argv:
    (OUT / "physics_report.txt").write_text("\n".join(f"frame {f}: {c}" for f, c in FAILS))
    print("PHYSICS FAILED on", len(FAILS), "frames; see physics_report.txt. First:", FAILS[0])
    raise SystemExit(1)
if ANIM:
    n = int(FPS * SECONDS)
    (OUT / "physics_report.txt").write_text(f"all {n} frames pass the grip, arm, gravity, proportion and smoothness rules\n")
    sc.render.filepath = str(OUT / ("tile_frames" if TILE else "frames") / "frame_")
    sc.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(animation=True)
else:
    sc.render.filepath = str(OUT / f"toon_test_p{P:.2f}.png")
    bpy.ops.render.render(write_still=True)
print("DONE", sc.render.filepath)


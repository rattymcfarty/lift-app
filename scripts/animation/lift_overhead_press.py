"""LIFT toon scene: standing dumbbell overhead press (KB `overhead-press`: Dumbbell) with the ElegantMesh
"Strong Male Superhero" rig. Derived from lift_squat.py (standing legs, look, neon line, render); brief in
lift-app docs/product/animation/overhead-press.md.

Run headless (embedded scripts in the asset stay disabled):
  blender -b --factory-startup --disable-autoexec CHAR.blend --python lift_overhead_press.py -- OUT_DIR [P|tile|check]
P is the press position, 0 = dumbbells at the shoulders (rack), 1 = lockout overhead. "tile" renders the app tile
(lift_palette.json "tile"), "check" solves and checks all 72 frames without rendering (writes physics_report.txt).
Options: rx= rz= ry= (rack handle offset from the shoulder joint, m), etop= (elbow at lockout, deg; 30 = soft
lockout, 15 = straight but the elbow solve is twitchy near full extension), yaw= pitch=,
--debug, --force (render a review preview past failed checks; the report keeps the failures).
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
CHECK_ONLY = len(argv) > 1 and argv[1] == "check"   # solve + check all 72 frames, no render
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
    """Per-vertex 0..1 'work' from rest-pose geometry (KB primary muscles): the front of each deltoid (a ball round
    the shoulder joint, anterior half) and the triceps (back of the upper arm, shoulder to elbow, upper arm only)."""
    ss = lambda e0, e1, x: (lambda u: u * u * (3 - 2 * u))(min(max((x - e0) / (e1 - e0), 0.0), 1.0))
    arms = {}
    for side in ("L", "R"):
        arms[side] = (RIG.matrix_world @ RIG.data.bones[f"DEF-upper_arm.{side}"].head_local,
                      RIG.matrix_world @ RIG.data.bones[f"DEF-forearm.{side}"].head_local)
    attr = BODY.data.attributes.new("work", "FLOAT", "POINT")
    mw = BODY.matrix_world
    for v in BODY.data.vertices:
        p = mw @ v.co
        work = 0.0
        for side, (sh, el) in arms.items():
            s = 1.0 if side == "L" else -1.0
            lateral = ss(abs(sh.x) - 0.06, abs(sh.x) - 0.02, p.x * s)          # stay off the chest and neck
            delt = ss(0.095, 0.065, (p - sh).length) * ss(0.015, -0.015, p.y - sh.y) * lateral
            axis = el - sh
            t = (p - sh).dot(axis) / axis.length_squared
            off = p - (sh + axis * t)
            tri = ss(0.12, 0.24, t) * ss(0.92, 0.80, t) * ss(0.0, 0.02, off.y) * ss(0.075, 0.05, off.length)
            work = max(work, delt, tri)
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
    """The line of force from the dumbbell to the floor: hand -> elbow -> shoulder -> spine -> hip -> knee -> ankle."""
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

# ================================================================ SQUAT: pose, set, animation
# World frame: x lateral (L = +x), y front-back (the lifter faces -y), z up, floor at z = 0.
RGW = RIG.matrix_world
print("RIG world", [round(v, 3) for v in RGW.to_translation()], [round(v, 3) for v in RGW.to_scale()])
rx4 = lambda deg: Matrix.Rotation(math.radians(deg), 4, "X")
ry4 = lambda deg: Matrix.Rotation(math.radians(deg), 4, "Y")
X_AXIS = Vector((1.0, 0.0, 0.0))
BAR_R = 0.0145
GRIP = float(next((a.split("=")[1] for a in argv if a.startswith("grip=")), "0.44"))     # half grip, m
BAR_DZ = float(next((a.split("=")[1] for a in argv if a.startswith("barz=")), "0.0"))     # nudge bar height on the back
WRIST_EXT = 12.0                                  # wrist tip-back, held
PALM_Y = 0.07
FINGER_R = 0.025
STAND_FLEX = 1.0
wb = lambda n: RGW @ pb[n].head
for side in ("L", "R"):
    pb[f"thigh_parent.{side}"]["IK_FK"] = 1.0
bpy.context.view_layer.update()

# --- measurements from the rest pose
HIP0 = (wb("thigh_parent.L") + wb("thigh_parent.R")) / 2
ANK = {s: RGW @ pb[f"ORG-foot.{s}"].head for s in ("L", "R")}
L1 = RIG.data.bones["ORG-thigh.L"].length
L2 = RIG.data.bones["ORG-shin.L"].length
_rest = [BODY.matrix_world @ v.co for v in BODY.data.vertices]
FOOT_IDX = [i for i, p in enumerate(_rest) if p.z < 0.12]
foot_y = [_rest[i].y for i in FOOT_IDX]
MIDFOOT_Y = (min(foot_y) + max(foot_y)) / 2
TOE_Y = min(foot_y)
STANCE = 0.18
BAR_TARGET_Y = 2 * MIDFOOT_Y - TOE_Y - 0.04     # over the rear of the foot (heel - 4 cm): this body's back is deep, so the load line sits behind mid-foot
A_T = {"L": Vector((STANCE, ANK["L"].y, ANK["L"].z)), "R": Vector((-STANCE, ANK["R"].y, ANK["R"].z))}
# upper back: where the bar rests
TRAP_IDX = [i for i, p in enumerate(_rest) if abs(p.x) < 0.14 and 1.40 < p.z < 1.62 and p.y > 0.0]
prof = {}
for i in TRAP_IDX:
    p = _rest[i]
    if abs(p.x) < 0.04:
        k = round(p.z, 2)
        prof[k] = max(prof.get(k, -9), p.y)
Z_BAR = 1.53 + BAR_DZ
Y_BAR = prof[round(Z_BAR - BAR_DZ, 2)] + BAR_R - 0.003
BAR0 = Vector((0.0, Y_BAR, Z_BAR))
print("MEASURE", dict(hip=[round(v, 3) for v in HIP0], ankle=[round(v, 3) for v in ANK["L"]], l1=round(L1, 3), l2=round(L2, 3),
                      midfoot_y=round(MIDFOOT_Y, 3), toe_y=round(TOE_Y, 3), bar=[round(v, 3) for v in BAR0],
                      profile={k: round(v, 3) for k, v in sorted(prof.items())}))
BAR_REL = BAR0 - HIP0


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
        y_d, n_d = HAND_UP, Vector((0.0, -1.0, 0.0))            # fingers up, palm to the front
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


def solve_hand(side, c, R, hint):
    """Palm (facing forward) round the handle centre c, the handle along R @ x (the dumbbell's attitude), wrist
    tipped back WRIST_EXT, elbow towards hint. Same maths as the squat's solve_side, with the handle axis free."""
    ax = (R @ X_AXIS).normalized()
    wrist = c.copy()
    rot = R @ BASE[side]
    arm_fk(side, wrist, hint, rot)
    for _ in range(10):
        a, d = forearm_line(side)
        fore = Matrix.Rotation(-math.radians(WRIST_EXT), 3, ax) @ d
        fore = (fore - ax * fore.dot(ax)).normalized()
        rot = (R @ HAND_UP).rotation_difference(fore).to_matrix() @ R @ BASE[side]
        arm_fk(side, wrist, hint, rot)
        wrist = wrist + (c - bar_contact(side))
        arm_fk(side, wrist, hint, rot)
    if DEBUG:
        print("ARM", side, "err_cm", round((c - bar_contact(side)).length * 100, 2))


def wrap_fingers(handles, axes):
    """Close each finger joint by joint round its handle (done once, at the rack; the grip is held)."""
    for side in ("L", "R"):
        bar, ax = handles[side], axes[side]
        dist = lambda q: dist_to_line(q, bar, ax)
        for f in ("f_index", "f_middle", "f_ring", "f_pinky", "thumb"):
            for k in (1, 2, 3):
                ctrl = pb[f"{f}.0{k}.{side}"]
                d = pb[f"DEF-{f}.0{k + 1}.{side}"] if k < 3 else None
                tip = (lambda: RGW @ d.head) if d else (lambda: RGW @ pb[f"DEF-{f}.03.{side}"].tail)
                axes2 = ("X", "Z") if (f == "thumb" and k == 1) else ("X",)
                best = None
                for ang in range(-20 if f == "thumb" else 0, 125, 5):
                    for ang2 in (range(-40, 45, 10) if len(axes2) == 2 else (0,)):
                        q = Matrix.Rotation(math.radians(ang), 3, "X")
                        if len(axes2) == 2:
                            q = Matrix.Rotation(math.radians(ang2), 3, "Z") @ q
                        ctrl.rotation_quaternion = q.to_quaternion()
                        bpy.context.view_layer.update()
                        r = dist(tip())
                        e = abs(r - FINGER_R) + 3 * max(0.0, FINGER_R - 0.006 - r)
                        if best is None or e < best[0]:
                            best = (e, q.to_quaternion())
                ctrl.rotation_quaternion = best[1]
                bpy.context.view_layer.update()


# --- the movement: depth 0 standing, 1 the bottom (hip crease just below the knee)
ss_ = lambda u: u * u * (3 - 2 * u)
PSI0, PSI1 = 3.0, 33.0        # shin lean forward (ankle dorsiflexion), degrees from vertical
BETA0, BETA1 = 86.0, -6.0     # thigh pitch below horizontal (negative: knee above the hip)
ROLL_DEG = float(next((a.split("=")[1] for a in argv if a.startswith("roll=")), "1.2"))   # natural left/right attitude, peak
LEG_MOVERS = [f"{n}.{s}" for n in ("thigh_fk", "shin_fk", "foot_fk") for s in ("L", "R")]
SPINE_MOVERS = ["torso", "neck", "head"]
TRAIN = {}


def _reach_p(psi_deg, beta_deg):
    psi, beta = math.radians(psi_deg), math.radians(beta_deg)
    return math.hypot(-L2 * math.sin(psi) + L1 * math.cos(beta), L2 * math.cos(psi) + L1 * math.sin(beta))


def calibrate_top():
    """Standing legs: as straight as the hip-to-ankle reach allows (the hips are narrower than the feet, so the
    reach is a bit shorter in the side plane), never beyond it, so no frame is clamped and the knee moves smoothly."""
    global BETA0
    lateral = abs(A_T["L"].x) - abs(wb("thigh_parent.L").x)
    max_p = math.sqrt(((L1 + L2) * 0.992) ** 2 - lateral ** 2)
    lo, hi = 60.0, 95.0
    for _ in range(30):
        mid = (lo + hi) / 2
        if _reach_p(PSI0, mid) > max_p:
            hi = mid
        else:
            lo = mid
    BETA0 = lo
    print("TOP LEGS beta0", round(BETA0, 1))


def plan(d):
    """Hip centre (y, z) and trunk lean for depth d, from the leg geometry: the ankles stay put, the shin leans
    forward, the thigh drops to the bottom; the trunk leans just enough to keep the bar over mid-foot."""
    psi = math.radians(PSI0 + (PSI1 - PSI0) * d)
    beta = math.radians(BETA0 + (BETA1 - BETA0) * d)
    ay, az = (A_T["L"].y + A_T["R"].y) / 2, A_T["L"].z
    k = Vector((0.0, ay - L2 * math.sin(psi), az + L2 * math.cos(psi)))
    h = Vector((0.0, k.y + L1 * math.cos(beta), k.z + L1 * math.sin(beta)))
    lo, hi = math.radians(-15), math.radians(85)
    for _ in range(40):
        th = (lo + hi) / 2
        by = h.y + BAR_REL.y * math.cos(th) - BAR_REL.z * math.sin(th)
        if by > BAR_TARGET_Y:
            lo = th                                       # bar still behind mid-foot: lean further forward
        else:
            hi = th
    return h, th


def pose_squat(d, roll_deg=0.0, th_fixed=None):
    reset(SPINE_MOVERS + LEG_MOVERS)
    h, th = plan(d)
    if th_fixed is not None:
        th = th_fixed                                     # press: trunk upright, not balanced over a back bar
    T = Matrix.Translation(h) @ ry4(roll_deg) @ Matrix.Rotation(th, 4, "X") @ Matrix.Translation(-HIP0)
    move_bone("torso", T)
    rotate_about("neck", X_AXIS, -0.5 * th)               # eyes stay forward
    rotate_about("head", X_AXIS, -0.35 * th)
    for side, s in (("L", 1), ("R", -1)):
        hip = RGW @ pb[f"ORG-thigh.{side}"].head
        v = A_T[side] - hip
        dd = min(v.length, (L1 + L2) * 0.998)
        u = v.normalized()
        a = (L1 ** 2 - L2 ** 2 + dd ** 2) / (2 * dd)
        hgt = math.sqrt(max(L1 ** 2 - a ** 2, 0.0))
        pole = Vector((0.35 * s, -1.0, 0.0))
        pole = (pole - u * pole.dot(u)).normalized()
        aim_bone(f"thigh_fk.{side}", hip + u * a + pole * hgt)
        aim_bone(f"shin_fk.{side}", hip + u * dd)
        b = pb[f"foot_fk.{side}"]
        b.matrix = Matrix.Translation(b.matrix.translation) @ b.bone.matrix_local.to_3x3().to_4x4()
        bpy.context.view_layer.update()
    return T, th


TH_STAND = math.radians(float(next((a.split("=")[1] for a in argv if a.startswith("lean=")), "3.0")))
ARM_MOVERS = [f"{n}.{s}" for n in ("upper_arm_fk", "forearm_fk", "hand_fk") for s in ("L", "R")]
# Standing tall: the squat's top leans the shins only 3 deg, which leaves the hips (and so the shoulders and the
# load) behind the ankles; a press stands with the hips over the feet.
PSI0 = float(next((a.split("=")[1] for a in argv if a.startswith("psi=")), "9.0"))
calibrate_top()
find_palm()
ELBOW_HINGE_SIGN = hinge_signs()
for _ in range(3):                                      # soles flat on the floor: lower the ankle targets by the gap
    T0, TH0 = pose_squat(0.0, 0.0, TH_STAND)
    g = float(body_world_np()[FOOT_IDX][:, 2].min())
    if abs(g) < 0.0008:
        break
    for sd in A_T:
        A_T[sd].z -= g
SH0 = {s: wb(f"ORG-upper_arm.{s}") for s in ("L", "R")}
HEEL_Y = 2 * MIDFOOT_Y - TOE_Y
SIDE = {"L": 1.0, "R": -1.0}
# rack: handle centre beside the head, a little in front of the shoulder joint, forearms vertical (elbow ~90 deg)
RX = float(next((a.split("=")[1] for a in argv if a.startswith("rx=")), "0.27"))
RY = float(next((a.split("=")[1] for a in argv if a.startswith("ry=")), "0.12"))
RZ = float(next((a.split("=")[1] for a in argv if a.startswith("rz=")), "0.28"))
ELBOW_TOP = float(next((a.split("=")[1] for a in argv if a.startswith("etop=")), "30"))
TOP_IN = 0.03                                           # handles finish 3 cm inside the shoulder joints
RACK = {s: SH0[s] + Vector((SIDE[s] * RX, -RY, RZ)) for s in SH0}
TOP_H = [0.55]


def handle_at(side, p):
    s, sh = SIDE[side], SH0[side]
    top = Vector((sh.x - s * TOP_IN, sh.y - 0.04, sh.z + TOP_H[0]))
    return RACK[side].lerp(top, p)


def elbow_hint(side, p):
    s = SIDE[side]
    sh = wb(f"ORG-upper_arm.{side}")
    return sh + Vector((s * 0.30, -0.06, -0.14)).lerp(Vector((s * 0.30, 0.02, 0.0)), p)


# Dumbbell attitude (owner: free weights are never perfect). Per side, mirror-aware degrees:
#   sag  = outer end lower (gravity on a heavy head), a little at the rack, most mid-press where the effort peaks;
#   turn = inner end forward (the natural slight inward rotation), most at the rack, opening towards lockout.
# The two sides differ a little, and the right hand trails the left by LAG s (effort, not a machine).
SAG0, SAG_AMP = {"L": 1.2, "R": 0.6}, {"L": 1.8, "R": 1.6}
TURN_RACK, TURN_TOP = {"L": 10.0, "R": 7.0}, {"L": 4.0, "R": 2.0}
LAG = {"L": 0.0, "R": 0.05}


def dumbbell_R(side, p):
    p = min(max(p, 0.0), 1.0)
    s = SIDE[side]
    sag = SAG0[side] + SAG_AMP[side] * math.sin(math.pi * p) ** 2
    turn = TURN_RACK[side] + (TURN_TOP[side] - TURN_RACK[side]) * (1 - math.cos(math.pi * p)) / 2
    R = Matrix.Rotation(math.radians(s * turn), 3, "Z") @ Matrix.Rotation(math.radians(s * sag), 3, "Y")
    return R, sag, turn


def calibrate_lockout():
    """Lockout height: a soft lockout, elbows finishing at ELBOW_TOP (30 deg). Straighter (15 deg) puts the arm
    near full extension, where a millimetre of handle travel swings the elbow several degrees and the smoothness
    rule fails; the brief's safety note also says to stop short of a pinching lockout."""
    lo, hi = 0.35, 0.80
    for _ in range(24):
        TOP_H[0] = (lo + hi) / 2
        for side in ("L", "R"):
            solve_hand(side, handle_at(side, 1.0), dumbbell_R(side, 1.0)[0], elbow_hint(side, 1.0))
        e = max(joint_flex(sd, "elbow") for sd in ("L", "R"))
        if e > ELBOW_TOP:
            lo = TOP_H[0]
        else:
            hi = TOP_H[0]
    print("LOCKOUT handle above the shoulder", round(TOP_H[0], 3), "elbow", round(e, 1))


def joint_flex(side, joint):
    a, b, c = (("ORG-upper_arm", "ORG-forearm", "ORG-hand") if joint == "elbow" else ("ORG-thigh", "ORG-shin", "ORG-foot"))
    p1, p2, p3 = (RGW @ pb[f"{n}.{side}"].head for n in (a, b, c))
    return math.degrees((p2 - p1).angle(p3 - p2))


calibrate_lockout()
for side in ("L", "R"):                                  # grip closed once at the rack and held
    solve_hand(side, handle_at(side, 0.0), dumbbell_R(side, 0.0)[0], elbow_hint(side, 0.0))
wrap_fingers({s: handle_at(s, 0.0) for s in SH0}, {s: (dumbbell_R(s, 0.0)[0] @ X_AXIS).normalized() for s in SH0})
print("RACK elbows", {s: round(joint_flex(s, "elbow"), 1) for s in SH0}, "shoulder", [round(v, 3) for v in SH0["L"]])

SUPPORT_Z = lambda: float(body_world_np()[FOOT_IDX][:, 2].min()) * 100


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


_rest_head_z = (RGW @ pb["ORG-spine.006"].head).z if "ORG-spine.006" in pb else 1.62
HEAD_IDX = [i for i, q in enumerate(_rest) if q.z > _rest_head_z - 0.02 and abs(q.x) < 0.14]


def trunk_pitch():
    """Trunk pitch from the spine (pelvis to chest), degrees; + = leaning forward (the lifter faces -y)."""
    v = wb("ORG-spine.003") - wb("ORG-spine")
    return math.degrees(math.atan2(-v.y, v.z))


def head_gap_cm(co):
    import numpy as np
    head = co[HEAD_IDX]
    best = 9.0
    for ob in DB_MESHES:
        m = np.array(ob.matrix_world)
        vv = np.array([v.co[:] for v in ob.data.vertices]) @ m[:3, :3].T + m[:3, 3]
        dd = np.sqrt(((head[:, None, :] - vv[None, :, :]) ** 2).sum(-1)).min()
        best = min(best, float(dd))
    return best * 100


def physics_check(ps, handles, axes, frame=None):
    """Gravity, balance, joint and grip rules for a standing dumbbell press. Returns measurements and failures."""
    out, fails = {}, []
    co = body_world_np()
    foot_gap = float(co[FOOT_IDX][:, 2].min()) * 100
    out["foot_gap_cm"] = round(foot_gap, 2)
    if foot_gap > 0.5 or foot_gap < -1.5:
        fails.append(f"feet {'floating' if foot_gap > 0.5 else 'sunk'} ({foot_gap:.2f} cm)")
    pitch = trunk_pitch()
    out["trunk_pitch_deg"] = round(pitch, 1)
    if pitch < -5.0:
        fails.append(f"trunk leans back ({pitch:.1f} deg)")
    hg = head_gap_cm(co)
    out["head_gap_cm"] = round(hg, 1)
    if hg < 2.0:
        fails.append(f"dumbbell {hg:.1f} cm from the head")
    for side in ("L", "R"):
        for joint, lo, hi in (("elbow", 0.0, 150.0), ("knee", 0.0, 150.0)):
            f = joint_flex(side, joint)
            out.setdefault("joints_deg", {})[f"{joint}.{side}"] = round(f, 1)
            if not lo <= f <= hi:
                fails.append(f"{joint}.{side} out of range ({f:.1f} deg)")
        if joint_flex(side, "knee") > 25.0:
            fails.append(f"knee.{side} not extended ({joint_flex(side, 'knee'):.1f} deg)")
        b, ax = handles[side], axes[side]
        sh = wb(f"ORG-upper_arm.{side}")
        if not TOE_Y - 0.01 <= b.y <= HEEL_Y + 0.01:
            fails.append(f"{side}: dumbbell not over the feet (y {b.y:.3f})")
        if ps[side] > 0.99 and abs(b.y - sh.y) > 0.05:
            fails.append(f"{side}: lockout {abs(b.y - sh.y) * 100:.1f} cm off the shoulder line")
        if sh.z > SH0[side].z + 0.02:
            fails.append(f"{side}: shoulder shrugged {(sh.z - SH0[side].z) * 100:.1f} cm")
        seat = (b - bar_contact(side)).length * 100
        a, dd = forearm_line(side)
        flat = lambda q: (q - ax * q.dot(ax))
        hand_dir = (bone_world(f"DEF-hand.{side}").to_3x3() @ Vector((0, 1, 0))).normalized()
        wrist = math.degrees(flat(dd).normalized().angle(flat(hand_dir).normalized()))
        gp = lambda f: max(abs(dist_to_line(RGW @ q, b, ax) - FINGER_R) * 100
                           for q in (pb[f"DEF-{f}.03.{side}"].head, pb[f"DEF-{f}.03.{side}"].tail))
        wrap = max(gp(f) for f in ("f_index", "f_middle", "f_ring", "f_pinky"))
        thumb = gp("thumb")
        out[side] = dict(seat_cm=round(seat, 2), wrist_deg=round(wrist, 1), finger_gap_cm=round(wrap, 2), thumb_gap_cm=round(thumb, 2))
        for name, ok in (("handle on palm", seat <= 0.7), ("wrist angle", wrist <= 32), ("fingers on handle", wrap <= 1.0), ("thumb round handle", thumb <= 2.0)):
            if not ok:
                fails.append(f"{side}: {name}")
    stretch, bone = max_stretch()
    out["max_bone_stretch_pct"] = round(stretch, 2)
    if stretch > 2.0:
        fails.append(f"{bone} stretched {stretch:.1f}%")
    out["fails"] = fails
    return out


def _ease(u, a0, a1):
    """0 -> 1 with steady speed in the middle and smooth (half-cosine) speed ramps a0 / a1 at the ends: zero
    acceleration where the dumbbells start and stop, so nothing twitches at the rack or at lockout."""
    v = 1 / (1 - (a0 + a1) / 2)
    head = lambda x, a: v * (x / 2 - a / (2 * math.pi) * math.sin(math.pi * x / a))
    u = min(max(u, 0.0), 1.0)
    if u <= a0:
        return head(u, a0)
    if u >= 1 - a1:
        return 1 - head(1 - u, a1)
    return v * (a0 / 2 + u - a0)


# Tempo, 3 s loop (brief): hold at the shoulders, press ~1.1 s, hold at lockout, lower ~1.1 s, settle.
def rep(t):
    u = (t % SECONDS) / SECONDS
    if u < 0.08:
        return 0.0
    if u < 0.44:
        return _ease((u - 0.08) / 0.36, 0.30, 0.40)
    if u < 0.56:
        return 1.0
    if u < 0.94:
        return 1 - _ease((u - 0.56) / 0.38, 0.40, 0.30)
    return 0.0


def attitude_roll(p):
    return ROLL_DEG * 0.5 * math.sin(math.pi * p) ** 2


def natural_motion_check(series):
    """series: frame -> dict(tiltL, tiltR, turnL, turnR, knee, lean, elbow). Two free weights: each sags a little
    (up to 6 deg) and turns in a little (up to 15 deg), not identically (divergence <= 4 deg), smoothly; the body
    moves without twitch."""
    fails = []
    fr = sorted(series)
    if DEBUG:
        print("SERIES", [(f, round(series[f]["elbow"], 1), round(series[f]["lean"], 1), round(series[f]["tiltL"], 2),
                          round(series[f]["tiltR"], 2)) for f in fr])
    for k in ("tiltL", "tiltR"):
        v = [series[f][k] for f in fr]
        if max(abs(t) for t in v) > 6.0:
            fails.append(f"{k} more than 6 deg")
    if max(max(series[f][k] for f in fr) - min(series[f][k] for f in fr) for k in ("tiltL", "tiltR")) < 0.4:
        fails.append("dumbbells perfectly level (no natural attitude variation)")
    if max(abs(series[f]["tiltL"] - series[f]["tiltR"]) for f in fr) > 4.0:
        fails.append("dumbbells diverge more than 4 deg")
    for k in ("turnL", "turnR"):
        if max(abs(series[f][k]) for f in fr) > 15.0:
            fails.append(f"{k} more than 15 deg")
    for key, step_max, jerk_max in (("tiltL", 0.35, 0.2), ("tiltR", 0.35, 0.2), ("turnL", 0.6, 0.2), ("turnR", 0.6, 0.2),
                                    ("knee", 8.0, 1.5), ("lean", 6.0, 1.2), ("elbow", 9.0, 1.5)):
        v = [series[f][key] for f in fr]
        steps = [v[i + 1] - v[i] for i in range(len(v) - 1)] + [v[0] - v[-1]]
        if max(abs(x) for x in steps) > step_max:
            fails.append(f"{key} jumps {max(abs(x) for x in steps):.2f} deg/frame")
        jerk = [abs(steps[i] - steps[i - 1]) for i in range(len(steps))]
        if max(jerk) > jerk_max:
            fails.append(f"{key} twitch {max(jerk):.2f} deg/frame^2")
    return fails


# ---------------------------------------------------------------- set: rack, platform, barbell
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

AY = (A_T["L"].y + A_T["R"].y) / 2
box("Platform", (-1.0, AY - 0.75, 0.0), (1.0, AY + 0.6, 0.02), MAT, bevel=0.01)

HANDLE_HALF, PLATE_IN, PLATE_OUT, PLATE_R = 0.07, 0.066, 0.175, 0.105    # ~25-30 kg hex: 21 cm heads, 13 cm grip
BAR = bpy.data.objects.new("Bar", None)                  # static root; each dumbbell is an animated child empty
bpy.context.scene.collection.objects.link(BAR)
DB, DB_MESHES = {}, []
for side in ("L", "R"):
    e = bpy.data.objects.new(f"DB_{side}", None)
    bpy.context.scene.collection.objects.link(e)
    e.rotation_mode = "QUATERNION"
    e.parent = BAR
    parts = [cylinder_x(f"DB_{side}_Handle", 0.0, 0.0, -HANDLE_HALF, HANDLE_HALF, BAR_R, DARKMETAL)]
    for zs in (1, -1):
        parts += [cylinder_x(f"DB_{side}_Plate{zs}", 0.0, 0.0, PLATE_IN * zs, PLATE_OUT * zs, PLATE_R, RUBBER, verts=6, bevel=0.006),
                  cylinder_x(f"DB_{side}_Cap{zs}", 0.0, 0.0, PLATE_OUT * zs, (PLATE_OUT + 0.006) * zs, 0.035, METAL),
                  cylinder_x(f"DB_{side}_Collar{zs}", 0.0, 0.0, (PLATE_IN - 0.008) * zs, PLATE_IN * zs, 0.03, METAL)]
    for ob in parts:
        ob.parent = e
    DB[side] = e
    DB_MESHES += [o for o in parts if "Plate" in o.name or "Cap" in o.name]

FAILS, SERIES = [], {}


def place(ps):
    """Pose the body and both arms for press positions ps = {side: p}; returns handle centres, axes, attitudes."""
    pm = (ps["L"] + ps["R"]) / 2
    T, th = pose_squat(0.0, attitude_roll(pm), TH_STAND)
    handles, axes, att = {}, {}, {}
    for side in ("L", "R"):
        R, sag, turn = dumbbell_R(side, ps[side])
        c = handle_at(side, ps[side])
        solve_hand(side, c, R, elbow_hint(side, ps[side]))
        DB[side].location = c
        DB[side].rotation_quaternion = R.to_quaternion()
        handles[side], axes[side], att[side] = c, (R @ X_AXIS).normalized(), (sag, turn)
    bpy.context.view_layer.update()
    return T, th, handles, axes, att


def key_frame(f, p):
    for side in ("L", "R"):
        DB[side].keyframe_insert("location", frame=f)
        DB[side].keyframe_insert("rotation_quaternion", frame=f)
    for n in SPINE_MOVERS + LEG_MOVERS + ARM_MOVERS:
        pb[n].keyframe_insert("location", frame=f)
        pb[n].keyframe_insert("rotation_quaternion", frame=f)
        pb[n].keyframe_insert("scale", frame=f)
    glow = SKIN.node_tree.nodes["GlowPulse"].outputs[0]
    glow.default_value = 1.0 + PAL["glow_pulse"] * p
    glow.keyframe_insert("default_value", frame=f)


def solve_frame(f, ps):
    T, th, handles, axes, att = place(ps)
    chk = physics_check(ps, handles, axes, f)
    SERIES[f] = dict(tiltL=att["L"][0], tiltR=att["R"][0], turnL=att["L"][1], turnR=att["R"][1],
                     knee=joint_flex("L", "knee"), lean=trunk_pitch(), elbow=joint_flex("L", "elbow"))
    return chk


for side in ("L", "R"):                                   # rotation mode for the keyed arm bones
    for n in ("upper_arm_fk", "forearm_fk", "hand_fk"):
        pb[f"{n}.{side}"].rotation_mode = "QUATERNION"

if ANIM:
    sc0 = bpy.context.scene
    sc0.render.fps = FPS
    sc0.frame_start, sc0.frame_end = 1, int(FPS * SECONDS)
    for f in range(sc0.frame_start, sc0.frame_end + 1):
        sc0.frame_set(f)
        ps = {sd: rep((f - 1) / FPS - LAG[sd]) for sd in ("L", "R")}
        p = max(ps.values())
        chk = solve_frame(f, ps)
        if chk["fails"]:
            FAILS.append((f, chk))
        if DEBUG:
            print("FRAME", f, round(p, 3), chk)
        key_frame(f, p)
        NEON[f] = neon_points()
    nm = natural_motion_check(SERIES)
    if nm:
        FAILS.append(("motion", {"fails": nm}))
    if CHECK_ONLY:
        lines = [f"frame {f}: {c['fails']} joints={c.get('joints_deg')} head_gap={c.get('head_gap_cm')} grip={c.get('L')}/{c.get('R')}"
                 if f != "motion" else f"motion: {c['fails']}" for f, c in FAILS]
        (OUT / "physics_report.txt").write_text("\n".join(lines) + "\n" if lines else "all 72 frames pass the grip, arm, gravity, proportion and smoothness rules\n")
        print("CHECK-ONLY", "FAILED on %d entries" % len(FAILS) if FAILS else "PASSED")
        raise SystemExit(1 if FAILS else 0)
else:
    chk = solve_frame(1, {"L": P, "R": P})
    print("PHYSICS", chk)
    SKIN.node_tree.nodes["GlowPulse"].outputs[0].default_value = 1.0 + PAL["glow_pulse"] * P
bpy.context.view_layer.update()

bpy.ops.mesh.primitive_plane_add(size=14, location=(0, 0, -0.001))
bpy.context.object.name = "Floor"
bpy.context.object.data.materials.append(FLOOR)

# ---------------------------------------------------------------- light, world, camera
for ob in [o for o in bpy.data.objects if o.type == "LIGHT"]:
    bpy.data.objects.remove(ob, do_unlink=True)


def area(name, direction, dist, size, energy, color="#ffffff"):
    d = Vector(direction).normalized()
    target = Vector((0.0, AY, 0.95))
    lamp = bpy.data.lights.new(name, "AREA")
    lamp.shape, lamp.size, lamp.energy, lamp.color = "DISK", size, energy, srgb(color)[:3]
    ob = bpy.data.objects.new(name, lamp)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = target + d * dist
    ob.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()


area("Key", (0.55, -0.75, 0.75), 4.0, 3.0, PAL["key_light_energy"], PAL["key_light"])
area("Fill", (-0.8, -0.6, 0.35), 4.0, 4.0, PAL["fill_light_energy"], PAL["fill_light"])
area("Rim", (-0.5, 0.85, 0.55), 4.0, 2.0, PAL["rim_light_energy"], PAL["rim_light"])
if PAL["mannequin"]:
    area("RimBack", (0.75, 0.75, 0.45), 4.0, 2.5, PAL["rim_light_energy"], PAL["rim_light"])
    area("RimHead", (-0.2, 0.3, 1.0), 4.0, 2.0, PAL["rim_light_energy"] * 0.6, PAL["rim_light"])

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

# Camera: three-quarter front from his left, slightly above the shoulders (front delt and triceps both read).
yaw = math.radians(float(next((a.split("=")[1] for a in argv if a.startswith("yaw=")), "28")))
pitch = math.radians(float(next((a.split("=")[1] for a in argv if a.startswith("pitch=")), "10")))
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
    for pp in (0.0, 1.0):                                 # the body and both dumbbells at the rack and at lockout
        _, _, hs, _, _ = place({"L": pp, "R": pp})
        pts += [Vector(q) for q in body_world_np()[::40]]
        for c in hs.values():
            for zs in (-1, 1):
                for a in range(0, 360, 30):
                    pts.append(c + Vector(((PLATE_OUT + 0.01) * zs, PLATE_R * math.cos(math.radians(a)), PLATE_R * math.sin(math.radians(a)))))
    pts += [Vector((x, y, 0.0)) for x in (-0.3, 0.3) for y in (AY - 0.25, AY + 0.25)]      # feet and floor under him
    place({"L": P, "R": P} if not ANIM else {"L": 0.0, "R": 0.0})
    us = [p.dot(xc) for p in pts]
    vs = [p.dot(yc) for p in pts]
    centre = xc * (min(us) + max(us)) / 2 + yc * (min(vs) + max(vs)) / 2
    depth = sum(p.dot(zc) for p in pts) / len(pts)
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = max(max(us) - min(us), max(vs) - min(vs)) * 1.04
    cam.location = centre + zc * (depth + 8.0)
else:
    cam.location = Vector((0.0, AY, 1.2)) + view * 6.8   # stills must show the dumbbells at lockout too
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
    bar_objs = {BAR} | set(BAR.children_recursive)
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
    mask_c.objects.link(BAR)                            # the parents (root + animated dumbbells), in this layer too
    for ob in BAR.children:
        mask_c.objects.link(ob)
    for ob in [o for o in BAR.children_recursive if o.type == "MESH"]:
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
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "lift_overhead_press.blend"))
if ANIM and FAILS and "--force" not in argv:
    (OUT / "physics_report.txt").write_text("\n".join(f"frame {f}: {c}" for f, c in FAILS))
    print("PHYSICS FAILED on", len(FAILS), "frames; see physics_report.txt. First:", FAILS[0])
    raise SystemExit(1)
if ANIM:
    n = int(FPS * SECONDS)
    if FAILS:   # --force: review preview only, never a shippable clip; keep the real failures on record
        (OUT / "physics_report.txt").write_text("PREVIEW (--force), NOT A PASS:\n" + "\n".join(f"frame {f}: {c}" for f, c in FAILS) + "\n")
    else:
        (OUT / "physics_report.txt").write_text(f"all {n} frames pass the grip, arm, gravity, proportion and smoothness rules\n")
    sc.render.filepath = str(OUT / ("tile_frames" if TILE else "frames") / "frame_")
    sc.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(animation=True)
else:
    sc.render.filepath = str(OUT / f"toon_test_p{P:.2f}.png")
    bpy.ops.render.render(write_still=True)
print("DONE", sc.render.filepath)


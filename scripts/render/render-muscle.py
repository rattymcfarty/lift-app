"""
LIFT 3D muscle icons - CC0 base body edition.

Body: Blender "Human Base Meshes" bundle (CC0), male realistic, multires baked.
Masks: hand-authored 2D outlines projected onto the front surface by normal.
Look:  lit grey body + lit accent muscle (orange by default, --color red) with baked
       fibre striations, anatomical creases and a rim.

  blender -b --python scripts/render/render-muscle.py -- --id Chest --out /tmp/lift-icons/chest
"""
import bpy
import math
import os
import sys

ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default=None):
    return ARGV[ARGV.index(name) + 1] if name in ARGV else default


ICON = arg("--id", "Chest")
OUT = arg("--out", os.path.join(os.getcwd(), "renders", "icon"))
SRC = arg("--blend", os.environ.get("LIFT_BASE_MESH", ""))
if not SRC or not os.path.exists(SRC):
    sys.exit(
        "Set LIFT_BASE_MESH (or pass --blend) to the human_base_meshes_bundle.blend "
        "from Blender's CC0 Human Base Meshes bundle. See scripts/render/README.md."
    )
LEVEL = int(arg("--level", "2"))
RES = int(arg("--res", "512"))
SAMPLES = int(arg("--samples", "128"))
AO_DIST = float(arg("--ao", "0.035"))
AO_FAC = float(arg("--aofac", "0.9"))

# muscle colours: linear RGB for Cycles, plus the dark-theme / light-theme pair
PALETTE = {
    "orange": {"dark": (1.00, 0.235, 0.012), "light": (0.62, 0.115, 0.004)},
    "red":    {"dark": (0.84, 0.055, 0.030), "light": (0.52, 0.022, 0.014)},
}
COLOUR = arg("--color", "orange")
DARK_RGB = PALETTE[COLOUR]["dark"]
LIGHT_RGB = PALETTE[COLOUR]["light"]

# ---------------------------------------------------------------- base body
bpy.ops.wm.open_mainfile(filepath=SRC)
scene = bpy.context.scene

body = bpy.data.objects["GEO-body_male_realistic"]
eyes = [bpy.data.objects["GEO-body_male_realistic.eye.L"],
        bpy.data.objects["GEO-body_male_realistic.eye.R"]]

for vl in scene.view_layers:
    def walk(lc):
        lc.exclude = False
        for c in lc.children:
            walk(c)
    walk(vl.layer_collection)

keep = [body] + eyes
for o in keep:
    for c in list(o.users_collection):
        c.objects.unlink(o)
    scene.collection.objects.link(o)
for o in list(bpy.data.objects):
    if o not in keep:
        bpy.data.objects.remove(o, do_unlink=True)
for coll in list(bpy.data.collections):
    bpy.data.collections.remove(coll)

for o in keep:
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for m in list(o.modifiers):
        if m.type == "MULTIRES":
            m.levels = LEVEL
            m.render_levels = LEVEL
        bpy.ops.object.modifier_apply(modifier=m.name)
    o.select_set(False)

# 1.80 m tall, feet on z=0, centred on x
zs = [v.co.z for v in body.data.vertices]
zmin, zmax = min(zs), max(zs)
k = 1.80 / (zmax - zmin)
xs = [v.co.x for v in body.data.vertices]
cx = (min(xs) + max(xs)) / 2
for o in keep:
    for v in o.data.vertices:
        v.co.x = (v.co.x - cx) * k
        v.co.y *= k
        v.co.z = (v.co.z - zmin) * k
    o.data.update()

# ------------------------------------------------------------------ mask model
def ss(u, lo, hi):
    if hi <= lo:
        return 1.0 if u >= hi else 0.0
    t = max(0.0, min(1.0, (u - lo) / (hi - lo)))
    return t * t * (3 - 2 * t)


def poly_eval(x, z, pts, band):
    inside = False
    dmin = 1e9
    n = len(pts)
    for i in range(n):
        x1, z1 = pts[i]
        x2, z2 = pts[(i + 1) % n]
        if (z1 > z) != (z2 > z):
            xin = x1 + (z - z1) * (x2 - x1) / (z2 - z1)
            if x < xin:
                inside = not inside
        dx, dz = x2 - x1, z2 - z1
        L2 = dx * dx + dz * dz
        t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((x - x1) * dx + (z - z1) * dz) / L2))
        dmin = min(dmin, math.hypot(x - (x1 + t * dx), z - (z1 + t * dz)))
    if not inside:
        return 0.0
    return min(1.0, dmin / band)


def mirror(parts):
    out = []
    for p in parts:
        out.append(p)
        out.append({"pts": [(-x, z) for x, z in p["pts"]],
                    "side": p.get("side", "both"), "band": p.get("band", 0.006)})
    return out


# landmarks measured off the base render: shoulder 1.45, nipple 1.29, navel 1.10,
# crotch 0.80, knee 0.50, ankle 0.09
REGIONS = {
    "Chest": mirror([{
        "pts": [(0.016, 1.380), (0.060, 1.386), (0.110, 1.378), (0.160, 1.360),
                (0.186, 1.336), (0.192, 1.308), (0.182, 1.270), (0.158, 1.240),
                (0.114, 1.220), (0.060, 1.220), (0.026, 1.246)],
        "side": "front", "band": 0.0045,
    }]),
    "Abs": ([{
        "pts": [(-0.092, 1.224), (0.092, 1.224), (0.098, 1.170), (0.090, 1.058),
                (0.070, 1.010), (0.0, 0.998), (-0.070, 1.010), (-0.090, 1.058),
                (-0.098, 1.170)],
        "side": "front", "band": 0.0045,
    }] + mirror([{
        "pts": [(0.092, 1.168), (0.150, 1.126), (0.144, 1.048), (0.088, 1.042)],
        "side": "front", "band": 0.0045,
    }])),
    "Quadriceps": mirror([{
        "pts": [(0.046, 0.926), (0.105, 0.948), (0.175, 0.930), (0.196, 0.860),
                (0.190, 0.740), (0.176, 0.630), (0.160, 0.540), (0.130, 0.490),
                (0.086, 0.482), (0.058, 0.520), (0.040, 0.620), (0.030, 0.780)],
        "side": "front", "band": 0.0045,
    }]),
    "Middle Delts": mirror([{
        "pts": [(0.142, 1.462), (0.190, 1.482), (0.236, 1.466), (0.262, 1.420),
                (0.266, 1.362), (0.248, 1.318), (0.214, 1.300), (0.180, 1.314),
                (0.158, 1.350), (0.142, 1.402)],
        "band": 0.0045,
    }]),
    "Front Delts": mirror([{
        "pts": [(0.124, 1.456), (0.164, 1.470), (0.198, 1.448), (0.210, 1.396),
                (0.198, 1.344), (0.168, 1.322), (0.142, 1.352), (0.126, 1.404)],
        "side": "front", "band": 0.0045,
    }]),
    "Rear Delts": mirror([{
        "pts": [(0.126, 1.456), (0.166, 1.468), (0.200, 1.444), (0.212, 1.394),
                (0.200, 1.348), (0.170, 1.330), (0.146, 1.360), (0.128, 1.406)],
        "side": "back", "band": 0.0045,
    }]),
    "Biceps": mirror([{
        "pts": [(0.214, 1.352), (0.254, 1.362), (0.294, 1.330), (0.324, 1.232),
                (0.336, 1.158), (0.306, 1.126), (0.272, 1.164), (0.240, 1.250),
                (0.216, 1.318)],
        "side": "front", "band": 0.0045,
    }]),
    "Triceps": mirror([{
        "pts": [(0.208, 1.364), (0.250, 1.376), (0.296, 1.338), (0.332, 1.236),
                (0.344, 1.148), (0.308, 1.114), (0.268, 1.152), (0.232, 1.246),
                (0.208, 1.326)],
        "side": "back", "band": 0.0045,
    }]),
    "Forearms": mirror([{
        "pts": [(0.296, 1.136), (0.352, 1.152), (0.402, 1.064), (0.430, 0.962),
                (0.436, 0.894), (0.384, 0.882), (0.348, 0.944), (0.318, 1.042),
                (0.300, 1.096)],
        "side": "front", "band": 0.0045,
    }]),
    "Lats": mirror([{
        "pts": [(0.030, 1.376), (0.090, 1.366), (0.150, 1.326), (0.196, 1.266),
                (0.204, 1.176), (0.180, 1.098), (0.128, 1.058), (0.078, 1.068),
                (0.040, 1.120), (0.028, 1.240)],
        "side": "back", "band": 0.0045,
    }]),
    "Upper Back": mirror([{
        "pts": [(0.016, 1.396), (0.086, 1.404), (0.144, 1.368), (0.158, 1.300),
                (0.136, 1.246), (0.086, 1.226), (0.040, 1.244), (0.014, 1.310)],
        "side": "back", "band": 0.0045,
    }]),
    "Lower Back": mirror([{
        "pts": [(0.020, 1.180), (0.088, 1.170), (0.098, 1.062), (0.070, 1.000),
                (0.030, 1.010), (0.016, 1.090)],
        "side": "back", "band": 0.0045,
    }]),
    "Glutes": mirror([{
        "pts": [(0.006, 1.012), (0.070, 1.020), (0.130, 1.000), (0.170, 0.952),
                (0.158, 0.880), (0.118, 0.840), (0.058, 0.836), (0.018, 0.872)],
        "side": "back", "band": 0.0045,
    }]),
    "Hamstrings": mirror([{
        "pts": [(0.030, 0.860), (0.098, 0.880), (0.162, 0.856), (0.198, 0.788),
                (0.200, 0.688), (0.188, 0.588), (0.168, 0.518), (0.126, 0.502),
                (0.082, 0.518), (0.048, 0.588), (0.032, 0.700)],
        "side": "back", "band": 0.0045,
    }]),
    "Calves": mirror([{
        "pts": [(0.112, 0.445), (0.168, 0.455), (0.212, 0.420), (0.230, 0.350),
                (0.226, 0.240), (0.212, 0.150), (0.176, 0.128), (0.145, 0.165),
                (0.128, 0.265), (0.112, 0.360)],
        "side": "back", "band": 0.0045,
    }]),
    "Abductors": mirror([{
        "pts": [(0.106, 1.026), (0.156, 1.038), (0.190, 0.992), (0.184, 0.926),
                (0.142, 0.900), (0.112, 0.936)],
        "side": "front", "band": 0.0045,
    }]),
    "Adductors": mirror([{
        "pts": [(0.020, 0.842), (0.070, 0.852), (0.096, 0.782), (0.090, 0.662),
                (0.068, 0.570), (0.038, 0.558), (0.020, 0.640), (0.016, 0.752)],
        "side": "front", "band": 0.0045,
    }]),
    # two sternocleidomastoid columns; the throat between them stays skin
    "Neck": mirror([{
        "pts": [(0.030, 1.566), (0.064, 1.556), (0.058, 1.500), (0.040, 1.470),
                (0.016, 1.448), (0.008, 1.472), (0.024, 1.508)],
        "side": "front", "band": 0.0045,
    }]),
    "Full-Body": [{"pts": [(-9, -9), (9, -9), (9, 9), (-9, 9)], "band": 0.0045}],
}

CREASES = {
    "Abs": [
        [(-0.092, 1.166), (0.092, 1.166)],
        [(-0.090, 1.102), (0.090, 1.102)],
        [(-0.084, 1.042), (0.084, 1.042)],
        [(0.0, 1.220), (0.0, 0.998)],
    ],
    "Quadriceps": [
        [(0.100, 0.892), (0.106, 0.810), (0.110, 0.724), (0.112, 0.646), (0.112, 0.592)],
        [(0.064, 0.860), (0.068, 0.786), (0.076, 0.706), (0.086, 0.642), (0.098, 0.600)],
    ],
    "Chest": [
        [(0.020, 1.300), (0.070, 1.246), (0.120, 1.232), (0.160, 1.248)],
    ],
    "Hamstrings": [
        [(0.100, 0.850), (0.106, 0.740), (0.108, 0.640), (0.108, 0.540)],
    ],
    "Glutes": [
        [(0.006, 0.980), (0.040, 0.940), (0.090, 0.918), (0.140, 0.918)],
    ],
    "Calves": [
        [(0.170, 0.430), (0.172, 0.340), (0.172, 0.250), (0.168, 0.160)],
    ],
    "Biceps": [
        [(0.250, 1.330), (0.272, 1.250), (0.292, 1.170)],
    ],
    "Triceps": [
        [(0.246, 1.330), (0.272, 1.244), (0.296, 1.160)],
    ],
}

FIBRE_AXIS = {
    "Chest": "x", "Abs": "z", "Quadriceps": "z", "Middle Delts": "x",
    "Front Delts": "x", "Rear Delts": "x", "Biceps": "z", "Triceps": "z",
    "Forearms": "z", "Lats": "z", "Upper Back": "x", "Lower Back": "z",
    "Glutes": "x", "Hamstrings": "z", "Calves": "z", "Abductors": "x",
    "Adductors": "z", "Neck": "z", "Full-Body": "z",
}

FRAMING = {
    "Chest": (1.360, 0.960, "front"),
    "Abs": (1.290, 0.900, "front"),
    "Quadriceps": (0.520, 1.000, "front"),
    "Middle Delts": (1.350, 0.880, "front"),
    "Front Delts": (1.380, 0.820, "front"),
    "Rear Delts": (1.380, 0.820, "back"),
    "Biceps": (1.220, 0.760, "front"),
    "Triceps": (1.220, 0.760, "back"),
    "Forearms": (1.020, 0.960, "front"),
    "Lats": (1.220, 1.020, "back"),
    "Upper Back": (1.320, 0.860, "back"),
    "Lower Back": (1.110, 0.660, "back"),
    "Glutes": (0.930, 0.700, "back"),
    "Hamstrings": (0.700, 0.760, "back"),
    "Calves": (0.300, 0.560, "back"),
    "Abductors": (0.980, 0.820, "front"),
    "Adductors": (0.720, 0.720, "front"),
    "Neck": (1.550, 0.560, "front"),
    "Full-Body": (0.900, 1.900, "front"),
}

parts = REGIONS[ICON]
axis = FIBRE_AXIS[ICON]

attr = body.data.color_attributes.new(name="mask", type="FLOAT_COLOR", domain="POINT")
def weight_of(v, p):
    side = p.get("side", "both")
    x = -v.co.x if side == "back" else v.co.x
    w = poly_eval(x, v.co.z, p["pts"], p.get("band", 0.006))
    if side == "front":
        w *= ss(-v.normal.y, -0.15, 0.05)
    elif side == "back":
        w *= ss(v.normal.y, -0.15, 0.05)
    return w


weights = [max((weight_of(v, p) for p in parts), default=0.0) for v in body.data.vertices]

adj = [[] for _ in body.data.vertices]
for e in body.data.edges:
    a, b = e.vertices
    adj[a].append(b)
    adj[b].append(a)
for _ in range(2):
    weights = [(weights[i] * 2 + sum(weights[j] for j in adj[i])) / (2 + len(adj[i]))
               for i in range(len(weights))]


def seg_dist(x, z, a, b):
    ax, az = a
    bx, bz = b
    dx, dz = bx - ax, bz - az
    L2 = dx * dx + dz * dz
    t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((x - ax) * dx + (z - az) * dz) / L2))
    return math.hypot(x - (ax + t * dx), z - (az + t * dz))


def crease_field(p, lines, width=0.011):
    if not lines:
        return 0.0
    d = min(seg_dist(p.x, p.z, ln[i], ln[i + 1]) for ln in lines for i in range(len(ln) - 1))
    return 1.0 - ss(d, width * 0.35, width)


def fibre(p, axis):
    a, b = (p.x, p.z) if axis == "x" else (p.z, p.x)
    f = 0.5 + 0.25 * math.sin(a * 190 + 2.1 * math.sin(b * 41)) \
              + 0.25 * math.sin(a * 103 + 1.7 * math.sin(b * 63))
    m = 0.5 + 0.5 * math.sin(a * 26 + b * 11 + 1.3)
    return 0.86 + 0.10 * f + 0.04 * m


SKIN_RGB = (0.56, 0.57, 0.59)
col_dark = body.data.color_attributes.new(name="col", type="FLOAT_COLOR", domain="POINT")
col_light = body.data.color_attributes.new(name="colL", type="FLOAT_COLOR", domain="POINT")

for v in body.data.vertices:
    w = weights[v.index]
    mix = ss(w, 0.06, 0.58)
    rim = 0.60 + 0.40 * ss(w, 0.30, 0.85)
    line = crease_field(v.co, CREASES.get(ICON, []))
    detail = fibre(v.co, axis) * rim * (1.0 - 0.42 * line)
    for layer, tone in ((col_dark, DARK_RGB), (col_light, LIGHT_RGB)):
        col = tuple(SKIN_RGB[i] * (1.0 - mix) + tone[i] * detail * mix for i in range(3))
        layer.data[v.index].color = (*col, 1.0)
    attr.data[v.index].color = (1.0, 1.0, 1.0, w)

print(f"[icon] {ICON}: {sum(1 for w in weights if w > 0.5)} / {len(weights)} verts")

# ------------------------------------------------------------------- materials
skin = bpy.data.materials.new("Skin")
skin.use_nodes = True
b = skin.node_tree.nodes["Principled BSDF"]
b.inputs["Base Color"].default_value = (0.56, 0.57, 0.59, 1.0)
b.inputs["Roughness"].default_value = 0.52
if "Specular IOR Level" in b.inputs:
    b.inputs["Specular IOR Level"].default_value = 0.28
body.data.materials.append(skin)


def muscle_mat(name, rgb, layer="col"):
    """Opaque material: skin where the mask is 0, painted muscle where it is 1."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.55

    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = layer
    nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])

    vm = nt.nodes.new("ShaderNodeVertexColor")
    vm.layer_name = "mask"

    def lerp_into(socket_name, lo, hi):
        mul = nt.nodes.new("ShaderNodeMath")
        mul.operation = "MULTIPLY"
        mul.inputs[1].default_value = hi - lo
        add = nt.nodes.new("ShaderNodeMath")
        add.operation = "ADD"
        add.inputs[1].default_value = lo
        nt.links.new(vm.outputs["Alpha"], mul.inputs[0])
        nt.links.new(mul.outputs[0], add.inputs[0])
        nt.links.new(add.outputs[0], bsdf.inputs[socket_name])

    lerp_into("Roughness", 0.52, 0.68)
    if "Specular IOR Level" in bsdf.inputs:
        lerp_into("Specular IOR Level", 0.28, 0.10)
    return m


body.data.materials.append(muscle_mat("MuscleDark", DARK_RGB, "col"))
body.data.materials.append(muscle_mat("MuscleLight", LIGHT_RGB, "colL"))

eye_mat = bpy.data.materials.new("Eye")
eye_mat.use_nodes = True
eb = eye_mat.node_tree.nodes["Principled BSDF"]
eb.inputs["Base Color"].default_value = (0.42, 0.43, 0.45, 1.0)
eb.inputs["Roughness"].default_value = 0.25
for e in eyes:
    e.data.materials.append(eye_mat)

# ------------------------------------------------------------------- studio
scene.render.engine = "CYCLES"
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.cycles.device = "CPU"
scene.render.film_transparent = True
scene.render.resolution_x = RES
scene.render.resolution_y = RES
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.view_transform = "Standard"

world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.13, 0.13, 0.14, 1.0)
bg.inputs[1].default_value = 0.30


def area(name, loc, rot, size, energy):
    d = bpy.data.lights.new(name, "AREA")
    d.shape = "DISK"
    d.size = size
    d.energy = energy
    o = bpy.data.objects.new(name, d)
    o.location = loc
    o.rotation_euler = rot
    scene.collection.objects.link(o)


area("Key", (-1.9, -2.4, 2.7), (math.radians(50), 0, math.radians(-38)), 2.6, 145)
area("Fill", (2.4, -1.8, 1.3), (math.radians(80), 0, math.radians(58)), 3.4, 30)
area("Rim", (0.6, 2.8, 2.1), (math.radians(120), 0, math.radians(172)), 2.2, 85)

z, scale, view = FRAMING[ICON]
if view == "back":
    for o in scene.objects:
        if o.type == "LIGHT":
            o.location = (-o.location.x, -o.location.y, o.location.z)
            o.rotation_euler.z += math.pi
cam_data = bpy.data.cameras.new("Cam")
cam_data.type = "ORTHO"
cam = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
cam_data.ortho_scale = scale
if view == "front":
    cam.location, cam.rotation_euler = (0.0, -4.0, z), (math.radians(90), 0, 0)
else:
    cam.location, cam.rotation_euler = (0.0, 4.0, z), (math.radians(90), 0, math.radians(180))


def render(mat_index, path):
    for poly in body.data.polygons:
        poly.material_index = mat_index
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


render(0, f"{OUT}-body.png")
render(1, f"{OUT}-muscle-dark.png")
render(2, f"{OUT}-muscle-light.png")
print(f"[icon] wrote {OUT}-*.png")

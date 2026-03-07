from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIRS = [ROOT / "icons", ROOT / "frontend-lite" / "public"]
MASTER_SIZE = 4096
RESAMPLE = Image.Resampling.LANCZOS

ANY_PETALS = [
    ((138, 215, 255, 255), (67, 148, 232, 255), 45),
    ((112, 198, 255, 255), (31, 97, 192, 255), 135),
    ((93, 182, 255, 255), (19, 72, 149, 255), 225),
    ((166, 225, 255, 255), (43, 108, 199, 255), 315),
]
MASKABLE_PETALS = [
    ((244, 251, 255, 255), (134, 212, 255, 255), 45),
    ((231, 246, 255, 255), (108, 190, 255, 255), 135),
    ((214, 239, 255, 255), (74, 164, 255, 255), 225),
    ((248, 253, 255, 255), (158, 220, 255, 255), 315),
]


def gradient_image(size, start, end, angle):
    mask = Image.linear_gradient("L").resize((size, size), RESAMPLE)
    if angle:
        mask = mask.rotate(angle, resample=Image.Resampling.BICUBIC)
    return Image.composite(Image.new("RGBA", (size, size), end), Image.new("RGBA", (size, size), start), mask)


def tint_mask(mask, color):
    layer = Image.new("RGBA", mask.size, color)
    layer.putalpha(mask)
    return layer


def circle_mask(size, box):
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse(box, fill=255)
    return mask


def petal_mask(size, angle, scale=1.0, stroke_scale=1.0):
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    cx = size * 0.5
    cy = size * (0.5 - 0.214 * scale)
    rx = size * 0.136 * scale
    ry = size * 0.228 * scale
    stroke = max(12, round(size * 0.084 * scale * stroke_scale))
    draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), outline=255, width=stroke)
    node_r = size * 0.047 * scale
    node_cy = size * (0.5 - 0.108 * scale)
    draw.ellipse((cx - node_r, node_cy - node_r, cx + node_r, node_cy + node_r), fill=255)
    return mask.rotate(angle, resample=Image.Resampling.BICUBIC)


def soft_glow(size, box, color, blur):
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse(box, fill=color)
    return layer.filter(ImageFilter.GaussianBlur(blur))


def build_symbol(size, petals, core_outer, core_inner, scale=1.0, shadow_alpha=90, shadow_offset=(0.012, 0.022)):
    symbol = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    combined_mask = Image.new("L", (size, size), 0)

    for (_, _, angle) in petals:
        combined_mask = ImageChops.lighter(combined_mask, petal_mask(size, angle, scale=scale))

    core_radius = size * 0.094 * scale
    core_box = (
        size * 0.5 - core_radius,
        size * 0.5 - core_radius,
        size * 0.5 + core_radius,
        size * 0.5 + core_radius,
    )
    combined_mask = ImageChops.lighter(combined_mask, circle_mask(size, core_box))

    shadow = combined_mask.filter(ImageFilter.GaussianBlur(size * 0.018))
    shadow = ImageChops.offset(shadow, int(size * shadow_offset[0]), int(size * shadow_offset[1]))
    symbol.alpha_composite(tint_mask(shadow, (6, 18, 44, shadow_alpha)))

    for start, end, angle in petals:
        mask = petal_mask(size, angle, scale=scale)
        fill = gradient_image(size, start, end, angle + 48)
        symbol.alpha_composite(Image.composite(fill, Image.new("RGBA", (size, size), (0, 0, 0, 0)), mask))

        highlight_mask = petal_mask(size, angle, scale=scale * 0.994, stroke_scale=0.42).filter(
            ImageFilter.GaussianBlur(size * 0.0025)
        )
        symbol.alpha_composite(tint_mask(highlight_mask, (255, 255, 255, 68)))

    core_glow = circle_mask(
        size,
        (
            size * 0.5 - size * 0.118 * scale,
            size * 0.5 - size * 0.118 * scale,
            size * 0.5 + size * 0.118 * scale,
            size * 0.5 + size * 0.118 * scale,
        ),
    ).filter(ImageFilter.GaussianBlur(size * 0.018))
    symbol.alpha_composite(tint_mask(core_glow, (255, 221, 121, 80)))

    core_fill = gradient_image(size, core_inner, core_outer, -46)
    symbol.alpha_composite(Image.composite(core_fill, Image.new("RGBA", (size, size), (0, 0, 0, 0)), circle_mask(size, core_box)))

    highlight_box = (
        size * 0.5 - size * 0.056 * scale,
        size * 0.5 - size * 0.078 * scale,
        size * 0.5,
        size * 0.5 - size * 0.02 * scale,
    )
    symbol.alpha_composite(soft_glow(size, highlight_box, (255, 248, 221, 170), size * 0.006))
    return symbol


def build_any_icon(size):
    return build_symbol(
        size,
        ANY_PETALS,
        core_outer=(198, 132, 38, 255),
        core_inner=(255, 247, 191, 255),
        scale=1.0,
        shadow_alpha=92,
    )


def build_monochrome_icon(size):
    symbol = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    for angle in (45, 135, 225, 315):
        symbol.alpha_composite(tint_mask(petal_mask(size, angle, scale=1.03), (0, 0, 0, 255)))

    core_radius = size * 0.103
    ImageDraw.Draw(symbol).ellipse(
        (
            size * 0.5 - core_radius,
            size * 0.5 - core_radius,
            size * 0.5 + core_radius,
            size * 0.5 + core_radius,
        ),
        fill=(0, 0, 0, 255),
    )
    return symbol


def build_maskable_icon(size):
    background = gradient_image(size, (9, 26, 63, 255), (20, 71, 143, 255), -90)
    background.alpha_composite(
        soft_glow(size, (size * 0.54, size * 0.02, size * 1.02, size * 0.5), (104, 187, 255, 120), size * 0.08)
    )
    background.alpha_composite(
        soft_glow(size, (size * -0.08, size * 0.58, size * 0.44, size * 1.1), (24, 84, 174, 118), size * 0.09)
    )
    background.alpha_composite(
        soft_glow(size, (size * 0.2, size * 0.18, size * 0.8, size * 0.78), (255, 221, 128, 22), size * 0.02)
    )

    ring = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse(
        (size * 0.14, size * 0.14, size * 0.86, size * 0.86),
        outline=(255, 255, 255, 28),
        width=max(4, round(size * 0.016)),
    )
    background.alpha_composite(ring)
    background.alpha_composite(
        build_symbol(
            size,
            MASKABLE_PETALS,
            core_outer=(210, 144, 39, 255),
            core_inner=(255, 248, 210, 255),
            scale=1.1,
            shadow_alpha=120,
            shadow_offset=(0.0, 0.024),
        )
    )
    return background


def save_png(image, path, size):
    image.resize((size, size), RESAMPLE).save(path, format="PNG", optimize=True)


def generate():
    any_master = build_any_icon(MASTER_SIZE)
    monochrome_master = build_monochrome_icon(MASTER_SIZE)
    maskable_master = build_maskable_icon(MASTER_SIZE)

    for output_dir in OUTPUT_DIRS:
        save_png(any_master, output_dir / "favicon-16x16.png", 16)
        save_png(any_master, output_dir / "favicon-32x32.png", 32)
        save_png(any_master, output_dir / "icon-192.png", 192)
        save_png(any_master, output_dir / "icon-512.png", 512)
        save_png(any_master, output_dir / "icon-1024.png", 1024)
        save_png(any_master, output_dir / "icon-2048.png", 2048)
        save_png(maskable_master, output_dir / "icon-192-maskable.png", 192)
        save_png(maskable_master, output_dir / "icon-512-maskable.png", 512)
        save_png(maskable_master, output_dir / "icon-1024-maskable.png", 1024)
        save_png(maskable_master, output_dir / "icon-2048-maskable.png", 2048)
        save_png(monochrome_master, output_dir / "icon-192-monochrome.png", 192)
        save_png(monochrome_master, output_dir / "icon-512-monochrome.png", 512)
        save_png(maskable_master, output_dir / "apple-touch-icon.png", 180)


if __name__ == "__main__":
    generate()

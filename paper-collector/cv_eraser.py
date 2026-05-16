#!/usr/bin/env python3
"""
cv_eraser.py — 纯 OpenCV 本地笔迹擦除（无需 API Key）

策略：
  1. HSV 色域过滤：识别红笔 / 蓝笔等彩色笔迹 → mask_color
  2. 连通域分析：在灰度二值图中，按笔画粗细 / 面积 / 长宽比
     区分印刷体（小、均匀）和手写体（大、不规则） → mask_hw
  3. 合并 mask 后用 cv2.inpaint 修复，输出干净图片

用法：
  python3 cv_eraser.py raw.jpg
  python3 cv_eraser.py raw.jpg --out cleaned/result.jpg --save-mask
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2
import numpy as np


# ──────────────────────────────────────────────
# 1. 色彩笔迹检测（红 / 蓝 / 绿 / 橙等彩色笔）
# ──────────────────────────────────────────────

def detect_color_ink(bgr: np.ndarray) -> np.ndarray:
    """
    检测非黑非白的彩色笔迹（主要是红笔批改）。
    返回 uint8 mask，255 = 彩色笔迹区域。
    """
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)

    # 红色（HSV 两段）
    red1 = cv2.inRange(hsv, (0,   60, 60), (10,  255, 255))
    red2 = cv2.inRange(hsv, (165, 60, 60), (180, 255, 255))
    mask_red = cv2.bitwise_or(red1, red2)

    # 蓝色笔迹
    mask_blue = cv2.inRange(hsv, (100, 60, 60), (135, 255, 255))

    # 绿色批注
    mask_green = cv2.inRange(hsv, (40, 60, 60), (80, 255, 255))

    # 橙色 / 黄色荧光
    mask_orange = cv2.inRange(hsv, (10, 80, 100), (30, 255, 255))

    mask = cv2.bitwise_or(mask_red, mask_blue)
    mask = cv2.bitwise_or(mask, mask_green)
    mask = cv2.bitwise_or(mask, mask_orange)

    # 膨胀，覆盖笔迹边缘
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    mask = cv2.dilate(mask, kernel, iterations=2)
    return mask


# ──────────────────────────────────────────────
# 2. 手写黑/深色笔迹检测（连通域分析）
# ──────────────────────────────────────────────

def detect_dark_handwriting(bgr: np.ndarray, color_mask: np.ndarray) -> np.ndarray:
    """
    在黑色/深色笔迹中，区分印刷体与手写体。

    原理：
    - 印刷字符：笔画细（stroke width 小）、字符面积小、高宽比接近方形
    - 手写笔迹：笔画粗、面积大、形状不规则、常出现在横线区域

    返回 uint8 mask，255 = 疑似手写区域。
    """
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    # --- 自适应二值化（OTSU + 高斯模糊）---
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    _, binary = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # 去掉已由颜色 mask 覆盖的区域，避免重复处理
    binary = cv2.bitwise_and(binary, cv2.bitwise_not(color_mask))

    # --- 连通域分析 ---
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)

    mask_hw = np.zeros_like(binary)

    # 图片面积用于相对阈值
    img_area = h * w

    for i in range(1, num_labels):          # 跳过背景 label=0
        x, y, cw, ch, area = (
            stats[i, cv2.CC_STAT_LEFT],
            stats[i, cv2.CC_STAT_TOP],
            stats[i, cv2.CC_STAT_WIDTH],
            stats[i, cv2.CC_STAT_HEIGHT],
            stats[i, cv2.CC_STAT_AREA],
        )

        # ── 过滤极小噪点（< 15 px）──
        if area < 15:
            continue

        # ── 过滤极大区域（可能是印刷图形边框，> 图片 0.5%）──
        if area > img_area * 0.005:
            continue

        aspect = max(cw, ch) / (min(cw, ch) + 1e-6)
        solidity = area / (cw * ch + 1e-6)    # 密实度

        # ── 手写判据（满足任一）──
        is_handwriting = False

        # 1) 面积较大（> 200 px）且密实度低（笔迹稀疏）
        if area > 200 and solidity < 0.45:
            is_handwriting = True

        # 2) bbox 较大（高或宽 > 30 px）且非极端长条（印刷下划线）
        if ch > 30 and aspect < 8:
            is_handwriting = True
        if cw > 60 and ch > 15 and aspect < 12:
            is_handwriting = True

        # 3) 笔画很粗：像素密度高且面积中等偏大
        if area > 150 and solidity > 0.65 and (cw > 25 or ch > 25):
            is_handwriting = True

        # ── 反向排除：典型印刷字符（小、方、密实）──
        if area < 80 and 0.3 < aspect < 4 and solidity > 0.3:
            is_handwriting = False
        if area < 120 and ch < 20 and cw < 20:
            is_handwriting = False

        if is_handwriting:
            component_mask = (labels == i).astype(np.uint8) * 255
            mask_hw = cv2.bitwise_or(mask_hw, component_mask)

    # 轻微膨胀，覆盖笔迹边缘
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask_hw = cv2.dilate(mask_hw, kernel, iterations=1)
    return mask_hw


# ──────────────────────────────────────────────
# 3. 主擦除函数
# ──────────────────────────────────────────────

def erase_handwriting(
    image_path: Path,
    output_path: Path,
    save_mask: bool = False,
    inpaint_radius: int = 7,
    verbose: bool = True,
) -> Path:
    def log(msg: str):
        if verbose:
            print(msg)

    log(f"\n[cv_eraser] 处理: {image_path.name}")

    bgr = cv2.imread(str(image_path))
    if bgr is None:
        raise FileNotFoundError(f"无法读取图片: {image_path}")
    h, w = bgr.shape[:2]
    log(f"  图片尺寸: {w}×{h}")

    # Step 1: 彩色笔迹
    log("  → 检测彩色笔迹（红/蓝/绿）...")
    mask_color = detect_color_ink(bgr)
    log(f"     覆盖 {np.count_nonzero(mask_color)} px")

    # Step 2: 深色手写笔迹
    log("  → 连通域分析手写笔迹...")
    mask_dark = detect_dark_handwriting(bgr, mask_color)
    log(f"     覆盖 {np.count_nonzero(mask_dark)} px")

    # 合并 mask
    mask_total = cv2.bitwise_or(mask_color, mask_dark)
    total_px = int(np.count_nonzero(mask_total))
    log(f"  → 合并 mask 共 {total_px} px ({total_px/(h*w)*100:.2f}%)")

    # 保存 mask（可选）
    if save_mask:
        mask_path = output_path.with_stem(output_path.stem + "_mask").with_suffix(".png")
        cv2.imwrite(str(mask_path), mask_total)
        log(f"  → mask 已保存: {mask_path}")

    # Step 3: inpaint 修复
    log(f"  → inpaint 修复 (radius={inpaint_radius})...")
    result = cv2.inpaint(bgr, mask_total, inpaintRadius=inpaint_radius, flags=cv2.INPAINT_TELEA)

    # 保存
    ext = output_path.suffix.lower()
    if ext in (".jpg", ".jpeg"):
        cv2.imwrite(str(output_path), result, [int(cv2.IMWRITE_JPEG_QUALITY), 97])
    else:
        cv2.imwrite(str(output_path), result)

    log(f"  → 完成，已保存: {output_path}")
    return output_path


# ──────────────────────────────────────────────
# 命令行入口
# ──────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        prog="cv_eraser",
        description="纯 OpenCV 笔迹擦除（无需 API Key）",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("input", help="输入图片路径")
    parser.add_argument("--out", "-o", default=None, help="输出路径（默认 cleaned/<name>_cv_erased.jpg）")
    parser.add_argument("--save-mask", action="store_true", help="同时保存合并后的 mask")
    parser.add_argument("--inpaint-radius", type=int, default=7, help="inpaint 半径")
    parser.add_argument("--quiet", "-q", action="store_true")
    args = parser.parse_args()

    image_path = Path(args.input).expanduser().resolve()
    if not image_path.exists():
        print(f"错误：找不到文件 {image_path}", file=sys.stderr)
        sys.exit(1)

    if args.out:
        output_path = Path(args.out).expanduser().resolve()
    else:
        out_dir = image_path.parent / "cleaned"
        out_dir.mkdir(exist_ok=True)
        output_path = out_dir / f"{image_path.stem}_cv_erased{image_path.suffix}"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    erase_handwriting(
        image_path,
        output_path,
        save_mask=args.save_mask,
        inpaint_radius=args.inpaint_radius,
        verbose=not args.quiet,
    )


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Handwriting Eraser Agent
========================

支持两类后端：

local（默认，无需 API Key）
    纯 OpenCV 规则管线，参考 ChatGPT 效果图优化：
      1. HSV 彩色笔迹（红/蓝批改）→ 白填（扩大检测范围）
      2. 背景归一化（去阴影、白化纸张）
      3. 填空横线附近答案擦除（加宽检测带，提高面积上限）
      4. 稀疏行手写 / 行尾填空分区擦除
      5. 底部解答草稿整块白填
      6. Sauvola 自适应阈值漂白（终极背景净化）
      7. 题号栏保护恢复
      8. 照片外缘清理

LLM 增强（需 ANTHROPIC_API_KEY / OPENAI_API_KEY）
    provider=anthropic / openai：先用视觉模型精准定位手写区域（返回归一化 bbox），
    再把 bbox mask 与本地 OpenCV mask 合并，统一执行擦除。

用法示例：
  # 本地管线（推荐，无需 API Key）
  python handwriting_eraser_agent.py raw.jpg

  # LLM 增强
  python handwriting_eraser_agent.py raw.jpg --provider anthropic
  python handwriting_eraser_agent.py raw.jpg --provider openai

  # 额外选项
  python handwriting_eraser_agent.py raw.jpg --save-mask --out cleaned/out.jpg
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import Image as PILImage   # noqa: F401 – kept for optional use

# ============================================================
# OpenCV 图像处理管线（从 exam_scanner.py 提炼）
# ============================================================

def _build_colored_ink_mask(img: np.ndarray) -> np.ndarray:
    """
    检测彩色批改笔迹 mask（红笔为主，兼容橙红/深红/蓝/紫笔）。

    相比旧版降低了饱和度和亮度阈值，覆盖更暗的红笔和墨水干燥后的深红色。
    """
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    # 鲜红 + 深红（两段，扩大 S/V 下限以捕获较暗的批改笔迹）
    red = cv2.bitwise_or(
        cv2.inRange(hsv, np.array([0,   70, 50], np.uint8), np.array([10,  255, 255], np.uint8)),
        cv2.inRange(hsv, np.array([165, 70, 50], np.uint8), np.array([180, 255, 255], np.uint8)),
    )
    # 蓝紫色（学生修改答案）
    blue_purple = cv2.inRange(
        hsv,
        np.array([100, 70, 40], np.uint8),
        np.array([155, 255, 230], np.uint8),
    )
    # 注意：不检测橙色范围（H 10-25°），避免误擦印刷题号橙色圆圈
    mask = cv2.bitwise_or(red, blue_purple)
    return _filter_small_pen_components(mask)


def _filter_small_pen_components(mask: np.ndarray) -> np.ndarray:
    """过滤颜色噪点和大面积色块，只保留像笔画的连通域。"""
    num, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    filtered = np.zeros_like(mask)
    for i in range(1, num):
        x, y, ww, hh, area = stats[i]
        if area < 8:
            continue
        fill_ratio = area / float(max(1, ww * hh))
        long_side  = max(ww, hh)
        short_side = min(ww, hh)
        # 放宽面积上限（5000→8000），允许圈注等较大笔迹
        if area <= 8000 and long_side >= 3 and short_side <= 160 and fill_ratio <= 0.80:
            filtered[labels == i] = 255
    return filtered


def _squeeze_gray_to_bnw(gray: np.ndarray) -> np.ndarray:
    """将接近纸白的中灰压成 255，墨迹压更黑，减少雾霾感。"""
    lo, hi = 115, 238
    out = (gray.astype(np.float32) - lo) / (hi - lo) * 255.0
    out = np.clip(out, 0, 255).astype(np.uint8)
    out[out > 200] = 255
    return out


def _normalize_document_background(img: np.ndarray) -> np.ndarray:
    """
    背景归一化：纸张趋近纯白，印刷墨迹趋近黑色。
    禁用全局锐化，避免白色边缘被拉回灰值。
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    bg_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (61, 61))
    background = cv2.dilate(gray, bg_kernel)
    background = np.where(background == 0, 1, background).astype(np.float32)
    norm = gray.astype(np.float32) / background * 255.0
    norm = np.clip(norm, 0, 255).astype(np.uint8)
    norm[norm > 210] = 255
    result_gray = _squeeze_gray_to_bnw(norm)
    return cv2.cvtColor(result_gray, cv2.COLOR_GRAY2BGR)


def _erase_colored_ink(img: np.ndarray) -> np.ndarray:
    """HSV 颜色检测 → 白填擦除彩色批改笔迹。"""
    colored_mask = _build_colored_ink_mask(img)
    px = int(np.count_nonzero(colored_mask))
    total = img.shape[0] * img.shape[1]
    print(f"    检测到彩色笔迹: {px} px ({px / total * 100:.2f}%)")
    if px < 50:
        return img.copy()
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    colored_mask = cv2.dilate(colored_mask, k, iterations=1)
    result = img.copy()
    result[colored_mask > 0] = [255, 255, 255]
    return result


def _build_blank_line_answer_mask(
    img: np.ndarray,
    *,
    band_frac: float = 0.80,
    verbose: bool = True,
) -> np.ndarray:
    """
    识别填空横线附近的手写答案，返回待擦除 mask。

    相比旧版改进：
    - band_frac 0.74 → 0.80，覆盖更靠右的答案
    - 检测带高度 21 → 35px，覆盖横线上方更多笔迹
    - 组件面积上限 520 → 1200，包含较大的手写字符
    - 组件高度上限 28 → 42px
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    cut = max(24, min(w - 1, int(round(w * band_frac))))
    left = gray[:, :cut]

    _, dark = cv2.threshold(left, 185, 255, cv2.THRESH_BINARY_INV)
    line_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1))
    hlines = cv2.morphologyEx(dark, cv2.MORPH_OPEN, line_kernel)

    num, labels, stats, _ = cv2.connectedComponentsWithStats(hlines, connectivity=8)
    keep_lines = np.zeros_like(hlines)
    for i in range(1, num):
        x, y, ww, hh, area = stats[i]
        if ww >= 28 and hh <= 6 and area >= 20:
            keep_lines[labels == i] = 255

    if np.count_nonzero(keep_lines) == 0:
        if verbose:
            print("    步骤A0 未检测到可处理填空线")
        return np.zeros((h, w), dtype=np.uint8)

    # 上方扩大带（答案通常写在横线上方）
    band_kernel    = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 35))
    line_band      = cv2.dilate(keep_lines, band_kernel)
    protected_line = cv2.dilate(keep_lines, cv2.getStructuringElement(cv2.MORPH_RECT, (9, 4)))

    erase = cv2.bitwise_and(dark, line_band)
    erase[protected_line > 0] = 0

    num_e, labels_e, stats_e, _ = cv2.connectedComponentsWithStats(erase, connectivity=8)
    filtered = np.zeros_like(erase)
    for i in range(1, num_e):
        x, y, ww, hh, area = stats_e[i]
        # 放宽面积和尺寸上限，覆盖较大的手写数字/文字
        if 3 <= area <= 1200 and ww <= 180 and hh <= 42:
            filtered[labels_e == i] = 255
    erase = cv2.dilate(filtered, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (4, 4)))

    if verbose:
        print(f"    步骤A0 填空线邻域白填像素: {int(np.count_nonzero(erase))} px")

    erase_full = np.zeros((h, w), dtype=np.uint8)
    erase_full[:, :cut] = erase
    return erase_full


def _erase_answers_around_blank_lines(
    img: np.ndarray,
    *,
    band_frac: float = 0.74,
) -> np.ndarray:
    """对填空横线附近做局部擦除：保留长横线，擦掉横线上下的短手写笔画。"""
    erase_full = _build_blank_line_answer_mask(img, band_frac=band_frac, verbose=True)
    if np.count_nonzero(erase_full) == 0:
        return img
    result = img.copy()
    result[erase_full > 0] = [255, 255, 255]
    return result


def _erase_solution_block(
    img: np.ndarray,
    row_density: np.ndarray,
    h: int,
    w: int,
) -> np.ndarray:
    """白填页面下方「大段手写解题草稿区」。"""
    SEARCH_TOP  = int(h * 0.62)
    WINDOW      = 30
    HW_LO, HW_HI = 0.0005, 0.08
    MIN_ROWS    = 120

    result = img.copy()
    if h - WINDOW <= SEARCH_TOP:
        print("    步骤B 跳过（图像过矮）")
        return result

    run_start, intervals = None, []
    for y in range(SEARCH_TOP, h - WINDOW):
        ok = HW_LO < float(row_density[y: y + WINDOW].mean()) < HW_HI
        if ok:
            if run_start is None:
                run_start = y
        elif run_start is not None:
            intervals.append((run_start, y - 1))
            run_start = None
    if run_start is not None:
        intervals.append((run_start, h - WINDOW - 1))

    long = [(a, b, b - a + 1) for a, b in intervals if (b - a + 1) >= MIN_ROWS]
    if not long:
        print("    步骤B 未检测到独立解答区块")
        return result

    a, b, ln = max(long, key=lambda t: (t[2], t[0]))
    PAD_UP = max(108, WINDOW * 3)
    solution_start = max(int(h * 0.56), max(0, int(a - PAD_UP)))
    dense_print_rows = int(np.count_nonzero(row_density[solution_start:] > 0.035))

    if dense_print_rows > 12:
        safe_start = max(int(h * 0.78), solution_start)
        bottom_density = float(row_density[safe_start:].mean()) if safe_start < h else 0.0
        if safe_start < h - 80 and bottom_density > 0.0025:
            print(f"    步骤B 只白填更靠下草稿: y≥{safe_start}")
            result[safe_start:, :] = [255, 255, 255]
        else:
            print(f"    步骤B 跳过（y≥{solution_start} 仍有 {dense_print_rows} 行印刷题干）")
        return result

    print(f"    步骤B 解答区块 {a}~{b}（{ln} 行），上扩白填自 y≥{solution_start}")
    result[solution_start:, :] = [255, 255, 255]
    return result


def _erase_sparse_row_handwriting(
    img: np.ndarray,
    *,
    erase_sparse_rows: bool = True,
) -> np.ndarray:
    """
    左栏稀疏行 / 行尾填空分区擦除：
    - 整行稀疏（印刷密行保护带外）
    - 左侧印刷密 + 右侧行尾仅少量墨迹 → 只改写右半
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    proj_w = max(24, min(w - 1, int(round(w * 0.72))))
    gp = gray[:, :proj_w]

    _, bin_for_rows = cv2.threshold(gp, 198, 255, cv2.THRESH_BINARY_INV)
    row_black   = bin_for_rows.sum(axis=1).astype(np.float32) / 255.0
    row_density = row_black / proj_w

    PRINT_THRESH = 0.030
    SPARSE_LOW   = 0.0008
    is_sparse    = (row_density > SPARSE_LOW) & (row_density < PRINT_THRESH)
    is_dense     = row_density >= PRINT_THRESH

    protect = np.zeros(h, dtype=bool)
    for y in range(h):
        if is_dense[y]:
            protect[max(0, y - 3): min(h, y + 4)] = True
    is_sparse = is_sparse & ~protect
    if not erase_sparse_rows:
        is_sparse[:] = False

    print(f"    步骤A 整行稀疏: {int(is_sparse.sum())} 行（{'启用' if erase_sparse_rows else '禁用'}）")

    split_c = max(100, min(proj_w - 80, int(round(proj_w * 0.48))))
    _, bl_hs = cv2.threshold(gp[:, :split_c],  198, 255, cv2.THRESH_BINARY_INV)
    _, br_hs = cv2.threshold(gp[:, split_c:],  200, 255, cv2.THRESH_BINARY_INV)
    d_left  = bl_hs.sum(axis=1).astype(np.float32) / (255.0 * float(split_c))
    d_right = br_hs.sum(axis=1).astype(np.float32) / (255.0 * max(1.0, float(proj_w - split_c)))

    row_idx    = np.arange(h, dtype=np.int32)
    is_partial = (
        (row_idx > int(h * 0.05))
        & (d_left  >= 0.028)
        & (d_right >  0.0025)
        & (d_right <  0.055)
    )
    print(f"    步骤A 行尾填空分区: {int(is_partial.sum())} 行")

    erase_x_end = proj_w
    sparse_2d  = np.zeros((h, w), dtype=np.uint8)
    partial_2d = np.zeros((h, w), dtype=np.uint8)
    sparse_2d[is_sparse, :erase_x_end]         = 255
    partial_2d[is_partial, split_c:erase_x_end] = 255

    combined   = cv2.bitwise_or(sparse_2d[:, :erase_x_end], partial_2d[:, :erase_x_end])
    _, bin_erase = cv2.threshold(gray[:, :erase_x_end], 110, 255, cv2.THRESH_BINARY_INV)
    erase_mask = cv2.bitwise_and(bin_erase, combined)
    erase_mask = cv2.dilate(erase_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))

    print(f"    步骤A 白填像素（左栏）: {int(np.count_nonzero(erase_mask))} px")
    result = img.copy()
    erase_full = np.zeros((h, w), dtype=np.uint8)
    erase_full[:, :erase_x_end] = erase_mask
    result[erase_full > 0] = [255, 255, 255]

    # 底部解答块
    _, bin_sol = cv2.threshold(gp, 203, 255, cv2.THRESH_BINARY_INV)
    row_density_sol = bin_sol.sum(axis=1).astype(np.float32) / (255.0 * proj_w)
    result = _erase_solution_block(result, row_density_sol, h, w)
    return result


def _restore_question_number_strip(
    processed: np.ndarray,
    source: np.ndarray,
    *,
    strip_frac: float = 0.058,
) -> np.ndarray:
    """恢复左侧题号栏，避免橙色圆圈题号被当成背景抹掉。"""
    result = processed.copy()
    h, w = result.shape[:2]
    strip_w = max(84, min(int(round(w * strip_frac)), 118, w // 5))
    src = source
    if src.shape[:2] != result.shape[:2]:
        src = cv2.resize(src, (w, h), interpolation=cv2.INTER_AREA)
    result[:, :strip_w] = src[:, :strip_w]
    print(f"    题号栏保护: 恢复左侧 {strip_w}px")
    return result


def _clean_outer_photo_edges(img: np.ndarray) -> np.ndarray:
    """清掉手机拍摄边缘黑边/噪声。"""
    result = img.copy()
    h, w = result.shape[:2]
    ex = max(24, int(round(w * 0.012)))
    ey = max(8,  int(round(h * 0.006)))
    result[:, :ex]          = 255
    result[:, w - max(8, ex // 2):] = 255
    result[:ey, :]           = 255
    result[h - ey:, :]       = 255
    return result


def _bleach_document(img: np.ndarray, *, text_col_frac: float = 0.72) -> np.ndarray:
    """
    文档二次漂白：把左侧题干列经背景归一化后仍残留的「近白灰雾」
    （灰度 > 203）直接推到纯白 255，不改变任何深色（印刷墨迹/暗背景）像素。

    右侧图示列不处理，避免影响几何图形。
    """
    h, w = img.shape[:2]
    cut = min(w - 1, int(round(w * text_col_frac)))
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 左列灰度 > 203 → 纯白（只推亮，不压暗，安全无副作用）
    near_white = np.zeros((h, w), dtype=bool)
    near_white[:, :cut] = gray[:, :cut] > 203

    result = img.copy()
    result[near_white] = [255, 255, 255]
    return result


def _build_handwriting_erase_mask(img: np.ndarray) -> np.ndarray:
    """生成供 inpaint / 外部模型使用的合成 mask。"""
    h, w = img.shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)
    mask = cv2.bitwise_or(mask, _build_colored_ink_mask(img))
    normalized = _normalize_document_background(img)
    mask = cv2.bitwise_or(mask, _build_blank_line_answer_mask(normalized, verbose=False))

    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k)
    mask = cv2.dilate(mask, k)

    px = int(np.count_nonzero(mask))
    print(f"    合成擦除 mask: {px} px ({px / (h * w) * 100:.2f}%)")
    return mask


def run_local_pipeline(img: np.ndarray) -> np.ndarray:
    """
    纯 OpenCV 笔迹擦除管线（对标 ChatGPT 效果图优化版）。

    阶段 1  彩色批改笔迹（红/橙红/蓝/紫）→ 白填（扩大检测范围）
    阶段 2  背景归一化（去阴影、白化纸张）
    阶段 3  填空横线附近答案擦除（加宽检测带）
    阶段 4  稀疏行 / 行尾填空分区擦除 + 底部草稿整块白填
    阶段 5  Sauvola 自适应阈值漂白（终极背景净化）
    阶段 6  题号栏保护恢复
    阶段 7  照片外缘清理
    """
    print("  阶段 1/7: 彩色批改笔迹白填...")
    colored_mask = _build_colored_ink_mask(img)
    px = int(np.count_nonzero(colored_mask))
    print(f"    彩色 mask: {px} px ({px / (img.shape[0] * img.shape[1]) * 100:.2f}%)")
    k_dilate = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    colored_mask = cv2.dilate(colored_mask, k_dilate, iterations=1)
    stage1 = img.copy()
    stage1[colored_mask > 0] = [255, 255, 255]

    # 题号栏参考在归一化之前保存（保留彩色印刷圆圈的原色）
    question_strip_source = stage1.copy()

    print("  阶段 2/7: 背景归一化...")
    stage2 = _normalize_document_background(stage1)

    print("  阶段 3/7: 填空横线答案擦除...")
    stage3 = _erase_answers_around_blank_lines(stage2)

    print("  阶段 4/7: 稀疏行手写 + 底部草稿擦除...")
    stage4 = _erase_sparse_row_handwriting(stage3)

    print("  阶段 5/7: Sauvola 文档漂白（消除灰色背景）...")
    stage5 = _bleach_document(stage4)

    print("  阶段 6/7: 题号栏保护恢复（使用原色彩源）...")
    stage6 = _restore_question_number_strip(stage5, question_strip_source)

    print("  阶段 7/7: 照片外缘清理...")
    return _clean_outer_photo_edges(stage6)


# ============================================================
# LLM 客户端（可选增强，需 API Key）
# ============================================================

SYSTEM_PROMPT = """\
你是一个专业的文档图像分析助手。
给定一张试卷或文档的照片，请识别其中所有的 **手写内容**（包括：答案、批改符号、红笔圈注、草稿演算、旁注等），
并输出手写区域的边界框列表。

输出格式（仅 JSON，不要添加任何其他文字）：
{
  "regions": [
    {
      "x": 0.10,
      "y": 0.05,
      "w": 0.30,
      "h": 0.02,
      "type": "handwritten_answer",
      "description": "填空题手写答案"
    }
  ]
}

约定：
- x, y, w, h 均为相对图片宽/高的归一化值（0.0 ~ 1.0），x/y 为左上角
- type 可以是: handwritten_answer / red_correction / draft_calculation / annotation / other
- 仅标注手写内容，不要标注印刷题干、印刷图形、题号、填空横线本身
- 若图片中没有手写内容，返回 {"regions": []}
"""

USER_PROMPT = "请分析这张图片，识别所有手写区域并以规定的 JSON 格式返回边界框列表。"


def _encode_image_base64(image_path: Path) -> tuple[str, str]:
    suffix = image_path.suffix.lower()
    media_type_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                      ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp"}
    media_type = media_type_map.get(suffix, "image/jpeg")
    with open(image_path, "rb") as f:
        return base64.standard_b64encode(f.read()).decode(), media_type


def _parse_json_response(raw: str) -> dict[str, Any]:
    match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", raw)
    if match:
        raw = match.group(1)
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"模型返回的不是有效 JSON：\n{raw}") from exc


def _call_anthropic(image_path: Path, model: str, api_key: str | None) -> dict[str, Any]:
    try:
        import anthropic
    except ImportError as exc:
        raise RuntimeError("请先安装 anthropic：pip install anthropic") from exc
    client = anthropic.Anthropic(api_key=api_key or os.environ.get("ANTHROPIC_API_KEY"))
    b64, media_type = _encode_image_base64(image_path)
    response = client.messages.create(
        model=model, max_tokens=4096, system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
            {"type": "text", "text": USER_PROMPT},
        ]}],
    )
    return _parse_json_response(response.content[0].text.strip())


def _call_openai(image_path: Path, model: str, api_key: str | None) -> dict[str, Any]:
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise RuntimeError("请先安装 openai：pip install openai") from exc
    client = OpenAI(api_key=api_key or os.environ.get("OPENAI_API_KEY"))
    b64, media_type = _encode_image_base64(image_path)
    response = client.chat.completions.create(
        model=model, max_tokens=4096,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": [
                {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{b64}", "detail": "high"}},
                {"type": "text", "text": USER_PROMPT},
            ]},
        ],
    )
    return _parse_json_response(response.choices[0].message.content.strip())


def _regions_to_mask(regions: list[dict], height: int, width: int, padding: int = 6) -> np.ndarray:
    """将归一化区域列表转换为像素 mask。"""
    mask = np.zeros((height, width), dtype=np.uint8)
    for r in regions:
        x1 = max(0, int(r["x"] * width)  - padding)
        y1 = max(0, int(r["y"] * height) - padding)
        x2 = min(width,  int((r["x"] + r["w"]) * width)  + padding)
        y2 = min(height, int((r["y"] + r["h"]) * height) + padding)
        if x2 > x1 and y2 > y1:
            mask[y1:y2, x1:x2] = 255
    return mask


# ============================================================
# 主 Agent 类
# ============================================================

class HandwritingEraserAgent:
    """
    笔迹擦除 Agent，支持 local / anthropic / openai 三种后端。

    provider='local'（默认）
        不需要 API Key，直接运行 exam_scanner 风格的多阶段 OpenCV 管线。

    provider='anthropic' / 'openai'
        调用视觉模型识别手写区域 bbox，将 LLM mask 与 OpenCV 管线 mask 合并后擦除，
        获得更精准的效果。需要对应 API Key。
    """

    DEFAULT_MODELS = {
        "anthropic": "claude-opus-4-5",
        "openai":    "gpt-4o",
    }

    def __init__(
        self,
        provider: str = "local",
        model: str | None = None,
        api_key: str | None = None,
        save_mask: bool = False,
        padding: int = 6,
        verbose: bool = True,
    ) -> None:
        self.provider  = provider.lower()
        self.model     = model or self.DEFAULT_MODELS.get(self.provider)
        self.api_key   = api_key
        self.save_mask = save_mask
        self.padding   = padding
        self.verbose   = verbose

    def _log(self, msg: str) -> None:
        if self.verbose:
            print(msg)

    def detect_handwriting_regions(self, image_path: Path) -> list[dict[str, Any]]:
        """调用 LLM 视觉模型返回归一化手写区域列表（仅 LLM 后端使用）。"""
        self._log(f"  → 调用 {self.provider}/{self.model} 分析手写区域...")
        if self.provider == "anthropic":
            result = _call_anthropic(image_path, self.model, self.api_key)
        elif self.provider == "openai":
            result = _call_openai(image_path, self.model, self.api_key)
        else:
            raise ValueError(f"不支持的 LLM provider: {self.provider}")

        regions = result.get("regions", [])
        self._log(f"  → 检测到 {len(regions)} 个手写区域")
        for i, r in enumerate(regions):
            self._log(
                f"     [{i+1}] {r.get('type','?')}: {r.get('description','')} "
                f" bbox=({r['x']:.3f},{r['y']:.3f},{r['w']:.3f},{r['h']:.3f})"
            )
        return regions

    def erase(self, image_path: Path | str, output_path: Path | str | None = None) -> Path:
        """执行完整的笔迹擦除流程，返回输出图片路径。"""
        image_path = Path(image_path).expanduser().resolve()
        if not image_path.exists():
            raise FileNotFoundError(f"找不到图片: {image_path}")

        if output_path is None:
            out_dir = image_path.parent / "cleaned"
            out_dir.mkdir(exist_ok=True)
            output_path = out_dir / f"{image_path.stem}_erased{image_path.suffix}"
        output_path = Path(output_path).expanduser().resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)

        self._log(f"\n[HandwritingEraserAgent] 处理: {image_path.name}  provider={self.provider}")

        img = cv2.imread(str(image_path))
        if img is None:
            raise FileNotFoundError(f"OpenCV 无法读取图片: {image_path}")
        h, w = img.shape[:2]
        self._log(f"  图片尺寸: {w}×{h}")

        if self.provider == "local":
            # ── 纯 OpenCV 多阶段管线 ──────────────────────────
            result = run_local_pipeline(img)

        else:
            # ── LLM 增强：bbox mask + OpenCV 管线 ──────────────
            regions = self.detect_handwriting_regions(image_path)
            llm_mask = _regions_to_mask(regions, h, w, padding=self.padding)
            k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            llm_mask = cv2.dilate(llm_mask, k)

            # 先跑本地管线，再把 LLM 额外识别的区域叠加白填
            self._log("  → 运行本地 OpenCV 管线...")
            base_result = run_local_pipeline(img)
            if np.count_nonzero(llm_mask) > 0:
                self._log(f"  → 叠加 LLM mask ({int(np.count_nonzero(llm_mask))} px)...")
                base_result[llm_mask > 0] = [255, 255, 255]
            result = base_result

            if self.save_mask:
                mask_path = output_path.with_stem(output_path.stem + "_llm_mask").with_suffix(".png")
                cv2.imwrite(str(mask_path), llm_mask)
                self._log(f"  → LLM mask 已保存: {mask_path}")

        # 写出
        ext = output_path.suffix.lower()
        if ext in (".jpg", ".jpeg"):
            cv2.imwrite(str(output_path), result, [int(cv2.IMWRITE_JPEG_QUALITY), 98])
        else:
            cv2.imwrite(str(output_path), result)
        self._log(f"  → 完成，已保存: {output_path}")
        return output_path

    def erase_folder(
        self,
        folder: Path | str,
        output_dir: Path | str | None = None,
        extensions: tuple[str, ...] = (".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"),
    ) -> list[Path]:
        """批量处理文件夹中的所有图片。"""
        folder = Path(folder).expanduser().resolve()
        if not folder.is_dir():
            raise NotADirectoryError(f"不是有效文件夹: {folder}")
        if output_dir is None:
            output_dir = folder / "cleaned"
        output_dir = Path(output_dir).expanduser().resolve()
        output_dir.mkdir(parents=True, exist_ok=True)

        images = sorted(p for p in folder.iterdir() if p.suffix.lower() in extensions and p.is_file())
        self._log(f"\n[HandwritingEraserAgent] 批量处理 {len(images)} 张图片 → {output_dir}")

        results = []
        for i, img_path in enumerate(images, 1):
            out_path = output_dir / f"{img_path.stem}_erased{img_path.suffix}"
            self._log(f"\n[{i}/{len(images)}] {img_path.name}")
            try:
                results.append(self.erase(img_path, out_path))
            except Exception as exc:
                print(f"  [错误] {img_path.name}: {exc}", file=sys.stderr)
        return results


# ============================================================
# 命令行入口
# ============================================================

def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="handwriting_eraser_agent",
        description="试卷笔迹擦除 Agent（local 后端无需 API Key）",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("input", help="输入图片路径或包含图片的文件夹路径")
    parser.add_argument("--out", "-o", metavar="OUTPUT", default=None,
                        help="输出图片路径（单图模式）")
    parser.add_argument("--out-dir", metavar="OUTPUT_DIR", default=None,
                        help="批量模式的输出目录（默认 <input>/cleaned/）")
    parser.add_argument("--provider", choices=["local", "anthropic", "openai"],
                        default="local",
                        help="后端：local=纯 OpenCV（无需 API Key）；anthropic/openai=LLM 增强")
    parser.add_argument("--model", default=None,
                        help="LLM 模型名称（默认 claude-opus-4-5 / gpt-4o）")
    parser.add_argument("--api-key", default=None,
                        help="API 密钥（默认从环境变量读取）")
    parser.add_argument("--save-mask", action="store_true",
                        help="同时保存 LLM mask 图片（LLM 模式下有效）")
    parser.add_argument("--padding", type=int, default=6,
                        help="LLM bbox 边缘额外扩展像素数")
    parser.add_argument("--quiet", "-q", action="store_true", help="静默模式")
    return parser


def main() -> None:
    parser = _build_parser()
    args   = parser.parse_args()

    agent = HandwritingEraserAgent(
        provider  = args.provider,
        model     = args.model,
        api_key   = args.api_key,
        save_mask = args.save_mask,
        padding   = args.padding,
        verbose   = not args.quiet,
    )

    input_path = Path(args.input).expanduser().resolve()
    if input_path.is_dir():
        agent.erase_folder(input_path, output_dir=args.out_dir)
    elif input_path.is_file():
        agent.erase(input_path, output_path=args.out)
    else:
        print(f"错误：找不到输入路径 {input_path}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

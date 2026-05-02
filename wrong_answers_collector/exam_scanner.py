#!/usr/bin/env python3
"""
试卷截图错题整理脚本
使用OCR识别试卷截图中的错题，并生成Word文档。

依赖库：
- pix2text (Pix2Text) - 先进的OCR工具，支持文字、数学公式、表格识别
- python-docx
- Pillow (PIL)

安装命令：
pip install pix2text python-docx Pillow

更新说明：
- 2024年: 从 PaddleOCR 升级到 Pix2Text
- 优势: 更好的数学公式识别、表格识别、混合内容处理
"""

import os
# 禁用网络检查，使用本地模型缓存
os.environ['PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK'] = 'True'

import argparse
import re
from pathlib import Path
from PIL import Image
from docx import Document
from pix2text import Pix2Text

# 题号前缀匹配 - 更全面地识别各种题号格式
# 支持: 1. 1、 1) (1) ① 1. 【1】 【第1题】 第1题 等
QUESTION_PREFIX_RE = re.compile(
    r'^\s*(?:'
    r'(?:第\s*)?(\d+)\s*[\.、\)\]]\s*'  # 1. 1、 1) 1] 等
    r'|(?:第\s*)?(\d+)\s*题\s*'          # 第1题 第 1 题
    r'|\(?(\d+)\)?\s*'                   # (1) 1
    r'|【(\d+)】\s*'                     # 【1】
    r'|①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩'         # 圆圈数字
    r'|\b([a-zA-Z])\s*[\.、\)]\s*'       # A. B、 C)
    r'|\b([a-zA-Z])\s*\)\s*'             # A) B)
    r')', re.IGNORECASE)

# 错题标记匹配 - 识别题干前后的各种错误标记
WRONG_MARKER_RE = re.compile(
    r'错(?!误)|'       # 错 (但不是错误)
    r'×|[xX]|'         # 乘号形式的错
    r'错误|'           # 错误
    r'答错|'           
    r'不对|'           
    r'不正确|'         
    r'✗|✘|'            # 其他叉号
    r'❌|'             # emoji叉号
    r'\bwrong\b|'      # 英文wrong
    r'\bfalse\b|'      # 英文false
    r'\berror\b|'      # 英文error
    r'三角|'           # 三角形标记
    r'红色|'           # 红色标记
    r'红叉|'           # 红叉
    r'叉号|'           # 叉号
    r'打叉|'           # 打叉
    r'划掉|'           # 划掉
    r'删除|'           # 删除
    r'取消', re.IGNORECASE  # 取消
)

# 判断是否为题号行
def is_question_line(line):
    """判断行是否为题号/标记行"""
    # 完全匹配题号模式
    if QUESTION_PREFIX_RE.match(line):
        return True
    # 匹配纯题号（如只有 "1" 或 "(1)"）
    pure_question_re = re.compile(
        r'^\s*(\d+|[a-zA-Z]|①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩)\s*$'
    )
    if pure_question_re.match(line):
        return True
    return False

# 判断是否为错题标记行（只有标记或主要是标记）
def is_wrong_marker_heavy(line):
    """判断行是否主要是错题标记"""
    stripped = line.strip()
    if not stripped:
        return False
    # 匹配仅包含标记的模式
    marker_only_re = re.compile(
        r'^(?:错|×|x|错误|答错|不对|不正确|✗|✘|❌|wrong|error|三角|红色|红叉|叉号|打叉|划掉|删除|取消)\s*$', 
        re.IGNORECASE
    )
    return bool(marker_only_re.match(stripped))

def extract_text_from_image(image_path):
    """从图片中提取文本"""
    try:
        # 初始化 Pix2Text（支持中文、英文、数学公式、表格等）
        # 尝试不同的配置来提高识别率
        p2t = Pix2Text(
            analyzer_config=dict(  # 文本检测和识别配置
                text_detector_config=dict(
                    # 尝试更细致的检测
                    box_thresh=0.3,  # 降低阈值以检测更多内容
                    unclip_ratio=2.0
                )
            )
        )

        # 使用 Pix2Text 识别图片
        result = p2t.recognize(str(image_path))

        # Pix2Text 返回结构化的结果，提取纯文本
        if isinstance(result, dict):
            if 'text' in result:
                text = result['text']
            elif 'content' in result:
                text = result['content']
            else:
                # 如果是其他字典格式，尝试提取所有文本内容
                text_parts = []
                for key, value in result.items():
                    if isinstance(value, str):
                        text_parts.append(value)
                    elif isinstance(value, list):
                        for item in value:
                            if isinstance(item, str):
                                text_parts.append(item)
                            elif isinstance(item, dict) and 'text' in item:
                                text_parts.append(item['text'])
                text = '\n'.join(text_parts)
        elif isinstance(result, str):
            text = result
        elif isinstance(result, list):
            # 处理列表格式的结果
            text_parts = []
            for item in result:
                if isinstance(item, str):
                    text_parts.append(item)
                elif isinstance(item, dict) and 'text' in item:
                    text_parts.append(item['text'])
            text = '\n'.join(text_parts)
        else:
            # 处理其他可能的返回格式
            text = str(result)

        return text
    except Exception as e:
        print(f"处理图片 {image_path} 时出错: {e}")
        return ""

def extract_question_number(line):
    """从行中提取题号"""
    match = QUESTION_PREFIX_RE.match(line)
    if match:
        # 查找第一个非空的捕获组（题号）
        for group in match.groups():
            if group:
                return group.strip()
    return None

def identify_wrong_answers(text):
    """
    识别错题：支持多种标记位置
    
    识别模式：
    1. 题号 + 错题标记（如：1. 错）
    2. 错题标记 + 题号 + 题干（如：错 1. xxx）
    3. 题号 + 包含标记的完整行（如：1. xxx 错）
    4. 标记在题目前的连续行
    """
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    wrong_questions = []
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # 情况1: 题号后面跟着错题标记（标记在下一行）
        if is_question_line(line):
            question_num = extract_question_number(line)
            # 检查下一行是否是错题标记
            if i + 1 < len(lines):
                next_line = lines[i + 1]
                if is_wrong_marker_heavy(next_line):
                    # 题号行 + 标记行
                    wrong_questions.append(f"{question_num} — {line}")
                    i += 2
                    continue
            # 检查当前行是否包含错题标记
            if WRONG_MARKER_RE.search(line):
                wrong_questions.append(f"{question_num} — {line}")
                i += 1
                continue
        
        # 情况2: 错题标记行，后面跟着题号
        if is_wrong_marker_heavy(line):
            # 检查是否紧跟着题号行
            if i + 1 < len(lines):
                next_line = lines[i + 1]
                next_match = QUESTION_PREFIX_RE.match(next_line)
                if next_match:
                    question_num = extract_question_number(next_line)
                    wrong_questions.append(f"{question_num} — {next_line} (标记: {line})")
                    i += 2
                    continue
            # 单独一行错题标记，无法关联题号
            wrong_questions.append(f"未定位题号 — {line}")
            i += 1
            continue
        
        # 情况3: 当前行同时包含题号和错题标记
        if WRONG_MARKER_RE.search(line):
            question_num = extract_question_number(line)
            if question_num:
                wrong_questions.append(f"{question_num} — {line}")
            else:
                # 行中有标记但没有识别到题号
                wrong_questions.append(f"未定位题号 — {line}")
            i += 1
            continue
        
        i += 1
    
    # 去重（如果同一题被多次识别）
    seen = set()
    unique_wrong = []
    for q in wrong_questions:
        # 使用题号作为去重依据
        num_match = re.match(r'^(\d+|[a-zA-Z])', q)
        if num_match:
            num = num_match.group(1)
            if num not in seen:
                seen.add(num)
                unique_wrong.append(q)
        else:
            unique_wrong.append(q)
    
    return unique_wrong

def create_word_document(wrong_questions, output_path):
    """创建Word文档"""
    doc = Document()
    doc.add_heading('错题整理', 0)
    
    if not wrong_questions:
        doc.add_paragraph("未识别到错题。")
    else:
        for i, question in enumerate(wrong_questions, 1):
            doc.add_heading(f'错题 {i}', level=1)
            doc.add_paragraph(question)
    
    doc.save(output_path)
    print(f"Word文档已保存到: {output_path}")

def main():
    parser = argparse.ArgumentParser(description='扫描试卷截图并整理错题生成Word文档')
    parser.add_argument('folder_path', help='包含试卷截图的文件夹路径')
    parser.add_argument('output_name', help='生成的Word文档名称（不含扩展名）')
    
    args = parser.parse_args()
    
    folder_path = Path(args.folder_path)
    if not folder_path.exists() or not folder_path.is_dir():
        print(f"文件夹路径不存在: {folder_path}")
        return
    
    output_name = args.output_name
    if output_name.lower().endswith('.docx'):
        output_name = output_name[:-5]
    output_path = folder_path / f"{output_name}.docx"
    
    # 支持的图片格式
    image_extensions = {'.png', '.jpg', '.jpeg', '.bmp', '.tiff'}
    
    all_wrong_questions = []
    
    for file_path in folder_path.iterdir():
        if file_path.suffix.lower() in image_extensions:
            print(f"处理图片: {file_path}")
            text = extract_text_from_image(file_path)
            wrong_questions = identify_wrong_answers(text)
            all_wrong_questions.extend(wrong_questions)
    
    create_word_document(all_wrong_questions, output_path)

if __name__ == "__main__":
    main()

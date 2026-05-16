import type { SheetType } from '../types';
import { LANGUAGE_EXTENSIONS } from './languageUtils';

/** 额外后缀 → 与 LANGUAGE_META 一致的语言 id */
const EXTRA_EXT_TO_LANG: Record<string, string> = {
  '.tsx': 'typescript',
  '.jsx': 'javascript',
  '.yml': 'yaml',
  '.hpp': 'cpp',
  '.hh': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
};

const MARKDOWN_EXTS = new Set(['.md', '.markdown', '.mdx']);

function buildCodeExtToLang(): Record<string, string> {
  const m: Record<string, string> = { ...EXTRA_EXT_TO_LANG };
  for (const [lang, ext] of Object.entries(LANGUAGE_EXTENSIONS)) {
    if (lang === 'markdown') continue;
    m[ext.toLowerCase()] = lang;
  }
  return m;
}

const CODE_EXT_TO_LANG = buildCodeExtToLang();

/**
 * 根据标题中的文件后缀推断文稿类型。
 * 无有效后缀（无 . 或仅末尾点）时返回 null，不改动原有 type/language。
 */
export function inferTypeAndLanguageFromTitle(
  title: string
): { type: SheetType; language: string | null } | null {
  const lower = title.trim().toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot < 0 || dot >= lower.length - 1) return null;

  const ext = lower.slice(dot);
  if (ext.length < 2) return null;

  if (MARKDOWN_EXTS.has(ext)) {
    return { type: 'markdown', language: null };
  }

  const lang = CODE_EXT_TO_LANG[ext];
  if (lang) {
    return { type: 'code', language: lang };
  }

  return { type: 'plain', language: null };
}

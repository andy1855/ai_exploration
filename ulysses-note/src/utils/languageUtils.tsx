import React from 'react';
import { LanguageSupport } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { rust } from '@codemirror/lang-rust';
import { cpp } from '@codemirror/lang-cpp';
import { php } from '@codemirror/lang-php';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { StreamLanguage } from '@codemirror/language';
import { go } from '@codemirror/legacy-modes/mode/go';
import { ruby } from '@codemirror/legacy-modes/mode/ruby';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { swift } from '@codemirror/legacy-modes/mode/swift';
import { kotlin } from '@codemirror/legacy-modes/mode/clike';

export interface LanguageMeta {
  label: string;
  abbr: string;
  color: string;
  bgColor: string;
  extension: () => LanguageSupport | ReturnType<typeof StreamLanguage.define>;
}

export const LANGUAGE_META: Record<string, LanguageMeta> = {
  javascript: {
    label: 'JavaScript',
    abbr: 'JS',
    color: '#1a1a00',
    bgColor: '#F7DF1E',
    extension: () => javascript(),
  },
  typescript: {
    label: 'TypeScript',
    abbr: 'TS',
    color: '#ffffff',
    bgColor: '#3178C6',
    extension: () => javascript({ typescript: true }),
  },
  python: {
    label: 'Python',
    abbr: 'PY',
    color: '#ffffff',
    bgColor: '#3776AB',
    extension: () => python(),
  },
  java: {
    label: 'Java',
    abbr: 'JV',
    color: '#ffffff',
    bgColor: '#ED8B00',
    extension: () => java(),
  },
  go: {
    label: 'Go',
    abbr: 'GO',
    color: '#ffffff',
    bgColor: '#00ACD7',
    extension: () => StreamLanguage.define(go),
  },
  rust: {
    label: 'Rust',
    abbr: 'RS',
    color: '#ffffff',
    bgColor: '#B7410E',
    extension: () => rust(),
  },
  cpp: {
    label: 'C++',
    abbr: 'C++',
    color: '#ffffff',
    bgColor: '#00599C',
    extension: () => cpp(),
  },
  c: {
    label: 'C',
    abbr: 'C',
    color: '#ffffff',
    bgColor: '#5C6BC0',
    extension: () => cpp(),
  },
  csharp: {
    label: 'C#',
    abbr: 'C#',
    color: '#ffffff',
    bgColor: '#239120',
    extension: () => cpp(),
  },
  php: {
    label: 'PHP',
    abbr: 'PHP',
    color: '#ffffff',
    bgColor: '#777BB4',
    extension: () => php(),
  },
  ruby: {
    label: 'Ruby',
    abbr: 'RB',
    color: '#ffffff',
    bgColor: '#CC342D',
    extension: () => StreamLanguage.define(ruby),
  },
  swift: {
    label: 'Swift',
    abbr: 'SW',
    color: '#ffffff',
    bgColor: '#F05138',
    extension: () => StreamLanguage.define(swift),
  },
  kotlin: {
    label: 'Kotlin',
    abbr: 'KT',
    color: '#ffffff',
    bgColor: '#7F52FF',
    extension: () => StreamLanguage.define(kotlin),
  },
  sql: {
    label: 'SQL',
    abbr: 'SQL',
    color: '#ffffff',
    bgColor: '#336791',
    extension: () => sql(),
  },
  html: {
    label: 'HTML',
    abbr: 'HTM',
    color: '#ffffff',
    bgColor: '#E44D26',
    extension: () => html(),
  },
  css: {
    label: 'CSS',
    abbr: 'CSS',
    color: '#ffffff',
    bgColor: '#264DE4',
    extension: () => css(),
  },
  shell: {
    label: 'Shell',
    abbr: 'SH',
    color: '#ffffff',
    bgColor: '#4EAA25',
    extension: () => StreamLanguage.define(shell),
  },
  yaml: {
    label: 'YAML',
    abbr: 'YML',
    color: '#ffffff',
    bgColor: '#CB171E',
    extension: () => yaml(),
  },
  json: {
    label: 'JSON',
    abbr: 'JSON',
    color: '#ffffff',
    bgColor: '#555555',
    extension: () => json(),
  },
  xml: {
    label: 'XML',
    abbr: 'XML',
    color: '#ffffff',
    bgColor: '#0060AC',
    extension: () => xml(),
  },
  markdown: {
    label: 'Markdown',
    abbr: 'MD',
    color: '#ffffff',
    bgColor: '#083FA1',
    extension: () => markdown(),
  },
};

export const LANGUAGE_EXTENSIONS: Record<string, string> = {
  javascript: '.js',
  typescript: '.ts',
  python: '.py',
  java: '.java',
  go: '.go',
  rust: '.rs',
  cpp: '.cpp',
  c: '.c',
  csharp: '.cs',
  php: '.php',
  ruby: '.rb',
  swift: '.swift',
  kotlin: '.kt',
  sql: '.sql',
  html: '.html',
  css: '.css',
  shell: '.sh',
  yaml: '.yaml',
  json: '.json',
  xml: '.xml',
  markdown: '.md',
};

export function getLanguageExtName(lang: string | null | undefined): string {
  if (!lang) return '';
  return LANGUAGE_EXTENSIONS[lang] ?? '';
}

export function getLanguageMeta(lang: string | null | undefined): LanguageMeta | null {
  if (!lang) return null;
  return LANGUAGE_META[lang] ?? null;
}

export function getLanguageExtension(lang: string | null | undefined) {
  const meta = getLanguageMeta(lang);
  if (!meta) return [];
  return [meta.extension()];
}

interface LanguageIconProps {
  language: string | null | undefined;
  size?: number;
  className?: string;
}

export function LanguageIcon({ language, size = 16, className }: LanguageIconProps) {
  const meta = getLanguageMeta(language);
  if (!meta) {
    return (
      <span
        className={`lang-icon ${className ?? ''}`}
        style={{
          width: size,
          height: size,
          fontSize: size <= 14 ? 7 : 8,
          backgroundColor: '#888',
          color: '#fff',
        }}
      >
        {'</>'}
      </span>
    );
  }

  const abbr = meta.abbr.length > 3 ? meta.abbr.slice(0, 3) : meta.abbr;

  return (
    <span
      className={`lang-icon ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        fontSize: size <= 14 ? 7 : 8,
        backgroundColor: meta.bgColor,
        color: meta.color,
      }}
      title={meta.label}
    >
      {abbr}
    </span>
  );
}

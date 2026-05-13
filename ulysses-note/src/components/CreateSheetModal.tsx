import { useState } from 'react';
import { useNoteStore } from '../store/useNoteStore';
import { FileText, FileCode, FileType, X } from 'lucide-react';
import type { SheetType } from '../types';
import { CODE_LANGUAGES } from '../types';

interface Props {
  groupId?: string;
  onClose: () => void;
}

export function CreateSheetModal({ groupId, onClose }: Props) {
  const { createSheet } = useNoteStore();
  const [step, setStep] = useState<'type' | 'code-lang'>('type');
  const [selectedType, setSelectedType] = useState<SheetType>('plain');

  const handleTypeSelect = (type: SheetType) => {
    if (type === 'code') {
      setSelectedType(type);
      setStep('code-lang');
    } else {
      createSheet(groupId, type);
      onClose();
    }
  };

  const handleCodeLangSelect = (lang: string) => {
    createSheet(groupId, 'code', lang);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>新建文稿</h3>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {step === 'type' && (
          <div className="modal-body">
            <div className="type-options">
              <button className="type-card" onClick={() => handleTypeSelect('plain')}>
                <FileText size={28} />
                <span className="type-card-title">普通文稿</span>
                <span className="type-card-desc">纯文本，适合快速记录</span>
              </button>

              <button className="type-card" onClick={() => handleTypeSelect('markdown')}>
                <FileType size={28} />
                <span className="type-card-title">MD 文档</span>
                <span className="type-card-desc">Markdown 格式，支持实时预览</span>
              </button>

              <button className="type-card" onClick={() => handleTypeSelect('code')}>
                <FileCode size={28} />
                <span className="type-card-title">代码</span>
                <span className="type-card-desc">代码编辑，支持多种编程语言</span>
              </button>
            </div>
          </div>
        )}

        {step === 'code-lang' && (
          <div className="modal-body">
            <p className="modal-hint">选择编程语言</p>
            <div className="lang-grid">
              {CODE_LANGUAGES.map((lang) => (
                <button
                  key={lang.value}
                  className="lang-btn"
                  onClick={() => handleCodeLangSelect(lang.value)}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

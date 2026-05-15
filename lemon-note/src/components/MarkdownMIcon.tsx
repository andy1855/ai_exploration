import { FileText } from 'lucide-react';

/** Markdown 文稿列表/工具栏上的图标 */
export function MarkdownMIcon({ size = 14, className }: { size?: number; className?: string }) {
  return <FileText size={size} className={className} />;
}

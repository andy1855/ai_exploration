/** Markdown 文稿列表/工具栏上的 “M” 标记 */
export function MarkdownMIcon({ className = '' }: { className?: string }) {
  return (
    <span className={`markdown-m-icon ${className}`.trim()} aria-hidden>
      M
    </span>
  );
}

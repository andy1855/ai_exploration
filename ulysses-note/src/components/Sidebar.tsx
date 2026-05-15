import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { useNoteStore } from '../store/useNoteStore';
import type { Sheet } from '../types';
import {
  Folder,
  FileType,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  Search,
  File,
  Pencil,
  FilePlus,
  FolderPlus,
  Copy,
  CheckSquare,
  Square,
  X,
  MoveRight,
  Layers,
} from 'lucide-react';
import { CreateSheetModal } from './CreateSheetModal';
import { LanguageIcon } from '../utils/languageUtils';
import { ContextMenu, useContextMenu } from './ContextMenu';
import { ConfirmDialog } from './ConfirmDialog';

// ─── Highlight helper ─────────────────────────────────────────
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function getContentSnippet(content: string, query: string): string {
  const lower = content.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return '';
  // Start close to the match so it's visible in the narrow snippet area
  const start = Math.max(0, idx - 6);
  const end = Math.min(content.length, idx + query.length + 50);
  const snippet = (start > 0 ? '…' : '') + content.slice(start, end) + (end < content.length ? '…' : '');
  return snippet.replace(/[\n\r]+/g, ' ');
}

// ─── MoveToModal ─────────────────────────────────────────────
interface MoveToModalProps {
  sheetIds: string[];
  onClose: () => void;
  onMoved?: () => void;
}

function MoveToModal({ sheetIds, onClose, onMoved }: MoveToModalProps) {
  const { groups, moveSheets } = useNoteStore();
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="move-to-modal" onClick={(e) => e.stopPropagation()}>
        <div className="move-to-header">
          <MoveRight size={14} />
          <span>移动到分组</span>
          <button className="icon-btn" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="move-to-list">
          <button
            className="move-to-item"
            onClick={() => { moveSheets(sheetIds, null); onMoved?.(); onClose(); }}
          >
            <File size={13} />
            <span>不分组</span>
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              className="move-to-item"
              onClick={() => { moveSheets(sheetIds, g.id); onMoved?.(); onClose(); }}
            >
              <Folder size={13} />
              <span>{g.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────
export function Sidebar() {
  const {
    groups,
    sheets,
    getChildGroups,
    getSheetsByGroup,
    getFilteredSheets,
    selectedSheetId,
    selectedGroupId,
    searchQuery,
    preferences,
    selectSheet,
    selectGroup,
    createGroup,
    deleteSheet,
    deleteSheets,
    deleteGroup,
    updateGroup,
    copySheet,
    setSearchQuery,
  } = useNoteStore();

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createInGroupId, setCreateInGroupId] = useState<string | undefined>(undefined);
  const [renamingSheetId, setRenamingSheetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Multi-select & batch mode
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);
  const [moveToIds, setMoveToIds] = useState<string[] | null>(null);

  // Single-sheet delete confirm
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  // Drag & drop
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null | 'root'>(undefined as unknown as null);

  const searchRef = useRef<HTMLInputElement>(null);
  const { menu: ctxMenu, open: openCtx, close: closeCtx } = useContextMenu();

  const rootGroups = getChildGroups(null);
  const ungroupedSheets = getSheetsByGroup(null);
  const isSearching = !!searchQuery;
  const filteredSheets = isSearching ? getFilteredSheets() : null;
  const searchCount = filteredSheets?.length ?? 0;

  // Exit batch mode when selection clears
  useEffect(() => {
    if (!batchMode) setSelectedIds(new Set());
  }, [batchMode]);

  // Cmd+F to focus search
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const openCreateModal = (groupId?: string) => {
    setCreateInGroupId(groupId);
    setShowCreateModal(true);
  };

  function toggleCheck(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelect(id: string, e: React.MouseEvent) {
    if (batchMode) {
      toggleCheck(id);
    } else if (e.ctrlKey || e.metaKey || e.shiftKey) {
      e.preventDefault();
      setBatchMode(true);
      toggleCheck(id);
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setBatchMode(false);
  }

  // Context menu helpers
  const handleCtxGroup = (e: React.MouseEvent, groupId: string, groupName: string) => {
    openCtx(e, [
      { label: '新建文稿', icon: <FilePlus size={13} />, onClick: () => openCreateModal(groupId) },
      { label: '新建子分组', icon: <FolderPlus size={13} />, onClick: () => { useNoteStore.getState().createGroup('新建分组', groupId); } },
      { label: '重命名', icon: <Pencil size={13} />, onClick: () => { setEditingGroupId(groupId); setEditName(groupName); } },
      { separator: true },
      { label: '删除分组', icon: <Trash2 size={13} />, danger: true, onClick: () => { setDeleteTarget({ id: `group:${groupId}`, title: groupName }); } },
    ]);
  };

  const handleCtxSheet = (e: React.MouseEvent, sheetId: string, sheetTitle: string) => {
    openCtx(e, [
      { label: '重命名', icon: <Pencil size={13} />, onClick: () => { setRenamingSheetId(sheetId); setRenameValue(sheetTitle); } },
      { label: '复制文稿', icon: <Copy size={13} />, onClick: () => copySheet(sheetId) },
      { label: '移动到...', icon: <MoveRight size={13} />, onClick: () => setMoveToIds([sheetId]) },
      { label: '复制标题', icon: <Copy size={13} />, onClick: () => navigator.clipboard.writeText(sheetTitle) },
      { separator: true },
      { label: '删除文稿', icon: <Trash2 size={13} />, danger: true, onClick: () => setDeleteTarget({ id: sheetId, title: sheetTitle }) },
    ]);
  };

  const handleGroupNameSubmit = (groupId: string) => {
    if (editName.trim()) updateGroup(groupId, { name: editName.trim() });
    setEditingGroupId(null);
  };

  const handleGroupNameKeyDown = (e: KeyboardEvent, groupId: string) => {
    if (e.key === 'Enter') handleGroupNameSubmit(groupId);
    if (e.key === 'Escape') setEditingGroupId(null);
  };

  // Drag & drop handlers
  const handleDragStart = (e: React.DragEvent, sheetId: string) => {
    setDraggingId(sheetId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', sheetId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverGroupId(undefined as unknown as null);
  };

  const handleGroupDragOver = (e: React.DragEvent, groupId: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverGroupId(groupId === null ? 'root' : groupId);
  };

  const handleGroupDrop = (e: React.DragEvent, groupId: string | null) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (id) useNoteStore.getState().moveSheet(id, groupId);
    setDraggingId(null);
    setDragOverGroupId(undefined as unknown as null);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.id.startsWith('group:')) {
      deleteGroup(deleteTarget.id.slice(6));
    } else {
      deleteSheet(deleteTarget.id);
    }
    setDeleteTarget(null);
  };

  if (preferences.sidebarCollapsed) {
    return <aside className="sidebar sidebar-collapsed" />;
  }

  return (
    <aside className="sidebar" style={{ width: preferences.sidebarWidth }}>
      {/* Search */}
      <div className="sidebar-search">
        <Search size={14} className="search-icon" />
        <input
          ref={searchRef}
          type="text"
          placeholder="搜索文稿… (⌘F)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <button className="search-clear-btn" onClick={() => setSearchQuery('')}><X size={12} /></button>
        )}
      </div>
      {isSearching && (
        <div className="search-result-count">
          找到 {searchCount} 篇文稿
        </div>
      )}

      {/* Quick actions + batch mode toggle */}
      {!isSearching && (
        <div className="sidebar-actions">
          <button className="action-btn" onClick={() => openCreateModal()}>
            <Plus size={14} /><span>新建文稿</span>
          </button>
          <button className="action-btn" onClick={() => createGroup('新建分组', null)}>
            <Folder size={14} /><span>新建分组</span>
          </button>
          <button
            className={`action-btn action-btn-icon${batchMode ? ' active' : ''}`}
            onClick={() => setBatchMode(!batchMode)}
            title="批量处理"
          >
            <Layers size={14} />
          </button>
        </div>
      )}

      {/* Batch actions bar */}
      {batchMode && (
        <div className="batch-actions-bar">
          {selectedIds.size > 0 ? (
            <>
              <span className="batch-count">已选 {selectedIds.size} 篇</span>
              <button className="batch-btn" onClick={() => setMoveToIds(Array.from(selectedIds))} title="移动到">
                <MoveRight size={13} />
              </button>
              <button className="batch-btn danger" onClick={() => setBatchDeleteConfirm(true)} title="批量删除">
                <Trash2 size={13} />
              </button>
            </>
          ) : (
            <span className="batch-count batch-hint">点击文稿勾选</span>
          )}
          <button className="batch-btn" onClick={clearSelection} title="退出批量模式">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Search results */}
      {isSearching ? (
        <div className="sidebar-groups">
          {filteredSheets!.map((sheet) => {
            const titleMatch = sheet.title.toLowerCase().includes(searchQuery.toLowerCase());
            const contentMatch = !titleMatch && sheet.content.toLowerCase().includes(searchQuery.toLowerCase());
            const snippet = contentMatch ? getContentSnippet(sheet.content, searchQuery) : '';
            return (
              <SheetItem
                key={sheet.id}
                sheet={sheet}
                isSelected={selectedSheetId === sheet.id}
                isChecked={selectedIds.has(sheet.id)}
                isDragging={draggingId === sheet.id}
                batchMode={batchMode}
                renamingId={renamingSheetId}
                renameValue={renameValue}
                searchQuery={searchQuery}
                snippet={snippet}
                onSelect={(e) => {
                  if (batchMode) {
                    toggleCheck(sheet.id);
                  } else if (e.ctrlKey || e.metaKey || e.shiftKey) {
                    toggleSelect(sheet.id, e);
                  } else {
                    selectSheet(sheet.id);
                  }
                }}
                onContextMenu={(e) => handleCtxSheet(e, sheet.id, sheet.title)}
                onToggleCheck={() => toggleCheck(sheet.id)}
                onRenameChange={setRenameValue}
                onRenameSubmit={() => {
                  if (renameValue.trim()) useNoteStore.getState().updateSheet(sheet.id, { title: renameValue.trim() });
                  setRenamingSheetId(null);
                }}
                onRenameCancel={() => setRenamingSheetId(null)}
                onDelete={() => setDeleteTarget({ id: sheet.id, title: sheet.title })}
                onDragStart={(e) => handleDragStart(e, sheet.id)}
                onDragEnd={handleDragEnd}
                paddingLeft={12}
              />
            );
          })}
          {filteredSheets!.length === 0 && (
            <div className="sidebar-empty"><p>未找到相关文稿</p></div>
          )}
        </div>
      ) : (
        <div className="sidebar-groups">
          {/* Root groups */}
          {rootGroups.map((group) => (
            <GroupItem
              key={group.id}
              group={group}
              level={0}
              selectedSheetId={selectedSheetId}
              selectedGroupId={selectedGroupId}
              selectedIds={selectedIds}
              batchMode={batchMode}
              draggingId={draggingId}
              dragOverGroupId={dragOverGroupId}
              editingGroupId={editingGroupId}
              editName={editName}
              renamingSheetId={renamingSheetId}
              renameValue={renameValue}
              searchQuery=""
              onSelectGroup={() => selectGroup(group.id)}
              onSelectSheet={selectSheet}
              onToggleSelect={toggleSelect}
              onToggleCheck={toggleCheck}
              onCreateSheetInGroup={(gid) => openCreateModal(gid)}
              onDeleteGroup={() => setDeleteTarget({ id: `group:${group.id}`, title: group.name })}
              onDeleteSheet={(id, title) => setDeleteTarget({ id, title })}
              onEditNameChange={setEditName}
              onSubmitEdit={handleGroupNameSubmit}
              onKeyDown={handleGroupNameKeyDown}
              onSetEditingGroupId={setEditingGroupId}
              onContextMenuGroup={handleCtxGroup}
              onContextMenuSheet={handleCtxSheet}
              onRenameSheet={(id, title) => { setRenamingSheetId(id); setRenameValue(title); }}
              onRenameChange={setRenameValue}
              onRenameSubmit={(id) => {
                if (renameValue.trim()) useNoteStore.getState().updateSheet(id, { title: renameValue.trim() });
                setRenamingSheetId(null);
              }}
              onRenameCancel={() => setRenamingSheetId(null)}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onGroupDragOver={handleGroupDragOver}
              onGroupDrop={handleGroupDrop}
            />
          ))}

          {/* Ungrouped sheets */}
          {ungroupedSheets.length > 0 && rootGroups.length > 0 && <div className="group-divider" />}
          <div
            className={`ungrouped-section ${dragOverGroupId === 'root' ? 'drag-over' : ''}`}
            onDragOver={(e) => handleGroupDragOver(e, null)}
            onDrop={(e) => handleGroupDrop(e, null)}
            onDragLeave={() => setDragOverGroupId(undefined as unknown as null)}
          >
            {ungroupedSheets.length > 0 && rootGroups.length === 0 && (
              <div className="group-label">文稿</div>
            )}
            {ungroupedSheets.map((sheet) => (
              <SheetItem
                key={sheet.id}
                sheet={sheet}
                isSelected={selectedSheetId === sheet.id}
                isChecked={selectedIds.has(sheet.id)}
                isDragging={draggingId === sheet.id}
                batchMode={batchMode}
                renamingId={renamingSheetId}
                renameValue={renameValue}
                searchQuery=""
                snippet=""
                onSelect={(e) => {
                  if (batchMode) {
                    toggleCheck(sheet.id);
                  } else if (e.ctrlKey || e.metaKey || e.shiftKey || selectedIds.size > 0) {
                    toggleSelect(sheet.id, e);
                  } else {
                    selectSheet(sheet.id);
                  }
                }}
                onContextMenu={(e) => handleCtxSheet(e, sheet.id, sheet.title)}
                onToggleCheck={() => toggleCheck(sheet.id)}
                onRenameChange={setRenameValue}
                onRenameSubmit={() => {
                  if (renameValue.trim()) useNoteStore.getState().updateSheet(sheet.id, { title: renameValue.trim() });
                  setRenamingSheetId(null);
                }}
                onRenameCancel={() => setRenamingSheetId(null)}
                onDelete={() => setDeleteTarget({ id: sheet.id, title: sheet.title })}
                onDragStart={(e) => handleDragStart(e, sheet.id)}
                onDragEnd={handleDragEnd}
                paddingLeft={12}
              />
            ))}
          </div>

          {/* Empty state */}
          {rootGroups.length === 0 && ungroupedSheets.length === 0 && (
            <div className="sidebar-empty">
              <p>还没有文稿</p>
              <p className="sub">点击"新建文稿"开始写作</p>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateSheetModal groupId={createInGroupId} onClose={() => setShowCreateModal(false)} />
      )}
      {moveToIds && (
        <MoveToModal sheetIds={moveToIds} onClose={() => setMoveToIds(null)} onMoved={clearSelection} />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmDialog
          title={deleteTarget.id.startsWith('group:') ? '删除分组' : '删除文稿'}
          message={
            deleteTarget.id.startsWith('group:')
              ? `确定删除分组「${deleteTarget.title}」吗？分组内的文稿将移出分组。`
              : `确定删除「${deleteTarget.title || '未命名文稿'}」吗？此操作不可恢复。`
          }
          confirmText="删除"
          danger
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {batchDeleteConfirm && (
        <ConfirmDialog
          title="批量删除"
          message={`确定删除选中的 ${selectedIds.size} 篇文稿吗？此操作不可恢复。`}
          confirmText="全部删除"
          danger
          onConfirm={() => { deleteSheets(Array.from(selectedIds)); clearSelection(); setBatchDeleteConfirm(false); }}
          onCancel={() => setBatchDeleteConfirm(false)}
        />
      )}

      {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={closeCtx} />}
    </aside>
  );
}

// ─── SheetItem ────────────────────────────────────────────────
interface SheetItemProps {
  sheet: Sheet;
  isSelected: boolean;
  isChecked: boolean;
  isDragging: boolean;
  batchMode: boolean;
  renamingId: string | null;
  renameValue: string;
  searchQuery: string;
  snippet?: string;
  paddingLeft?: number;
  onSelect: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onToggleCheck: () => void;
  onRenameChange: (v: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function SheetItem({
  sheet,
  isSelected,
  isChecked,
  isDragging,
  batchMode,
  renamingId,
  renameValue,
  searchQuery,
  snippet,
  paddingLeft = 12,
  onSelect,
  onContextMenu,
  onToggleCheck,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onDelete,
  onDragStart,
  onDragEnd,
}: SheetItemProps) {
  const isRenaming = renamingId === sheet.id;
  const hasSnippet = !!snippet;

  return (
    <div
      className={`sheet-item ${isSelected ? 'active' : ''} ${isChecked ? 'checked' : ''} ${isDragging ? 'dragging' : ''} ${hasSnippet ? 'has-snippet' : ''}`}
      style={{ paddingLeft }}
      draggable
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {batchMode && (
        <button
          className="sheet-check-btn"
          onClick={(e) => { e.stopPropagation(); onToggleCheck(); }}
          title="选择"
        >
          {isChecked ? <CheckSquare size={13} /> : <Square size={13} />}
        </button>
      )}
      <span className="sheet-icon">{getSheetIcon(sheet.type, sheet.language)}</span>
      <div className="sheet-info">
        {isRenaming ? (
          <input
            className="sheet-rename-input"
            value={renameValue}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onRenameChange(e.target.value)}
            onBlur={onRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRenameSubmit();
              if (e.key === 'Escape') onRenameCancel();
            }}
          />
        ) : (
          <span className="sheet-title">
            <HighlightText text={sheet.title || '未命名文稿'} query={searchQuery} />
          </span>
        )}
        {hasSnippet && (
          <span className="sheet-snippet">
            <HighlightText text={snippet!} query={searchQuery} />
          </span>
        )}
      </div>
      {sheet.type === 'code' && sheet.language && (
        <span className="sheet-lang-badge">{sheet.language}</span>
      )}
      <button
        className="item-delete-btn"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

// ─── GroupItem ────────────────────────────────────────────────
interface GroupItemProps {
  group: { id: string; name: string; collapsed?: boolean };
  level: number;
  selectedGroupId: string | null;
  selectedSheetId: string | null;
  selectedIds: Set<string>;
  batchMode: boolean;
  draggingId: string | null;
  dragOverGroupId: string | null | undefined;
  editingGroupId: string | null;
  editName: string;
  renamingSheetId: string | null;
  renameValue: string;
  searchQuery: string;
  onSelectGroup: () => void;
  onSelectSheet: (id: string) => void;
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  onToggleCheck: (id: string) => void;
  onCreateSheetInGroup: (groupId: string) => void;
  onDeleteGroup: () => void;
  onDeleteSheet: (id: string, title: string) => void;
  onEditNameChange: (name: string) => void;
  onSubmitEdit: (groupId: string) => void;
  onKeyDown: (e: KeyboardEvent, groupId: string) => void;
  onSetEditingGroupId: (id: string | null) => void;
  onContextMenuGroup?: (e: React.MouseEvent, groupId: string, groupName: string) => void;
  onContextMenuSheet?: (e: React.MouseEvent, sheetId: string, sheetTitle: string) => void;
  onRenameSheet: (id: string, title: string) => void;
  onRenameChange: (v: string) => void;
  onRenameSubmit: (id: string) => void;
  onRenameCancel: () => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onGroupDragOver: (e: React.DragEvent, groupId: string | null) => void;
  onGroupDrop: (e: React.DragEvent, groupId: string | null) => void;
}

function getSheetIcon(type?: string, language?: string | null) {
  if (type === 'code') return <LanguageIcon language={language} size={14} />;
  if (type === 'markdown') return <FileType size={14} />;
  return <File size={14} />;
}

function GroupItem({
  group, level, selectedGroupId, selectedSheetId, selectedIds,
  batchMode, draggingId, dragOverGroupId, editingGroupId, editName,
  renamingSheetId, renameValue, searchQuery,
  onSelectGroup, onSelectSheet, onToggleSelect, onToggleCheck,
  onCreateSheetInGroup, onDeleteGroup, onDeleteSheet,
  onEditNameChange, onSubmitEdit, onKeyDown, onSetEditingGroupId,
  onContextMenuGroup, onContextMenuSheet,
  onRenameSheet, onRenameChange, onRenameSubmit, onRenameCancel,
  onDragStart, onDragEnd, onGroupDragOver, onGroupDrop,
}: GroupItemProps) {
  const { getChildGroups, getSheetsByGroup, updateGroup } = useNoteStore();
  const [collapsed, setCollapsed] = useState(group.collapsed ?? false);

  const childGroups = getChildGroups(group.id);
  const childSheets = getSheetsByGroup(group.id);
  const isSelected = selectedGroupId === group.id;
  const hasChildren = childGroups.length > 0 || childSheets.length > 0;
  const isDragOver = dragOverGroupId === group.id;
  const isEditing = editingGroupId === group.id;

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    updateGroup(group.id, { collapsed: next });
  };

  return (
    <div className="group-wrapper">
      <div
        className={`group-item ${isSelected ? 'active' : ''} ${isDragOver ? 'drag-over' : ''}`}
        style={{ paddingLeft: 12 + level * 16 }}
        onClick={() => { if (hasChildren) toggleCollapse(); onSelectGroup(); }}
        onContextMenu={(e) => onContextMenuGroup?.(e, group.id, group.name)}
        onDragOver={(e) => onGroupDragOver(e, group.id)}
        onDrop={(e) => onGroupDrop(e, group.id)}
        onDragLeave={(e) => { e.stopPropagation(); }}
      >
        <button className="collapse-btn" onClick={(e) => { e.stopPropagation(); toggleCollapse(); }}>
          {hasChildren
            ? collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />
            : <span style={{ width: 12 }} />}
        </button>
        <Folder size={16} className="group-icon" />
        {isEditing ? (
          <input
            className="group-edit-input"
            value={editName}
            onChange={(e) => onEditNameChange(e.target.value)}
            onBlur={() => onSubmitEdit(group.id)}
            onKeyDown={(e) => onKeyDown(e as unknown as KeyboardEvent, group.id)}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="group-name"
            onDoubleClick={(e) => {
              e.stopPropagation();
              onSetEditingGroupId(group.id);
              onEditNameChange(group.name);
            }}
          >
            {group.name}
          </span>
        )}
        <div className="group-actions" onClick={(e) => e.stopPropagation()}>
          <button className="item-action-btn" onClick={() => onCreateSheetInGroup(group.id)} title="新建文稿">
            <Plus size={12} />
          </button>
          <button className="item-action-btn" onClick={onDeleteGroup} title="删除分组">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="group-children">
          {childGroups.map((cg) => (
            <GroupItem
              key={cg.id}
              group={cg}
              level={level + 1}
              selectedGroupId={selectedGroupId}
              selectedSheetId={selectedSheetId}
              selectedIds={selectedIds}
              batchMode={batchMode}
              draggingId={draggingId}
              dragOverGroupId={dragOverGroupId}
              editingGroupId={editingGroupId}
              editName={editName}
              renamingSheetId={renamingSheetId}
              renameValue={renameValue}
              searchQuery={searchQuery}
              onSelectGroup={() => useNoteStore.getState().selectGroup(cg.id)}
              onSelectSheet={onSelectSheet}
              onToggleSelect={onToggleSelect}
              onToggleCheck={onToggleCheck}
              onCreateSheetInGroup={onCreateSheetInGroup}
              onDeleteGroup={() => useNoteStore.getState().deleteGroup(cg.id)}
              onDeleteSheet={onDeleteSheet}
              onEditNameChange={onEditNameChange}
              onSubmitEdit={onSubmitEdit}
              onKeyDown={onKeyDown}
              onSetEditingGroupId={onSetEditingGroupId}
              onContextMenuGroup={onContextMenuGroup}
              onContextMenuSheet={onContextMenuSheet}
              onRenameSheet={onRenameSheet}
              onRenameChange={onRenameChange}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onGroupDragOver={onGroupDragOver}
              onGroupDrop={onGroupDrop}
            />
          ))}
          {childSheets.map((sheet) => (
            <SheetItem
              key={sheet.id}
              sheet={sheet}
              isSelected={selectedSheetId === sheet.id}
              isChecked={selectedIds.has(sheet.id)}
              isDragging={draggingId === sheet.id}
              batchMode={batchMode}
              renamingId={renamingSheetId}
              renameValue={renameValue}
              searchQuery={searchQuery}
              snippet=""
              onSelect={(e) => {
                if (batchMode) {
                  onToggleCheck(sheet.id);
                } else if (e.ctrlKey || e.metaKey || e.shiftKey || selectedIds.size > 0) {
                  onToggleSelect(sheet.id, e);
                } else {
                  onSelectSheet(sheet.id);
                }
              }}
              onContextMenu={(e) => onContextMenuSheet?.(e, sheet.id, sheet.title)}
              onToggleCheck={() => onToggleCheck(sheet.id)}
              onRenameChange={onRenameChange}
              onRenameSubmit={() => onRenameSubmit(sheet.id)}
              onRenameCancel={onRenameCancel}
              onDelete={() => onDeleteSheet(sheet.id, sheet.title)}
              onDragStart={(e) => onDragStart(e, sheet.id)}
              onDragEnd={onDragEnd}
              paddingLeft={12 + (level + 1) * 16}
            />
          ))}
        </div>
      )}
    </div>
  );
}

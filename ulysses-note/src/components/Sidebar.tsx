import { useState, type KeyboardEvent } from 'react';
import { useNoteStore } from '../store/useNoteStore';
import {
  Folder,
  FileText,
  FileType,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  Search,
  Sun,
  Moon,
  ListMusic,
  File,
  Settings,
} from 'lucide-react';
import { CreateSheetModal } from './CreateSheetModal';
import { SettingsModal } from './SettingsModal';
import { LanguageIcon } from '../utils/languageUtils';

export function Sidebar() {
  const {
    groups,
    getChildGroups,
    getSheetsByGroup,
    selectedSheetId,
    selectedGroupId,
    searchQuery,
    preferences,
    selectSheet,
    selectGroup,
    createGroup,
    deleteSheet,
    deleteGroup,
    updateGroup,
    setSearchQuery,
    updatePreferences,
  } = useNoteStore();

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createInGroupId, setCreateInGroupId] = useState<string | undefined>(undefined);
  const [showSettings, setShowSettings] = useState(false);

  // Get root groups and ungrouped sheets
  const rootGroups = getChildGroups(null);
  const ungroupedSheets = getSheetsByGroup(null);

  const openCreateModal = (groupId?: string) => {
    setCreateInGroupId(groupId);
    setShowCreateModal(true);
  };

  const handleGroupDoubleClick = (group: { id: string; name: string }) => {
    setEditingGroupId(group.id);
    setEditName(group.name);
  };

  const handleGroupNameSubmit = (groupId: string) => {
    if (editName.trim()) {
      updateGroup(groupId, { name: editName.trim() });
    }
    setEditingGroupId(null);
  };

  const handleGroupNameKeyDown = (e: KeyboardEvent, groupId: string) => {
    if (e.key === 'Enter') handleGroupNameSubmit(groupId);
    if (e.key === 'Escape') setEditingGroupId(null);
  };

  const toggleTheme = () => {
    const next = preferences.theme === 'light' ? 'dark' : 'light';
    updatePreferences({ theme: next });
    document.documentElement.setAttribute('data-theme', next);
  };

  const currentTheme = preferences.theme;

  return (
    <aside className="sidebar" style={{ width: preferences.sidebarWidth }}>
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-title">
          <ListMusic size={20} />
          <span>Ulysses Note</span>
        </div>
        <div className="sidebar-header-actions">
          <button
            className="icon-btn"
            onClick={toggleTheme}
            title={currentTheme === 'dark' ? '切换亮色模式' : '切换暗色模式'}
          >
            {currentTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            className="icon-btn"
            onClick={() => setShowSettings(true)}
            title="设置"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="sidebar-search">
        <Search size={14} className="search-icon" />
        <input
          type="text"
          placeholder="搜索文稿..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Quick actions */}
      <div className="sidebar-actions">
        <button className="action-btn" onClick={() => openCreateModal()}>
          <Plus size={14} />
          <span>新建文稿</span>
        </button>
        <button className="action-btn" onClick={() => createGroup('新建分组', null)}>
          <Folder size={14} />
          <span>新建分组</span>
        </button>
      </div>

      {/* Group list */}
      <div className="sidebar-groups">
        {/* Root groups */}
        {rootGroups.map((group) => (
          <GroupItem
            key={group.id}
            group={group}
            level={0}
            selectedGroupId={selectedGroupId}
            selectedSheetId={selectedSheetId}
            isEditing={editingGroupId === group.id}
            editName={editName}
            onSelectGroup={() => selectGroup(group.id)}
            onSelectSheet={selectSheet}
            onCreateSheetInGroup={(gid) => openCreateModal(gid)}
            onDeleteGroup={() => {
              if (confirm(`删除分组"${group.name}"？分组内的文稿将移出分组。`)) {
                deleteGroup(group.id);
              }
            }}
            onDeleteSheet={(sheetId) => {
              if (confirm('确定删除此文稿？')) deleteSheet(sheetId);
            }}
            onStartEdit={() => handleGroupDoubleClick(group)}
            onEditNameChange={setEditName}
            onSubmitEdit={() => handleGroupNameSubmit(group.id)}
            onKeyDown={(e) => handleGroupNameKeyDown(e, group.id)}
          />
        ))}

        {/* Ungrouped sheets */}
        {ungroupedSheets.length > 0 && rootGroups.length > 0 && (
          <div className="group-divider" />
        )}
        <div className="ungrouped-section">
          {ungroupedSheets.length > 0 && rootGroups.length === 0 && (
            <div className="group-label">文稿</div>
          )}
          {ungroupedSheets.map((sheet) => (
            <div
              key={sheet.id}
              className={`sheet-item ${selectedSheetId === sheet.id ? 'active' : ''}`}
              onClick={() => selectSheet(sheet.id)}
            >
              <span className="sheet-icon">{getSheetIcon(sheet.type, sheet.language)}</span>
              <span className="sheet-title">{sheet.title || '未命名文稿'}</span>
              {sheet.type === 'code' && sheet.language && (
                <span className="sheet-lang-badge">{sheet.language}</span>
              )}
              <button
                className="item-delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('确定删除此文稿？')) deleteSheet(sheet.id);
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
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

      {/* Create modal */}
      {showCreateModal && (
        <CreateSheetModal
          groupId={createInGroupId}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </aside>
  );
}

interface GroupItemProps {
  group: { id: string; name: string; collapsed?: boolean };
  level: number;
  selectedGroupId: string | null;
  selectedSheetId: string | null;
  isEditing: boolean;
  editName: string;
  onSelectGroup: () => void;
  onSelectSheet: (id: string) => void;
  onDeleteGroup: () => void;
  onDeleteSheet: (id: string) => void;
  onStartEdit: () => void;
  onEditNameChange: (name: string) => void;
  onSubmitEdit: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
  onCreateSheetInGroup: (groupId: string) => void;
}

function getSheetIcon(type?: string, language?: string | null) {
  if (type === 'code') return <LanguageIcon language={language} size={14} />;
  if (type === 'markdown') return <FileType size={14} />;
  return <File size={14} />;
}

function GroupItem({
  group,
  level,
  selectedGroupId,
  selectedSheetId,
  isEditing,
  editName,
  onSelectGroup,
  onSelectSheet,
  onDeleteGroup,
  onDeleteSheet,
  onStartEdit,
  onEditNameChange,
  onSubmitEdit,
  onKeyDown,
  onCreateSheetInGroup,
}: GroupItemProps) {
  const { groups: allGroups, getChildGroups, getSheetsByGroup, updateGroup } = useNoteStore();
  const [collapsed, setCollapsed] = useState(group.collapsed ?? false);

  const childGroups = getChildGroups(group.id);
  const childSheets = getSheetsByGroup(group.id);

  const isSelected = selectedGroupId === group.id;
  const hasChildren = childGroups.length > 0 || childSheets.length > 0;

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    updateGroup(group.id, { collapsed: next });
  };

  const handleGroupClick = () => {
    if (hasChildren) toggleCollapse();
    onSelectGroup();
  };

  return (
    <div className="group-wrapper">
      <div
        className={`group-item ${isSelected ? 'active' : ''}`}
        style={{ paddingLeft: 12 + level * 16 }}
        onClick={handleGroupClick}
      >
        <button
          className="collapse-btn"
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapse();
          }}
        >
          {hasChildren ? (
            collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />
          ) : (
            <span style={{ width: 12 }} />
          )}
        </button>
        <Folder size={16} className="group-icon" />

        {isEditing ? (
          <input
            className="group-edit-input"
            value={editName}
            onChange={(e) => onEditNameChange(e.target.value)}
            onBlur={onSubmitEdit}
            onKeyDown={onKeyDown}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="group-name" onDoubleClick={onStartEdit}>
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
          {/* Child groups */}
          {childGroups.map((cg) => (
            <GroupItem
              key={cg.id}
              group={cg}
              level={level + 1}
              selectedGroupId={selectedGroupId}
              selectedSheetId={selectedSheetId}
              isEditing={false}
              editName=""
              onSelectGroup={() => useNoteStore.getState().selectGroup(cg.id)}
              onSelectSheet={onSelectSheet}
              onDeleteGroup={() => {
                if (confirm(`删除分组"${cg.name}"？`)) {
                  useNoteStore.getState().deleteGroup(cg.id);
                }
              }}
              onDeleteSheet={onDeleteSheet}
              onStartEdit={() => {}}
              onEditNameChange={() => {}}
              onSubmitEdit={() => {}}
              onKeyDown={() => {}}
              onCreateSheetInGroup={onCreateSheetInGroup}
            />
          ))}

          {/* Sheets in this group */}
          {childSheets.map((sheet) => (
            <div
              key={sheet.id}
              className={`sheet-item ${selectedSheetId === sheet.id ? 'active' : ''}`}
              style={{ paddingLeft: 12 + (level + 1) * 16 }}
              onClick={() => onSelectSheet(sheet.id)}
            >
              <span className="sheet-icon">{getSheetIcon(sheet.type, sheet.language)}</span>
              <span className="sheet-title">{sheet.title || '未命名文稿'}</span>
              {sheet.type === 'code' && sheet.language && (
                <span className="sheet-lang-badge">{sheet.language}</span>
              )}
              <button
                className="item-delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSheet(sheet.id);
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

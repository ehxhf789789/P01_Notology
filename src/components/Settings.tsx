import { useState, useMemo, useCallback } from 'react';
import { useVaultPath } from '../stores/zustand/fileTreeStore';
import { useSettingsStore, type ThemeSetting, type FontSetting, type LanguageSetting, type CustomFont } from '../stores/zustand/settingsStore';
import { useTemplateStore } from '../stores/zustand/templateStore';
import { refreshActions } from '../stores/zustand/refreshStore';
import { t } from '../utils/i18n';
import NoteTemplateEditor from './NoteTemplateEditor';
import KeyboardShortcuts from './KeyboardShortcuts';
import type { NoteTemplate } from '../types';
import { getUnusedTags, removeUnusedTags } from '../utils/tagOntologyUtils';

interface WindowSizePreset {
  id: string;
  labelKey: 'windowSizeSmall' | 'windowSizeMedium' | 'windowSizeLarge' | 'windowSizeWide';
  width: number;
  height: number;
}

const WINDOW_SIZE_PRESETS: WindowSizePreset[] = [
  { id: 'small', labelKey: 'windowSizeSmall', width: 600, height: 500 },
  { id: 'medium', labelKey: 'windowSizeMedium', width: 800, height: 600 },
  { id: 'large', labelKey: 'windowSizeLarge', width: 1000, height: 800 },
  { id: 'wide', labelKey: 'windowSizeWide', width: 1200, height: 700 },
];

interface SettingsProps {
  onClose: () => void;
}

type SettingsTab = 'general' | 'editor' | 'templates' | 'shortcuts';

function Settings({ onClose }: SettingsProps) {
  const vaultPath = useVaultPath();
  const {
    toolbarDefaultCollapsed, setToolbarDefaultCollapsed,
    hoverZoomEnabled, setHoverZoomEnabled, hoverZoomLevel, hoverDefaultWidth, hoverDefaultHeight, setHoverDefaultSize,
    theme, setTheme, font, setFont, customFonts, selectedCustomFont, addCustomFont, removeCustomFont, language, setLanguage,
  } = useSettingsStore();
  const {
    noteTemplates, enabledTemplateIds, addNoteTemplate, updateNoteTemplate, removeNoteTemplate, toggleTemplateEnabled,
    customShortcuts, setCustomShortcuts,
  } = useTemplateStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [editingNoteTemplate, setEditingNoteTemplate] = useState<NoteTemplate | null>(null);
  const [isCreatingNoteTemplate, setIsCreatingNoteTemplate] = useState(false);
  const [newFontName, setNewFontName] = useState('');
  const [newFontFamily, setNewFontFamily] = useState('');
  const [showAddFontModal, setShowAddFontModal] = useState(false);

  // Unused tag cleanup state
  const [unusedTags, setUnusedTags] = useState<string[]>([]);
  const [isLoadingUnused, setIsLoadingUnused] = useState(false);
  const [showUnusedTagsModal, setShowUnusedTagsModal] = useState(false);

  // Load unused tags
  const handleLoadUnusedTags = useCallback(async () => {
    if (!vaultPath) return;
    setIsLoadingUnused(true);
    try {
      const tags = await getUnusedTags(vaultPath);
      setUnusedTags(tags);
      setShowUnusedTagsModal(true);
    } catch (error) {
      console.error('Failed to load unused tags:', error);
    } finally {
      setIsLoadingUnused(false);
    }
  }, [vaultPath]);

  // Remove selected unused tags
  const handleRemoveUnusedTags = useCallback(async (tagIds: string[]) => {
    if (!vaultPath || tagIds.length === 0) return;
    try {
      await removeUnusedTags(vaultPath, tagIds);
      // Refresh the list
      const remaining = unusedTags.filter(t => !tagIds.includes(t));
      setUnusedTags(remaining);
      refreshActions.incrementOntologyRefresh();
      if (remaining.length === 0) {
        setShowUnusedTagsModal(false);
      }
    } catch (error) {
      console.error('Failed to remove unused tags:', error);
    }
  }, [vaultPath, unusedTags]);

  // Find current size preset
  const currentSizePreset = useMemo(() => {
    return WINDOW_SIZE_PRESETS.find(
      p => p.width === hoverDefaultWidth && p.height === hoverDefaultHeight
    )?.id || 'custom';
  }, [hoverDefaultWidth, hoverDefaultHeight]);

  const TABS: { id: SettingsTab; label: string }[] = [
    { id: 'general', label: t('general', language) },
    { id: 'editor', label: t('editor', language) },
    { id: 'templates', label: t('templates', language) },
    { id: 'shortcuts', label: t('shortcuts', language) },
  ];

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  const handleAddFont = () => {
    if (newFontName.trim() && newFontFamily.trim()) {
      const fontData: CustomFont = {
        name: newFontName.trim(),
        family: newFontFamily.trim(),
      };
      addCustomFont(fontData, vaultPath);
      setNewFontName('');
      setNewFontFamily('');
      setShowAddFontModal(false);
    }
  };

  return (
    <div className="settings-overlay" onClick={handleBackdropClick} onKeyDown={handleKeyDown}>
      <div className="settings-modal">
        <div className="settings-modal-header">
          <h2 className="settings-modal-title">{t('settings', language)}</h2>
          <button className="settings-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="settings-modal-content">
          {/* Tab Navigation */}
          <nav className="settings-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Tab Content */}
          <div className="settings-tab-content">
            {activeTab === 'general' && (
              <div className="settings-panel">
                <section className="settings-section">
                  <h3 className="settings-section-title">{t('appearance', language)}</h3>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <span className="settings-row-label">{t('theme', language)}</span>
                      <span className="settings-row-desc">{t('themeDesc', language)}</span>
                    </div>
                    <select
                      className="settings-select"
                      value={theme}
                      onChange={e => setTheme(e.target.value as ThemeSetting, vaultPath)}
                    >
                      <option value="dark">{t('themeDark', language)}</option>
                      <option value="light">{t('themeLight', language)}</option>
                      <option value="system">{t('themeSystem', language)}</option>
                    </select>
                  </div>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <span className="settings-row-label">{t('font', language)}</span>
                      <span className="settings-row-desc">{t('fontDesc', language)}</span>
                    </div>
                    <select
                      className="settings-select"
                      value={font === 'custom' ? `custom:${selectedCustomFont}` : font}
                      onChange={e => {
                        const value = e.target.value;
                        if (value.startsWith('custom:')) {
                          const fontName = value.replace('custom:', '');
                          setFont('custom', vaultPath, fontName);
                        } else {
                          setFont(value as FontSetting, vaultPath);
                        }
                      }}
                    >
                      <option value="default">{t('fontDefault', language)}</option>
                      <option value="nanum">Nanum Gothic</option>
                      <option value="noto">Noto Sans KR</option>
                      <option value="malgun">Malgun Gothic</option>
                      {customFonts.map(cf => (
                        <option key={cf.name} value={`custom:${cf.name}`}>{cf.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Custom Fonts Section */}
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <span className="settings-row-label">{t('customFonts', language)}</span>
                      <span className="settings-row-desc">{language === 'ko' ? '시스템에 설치된 글꼴을 추가합니다' : 'Add fonts installed on your system'}</span>
                    </div>
                    <button
                      className="settings-action-btn"
                      onClick={() => setShowAddFontModal(true)}
                    >
                      + {t('addFont', language)}
                    </button>
                  </div>

                  {customFonts.length > 0 && (
                    <div className="custom-fonts-list">
                      {customFonts.map(cf => (
                        <div key={cf.name} className="custom-font-item">
                          <span className="custom-font-name" style={{ fontFamily: cf.family }}>{cf.name}</span>
                          <span className="custom-font-family">{cf.family}</span>
                          <button
                            className="custom-font-remove"
                            onClick={() => removeCustomFont(cf.name, vaultPath)}
                            title={t('removeFont', language)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="settings-section">
                  <h3 className="settings-section-title">{t('languageRegion', language)}</h3>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <span className="settings-row-label">{t('language', language)}</span>
                      <span className="settings-row-desc">{t('languageDesc', language)}</span>
                    </div>
                    <select
                      className="settings-select"
                      value={language}
                      onChange={e => setLanguage(e.target.value as LanguageSetting, vaultPath)}
                    >
                      <option value="ko">한국어</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'editor' && (
              <div className="settings-panel">
                <section className="settings-section">
                  <h3 className="settings-section-title">{t('editingToolbar', language)}</h3>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <span className="settings-row-label">{t('defaultCollapsed', language)}</span>
                      <span className="settings-row-desc">{t('defaultCollapsedDesc', language)}</span>
                    </div>
                    <button
                      className={`settings-toggle-btn ${toolbarDefaultCollapsed ? 'active' : ''}`}
                      onClick={() => setToolbarDefaultCollapsed(!toolbarDefaultCollapsed, vaultPath)}
                    >
                      {toolbarDefaultCollapsed ? t('on', language) : t('off', language)}
                    </button>
                  </div>
                </section>

                <section className="settings-section">
                  <h3 className="settings-section-title">{t('popupWindow', language)}</h3>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <span className="settings-row-label">{t('ctrlScrollZoom', language)}</span>
                      <span className="settings-row-desc">{t('ctrlScrollZoomDesc', language)}</span>
                    </div>
                    <button
                      className={`settings-toggle-btn ${hoverZoomEnabled ? 'active' : ''}`}
                      onClick={() => setHoverZoomEnabled(!hoverZoomEnabled, vaultPath)}
                    >
                      {hoverZoomEnabled ? t('on', language) : t('off', language)}
                    </button>
                  </div>
                  {hoverZoomEnabled && (
                    <div className="settings-row">
                      <div className="settings-row-info">
                        <span className="settings-row-label">{t('currentZoomLevel', language)}</span>
                        <span className="settings-row-desc">{hoverZoomLevel}% (50% ~ 200%)</span>
                      </div>
                    </div>
                  )}
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <span className="settings-row-label">{t('defaultWindowSize', language)}</span>
                      <span className="settings-row-desc">{t('defaultWindowSizeDesc', language)}</span>
                    </div>
                  </div>
                  <div className="window-size-selector">
                    {WINDOW_SIZE_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        className={`window-size-option ${currentSizePreset === preset.id ? 'active' : ''}`}
                        onClick={() => setHoverDefaultSize(preset.width, preset.height, vaultPath)}
                        title={`${preset.width} × ${preset.height}`}
                      >
                        <div className="window-size-preview-container">
                          <div
                            className="window-size-preview"
                            style={{
                              width: `${(preset.width / 1400) * 100}%`,
                              height: `${(preset.height / 900) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="window-size-label">{t(preset.labelKey, language)}</span>
                        <span className="window-size-dimensions">{preset.width} × {preset.height}</span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'templates' && (
              <div className="settings-panel">
                {(editingNoteTemplate || isCreatingNoteTemplate) ? (
                  <NoteTemplateEditor
                    template={editingNoteTemplate || undefined}
                    onSave={(tmpl) => {
                      if (editingNoteTemplate) {
                        updateNoteTemplate(tmpl, vaultPath);
                      } else {
                        addNoteTemplate(tmpl, vaultPath);
                      }
                      setEditingNoteTemplate(null);
                      setIsCreatingNoteTemplate(false);
                    }}
                    onCancel={() => {
                      setEditingNoteTemplate(null);
                      setIsCreatingNoteTemplate(false);
                    }}
                  />
                ) : (
                  <section className="settings-section">
                    <div className="settings-section-header">
                      <h3 className="settings-section-title">{t('noteTemplates', language)}</h3>
                      <button
                        className="template-add-btn-v2"
                        onClick={() => setIsCreatingNoteTemplate(true)}
                        title={language === 'ko' ? '새 템플릿' : 'New Template'}
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                          <path d="M7 0a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2H8v5a1 1 0 1 1-2 0V8H1a1 1 0 0 1 0-2h5V1a1 1 0 0 1 1-1z"/>
                        </svg>
                        <span>{language === 'ko' ? '새 템플릿' : 'New Template'}</span>
                      </button>
                    </div>
                    <p className="settings-section-desc">{t('noteTemplatesDesc', language)}</p>
                    <div className="template-grid">
                      {noteTemplates.map(nt => {
                        const typeClass = nt.frontmatter.cssclasses?.[0] || '';
                        const noteType = nt.frontmatter.type?.toLowerCase() || 'note';
                        const customColor = nt.customColor;
                        const isBuiltIn = nt.id.startsWith('note-') && !nt.id.startsWith('note-custom-');
                        const isEnabled = enabledTemplateIds.includes(nt.id);
                        const descriptions: Record<string, { ko: string; en: string }> = {
                          'NOTE': { ko: '자유롭게 작성하는 기본 노트', en: 'General purpose note' },
                          'SKETCH': { ko: '캔버스 기반의 자유로운 메모', en: 'Canvas-based free-form memo' },
                          'MTG': { ko: '회의 참석자, 안건, 결정사항 기록', en: 'Meeting attendees, agenda, decisions' },
                          'SEM': { ko: '세미나 및 강연 내용 정리', en: 'Seminar and lecture notes' },
                          'EVENT': { ko: '행사 일정과 세부 정보 관리', en: 'Event schedule and details' },
                          'OFA': { ko: '공식 문서와 업무 기록 관리', en: 'Official documents and records' },
                          'PAPER': { ko: '학술 논문 정보와 메모 저장', en: 'Academic paper info and notes' },
                          'LIT': { ko: '도서 및 참고 자료 관리', en: 'Books and reference materials' },
                          'DATA': { ko: '데이터 및 자료를 체계적으로 정리', en: 'Organized data and materials' },
                          'THEO': { ko: '개념과 이론 정리 및 학습', en: 'Concepts and theory notes' },
                          'CONTACT': { ko: '인물 정보와 연락처 관리', en: 'Contact information management' },
                          'SETUP': { ko: '환경 설정과 구성 정보 기록', en: 'Settings and configuration' },
                        };
                        const desc = descriptions[nt.frontmatter.type || 'NOTE'] || { ko: '사용자 정의 템플릿', en: 'Custom template' };
                        return (
                          <div
                            key={nt.id}
                            className={`template-card${typeClass ? ' ' + typeClass : ''}${customColor ? ' has-custom-color' : ''}${!isEnabled ? ' template-disabled' : ''}`}
                            style={customColor ? { '--template-color': customColor } as React.CSSProperties : undefined}
                          >
                            <div className="template-card-header">
                              <label className="template-card-checkbox">
                                <input
                                  type="checkbox"
                                  checked={isEnabled}
                                  onChange={() => toggleTemplateEnabled(nt.id, vaultPath)}
                                />
                              </label>
                              <span
                                className={`template-card-icon icon-${noteType}`}
                                style={customColor ? { backgroundColor: customColor } : undefined}
                              />
                            </div>
                            <div className="template-card-body">
                              <div className="template-card-title-row">
                                <span className="template-card-name">{nt.name}</span>
                                <span
                                  className="template-card-prefix"
                                  style={customColor ? { color: customColor, borderColor: customColor } : undefined}
                                >
                                  {nt.prefix}
                                </span>
                              </div>
                              <p className="template-card-desc">{language === 'ko' ? desc.ko : desc.en}</p>
                            </div>
                            <div className="template-card-footer">
                              {isBuiltIn ? (
                                <span className="template-card-badge">{language === 'ko' ? '기본' : 'Built-in'}</span>
                              ) : (
                                <div className="template-card-actions">
                                  <button className="template-card-action-btn" onClick={() => setEditingNoteTemplate(nt)}>
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                                      <path d="M9.1 1.2a1 1 0 0 1 1.4 0l.3.3a1 1 0 0 1 0 1.4l-7 7-2.1.4.4-2.1 7-7zM8 2.6L2.2 8.4l-.2.9.9-.2L8.7 3.3 8 2.6z"/>
                                    </svg>
                                  </button>
                                  <button className="template-card-action-btn delete" onClick={() => removeNoteTemplate(nt.id, vaultPath)}>
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                                      <path d="M4.5 1.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5V2h2.5a.5.5 0 0 1 0 1H2a.5.5 0 0 1 0-1h2.5v-.5zM3 4v6.5a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V4H3zm2 1.5a.5.5 0 0 1 1 0v4a.5.5 0 0 1-1 0v-4zm2.5 0a.5.5 0 0 1 1 0v4a.5.5 0 0 1-1 0v-4z"/>
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )}
              </div>
            )}

            {activeTab === 'shortcuts' && (
              <div className="settings-panel">
                <KeyboardShortcuts
                  customShortcuts={customShortcuts}
                  onUpdateShortcuts={(shortcuts) => setCustomShortcuts(shortcuts, vaultPath)}
                />
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Add Font Modal */}
      {showAddFontModal && (
        <div className="settings-modal-overlay" onClick={() => setShowAddFontModal(false)}>
          <div className="add-font-modal" onClick={e => e.stopPropagation()}>
            <h3>{t('addFont', language)}</h3>
            <div className="add-font-form">
              <label>
                {language === 'ko' ? '글꼴 이름' : 'Font Name'}
                <input
                  type="text"
                  value={newFontName}
                  onChange={e => setNewFontName(e.target.value)}
                  placeholder={language === 'ko' ? '표시될 이름' : 'Display name'}
                />
              </label>
              <label>
                {language === 'ko' ? '글꼴 패밀리' : 'Font Family'}
                <input
                  type="text"
                  value={newFontFamily}
                  onChange={e => setNewFontFamily(e.target.value)}
                  placeholder={language === 'ko' ? '예: "D2Coding", monospace' : 'e.g., "D2Coding", monospace'}
                />
              </label>
              <div className="add-font-help">
                <p className="add-font-help-title">
                  {language === 'ko' ? '사용 방법' : 'How to use'}
                </p>
                <ol className="add-font-help-list">
                  {language === 'ko' ? (
                    <>
                      <li><strong>글꼴 이름:</strong> 설정에서 표시될 이름입니다. 원하는 이름을 자유롭게 입력하세요.</li>
                      <li><strong>글꼴 패밀리:</strong> CSS font-family 값입니다. 시스템에 설치된 글꼴의 정확한 이름을 따옴표로 감싸서 입력하세요.</li>
                    </>
                  ) : (
                    <>
                      <li><strong>Font Name:</strong> Display name shown in settings. Enter any name you prefer.</li>
                      <li><strong>Font Family:</strong> CSS font-family value. Enter the exact font name installed on your system, wrapped in quotes.</li>
                    </>
                  )}
                </ol>
                <p className="add-font-help-example">
                  {language === 'ko' ? '예시:' : 'Examples:'}
                </p>
                <ul className="add-font-example-list">
                  <li><code>"D2Coding"</code></li>
                  <li><code>"Noto Sans KR", sans-serif</code></li>
                  <li><code>"JetBrains Mono", monospace</code></li>
                </ul>
              </div>
              <div className="add-font-actions">
                <button onClick={() => setShowAddFontModal(false)}>{t('cancel', language)}</button>
                <button onClick={handleAddFont} className="primary">{t('save', language)}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unused Tags Modal */}
      {showUnusedTagsModal && (
        <div className="settings-modal-overlay" onClick={() => setShowUnusedTagsModal(false)}>
          <div className="unused-tags-modal" onClick={e => e.stopPropagation()}>
            <h3>{language === 'ko' ? '미사용 태그' : 'Unused Tags'}</h3>
            {unusedTags.length === 0 ? (
              <p className="unused-tags-empty">
                {language === 'ko' ? '미사용 태그가 없습니다.' : 'No unused tags found.'}
              </p>
            ) : (
              <>
                <p className="unused-tags-info">
                  {language === 'ko'
                    ? `${unusedTags.length}개의 태그가 어떤 노트에서도 사용되지 않습니다.`
                    : `${unusedTags.length} tag(s) are not used in any note.`}
                </p>
                <div className="unused-tags-list">
                  {unusedTags.map(tagId => (
                    <div key={tagId} className="unused-tag-item">
                      <span className="unused-tag-name">#{tagId}</span>
                      <button
                        className="unused-tag-remove"
                        onClick={() => handleRemoveUnusedTags([tagId])}
                        title={language === 'ko' ? '삭제' : 'Remove'}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="unused-tags-actions">
                  <button onClick={() => setShowUnusedTagsModal(false)}>
                    {language === 'ko' ? '닫기' : 'Close'}
                  </button>
                  <button
                    className="danger"
                    onClick={() => handleRemoveUnusedTags(unusedTags)}
                  >
                    {language === 'ko' ? `모두 삭제 (${unusedTags.length}개)` : `Remove All (${unusedTags.length})`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;

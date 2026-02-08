import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useModalStore } from '../stores/zustand/modalStore';
import { useTemplateStore } from '../stores/zustand/templateStore';

// Template descriptions for each type
const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  'NOTE': '일반 노트 - 자유롭게 작성하는 기본 노트입니다',
  'SKETCH': '스케치 - 캔버스 기반의 자유로운 메모입니다',
  'MTG': '회의록 - 참석자, 안건, 결정사항을 기록합니다',
  'SEM': '세미나 - 세미나 및 강연 내용을 정리합니다',
  'EVENT': '이벤트 - 행사 일정과 세부 정보를 관리합니다',
  'OFA': '공문서 - 공식 문서와 업무 기록을 관리합니다',
  'PAPER': '논문 - 학술 논문 정보와 메모를 저장합니다',
  'LIT': '문헌 - 도서 및 참고 자료를 관리합니다',
  'DATA': '데이터 - 데이터 및 자료를 체계적으로 정리합니다',
  'THEO': '이론 - 개념과 이론을 정리하고 학습합니다',
  'CONTACT': '연락처 - 인물 정보와 연락처를 관리합니다',
  'SETUP': '설정 - 환경 설정과 구성 정보를 기록합니다',
};

// Default description for custom templates
const DEFAULT_CUSTOM_DESCRIPTION = '사용자 정의 템플릿입니다';

function TemplateSelector() {
  const templateSelectorState = useModalStore(s => s.templateSelectorState);
  const hideTemplateSelector = useModalStore(s => s.hideTemplateSelector);
  const noteTemplates = useTemplateStore(s => s.noteTemplates);
  const enabledTemplateIds = useTemplateStore(s => s.enabledTemplateIds);
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!templateSelectorState) {
      setSearchTerm('');
      return;
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        hideTemplateSelector();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hideTemplateSelector();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    // Focus search input when opened
    setTimeout(() => searchInputRef.current?.focus(), 50);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [templateSelectorState, hideTemplateSelector]);

  useLayoutEffect(() => {
    if (!templateSelectorState?.visible || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const { position } = templateSelectorState;
    let x = position.x, y = position.y;
    if (x + rect.width > window.innerWidth - 8) x = window.innerWidth - rect.width - 8;
    if (y + rect.height > window.innerHeight - 8) y = window.innerHeight - rect.height - 8;
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    setAdjustedPos({ x, y });
  }, [templateSelectorState]);

  if (!templateSelectorState || !templateSelectorState.visible) return null;

  const { callback } = templateSelectorState;

  const handleSelect = (templateId: string) => {
    callback(templateId);
    hideTemplateSelector();
  };

  // Filter templates based on enabled status and search term
  const filteredTemplates = noteTemplates.filter(t => {
    // Only show enabled templates
    if (!enabledTemplateIds.includes(t.id)) return false;
    // Apply search filter
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      t.name.toLowerCase().includes(search) ||
      t.prefix.toLowerCase().includes(search) ||
      (t.frontmatter.type?.toLowerCase() || '').includes(search)
    );
  });

  // Separate default and custom templates
  const defaultTemplates = filteredTemplates.filter(t => t.id.startsWith('note-') && !t.id.startsWith('note-custom-'));
  const customTemplates = filteredTemplates.filter(t => !t.id.startsWith('note-') || t.id.startsWith('note-custom-'));

  const getDescription = (template: typeof noteTemplates[0]): string => {
    const type = template.frontmatter.type?.toUpperCase() || '';
    return TEMPLATE_DESCRIPTIONS[type] || DEFAULT_CUSTOM_DESCRIPTION;
  };

  const renderTemplateItem = (t: typeof noteTemplates[0]) => {
    const typeClass = t.frontmatter.cssclasses?.[0] || '';
    const noteType = t.frontmatter.type?.toLowerCase() || '';
    const customColor = t.customColor;
    const description = getDescription(t);

    const itemStyle = customColor ? {
      '--template-color': customColor,
      borderLeftColor: customColor,
    } as React.CSSProperties : undefined;

    return (
      <button
        key={t.id}
        className={`template-selector-item-v2${typeClass ? ' ' + typeClass : ''}${customColor ? ' has-custom-color' : ''}`}
        onClick={() => handleSelect(t.id)}
        style={itemStyle}
      >
        <span
          className={`template-selector-icon-v2 icon-${noteType}`}
          style={customColor ? { backgroundColor: customColor } : undefined}
        />
        <div className="template-selector-content">
          <div className="template-selector-header-row">
            <span className="template-selector-name-v2">{t.name}</span>
            <span className="template-selector-prefix">{t.prefix}</span>
          </div>
          <span className="template-selector-desc">{description}</span>
        </div>
      </button>
    );
  };

  return (
    <div
      ref={menuRef}
      className="template-selector-v2"
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
    >
      <div className="template-selector-header-v2">
        <span>템플릿 선택</span>
        <span className="template-selector-hint">Ctrl+N</span>
      </div>

      <div className="template-selector-search">
        <input
          ref={searchInputRef}
          type="text"
          placeholder="템플릿 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="template-selector-search-input"
        />
      </div>

      <div className="template-selector-list">
        {defaultTemplates.length > 0 && (
          <>
            <div className="template-selector-section-label">기본 템플릿</div>
            {defaultTemplates.map(renderTemplateItem)}
          </>
        )}

        {customTemplates.length > 0 && (
          <>
            <div className="template-selector-section-label">사용자 템플릿</div>
            {customTemplates.map(renderTemplateItem)}
          </>
        )}

        {filteredTemplates.length === 0 && (
          <div className="template-selector-empty">
            검색 결과가 없습니다
          </div>
        )}
      </div>
    </div>
  );
}

export default TemplateSelector;

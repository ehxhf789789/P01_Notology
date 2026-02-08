export interface ShortcutBinding {
  id: string;
  label: string;
  category: 'text' | 'heading' | 'list' | 'block' | 'system' | 'navigation';
  defaultKeys: string;
  customKeys?: string;
}

export const DEFAULT_SHORTCUTS: ShortcutBinding[] = [
  // Text
  { id: 'bold', label: '굵게', category: 'text', defaultKeys: 'Ctrl+B' },
  { id: 'italic', label: '기울임', category: 'text', defaultKeys: 'Ctrl+I' },
  { id: 'underline', label: '밑줄', category: 'text', defaultKeys: 'Ctrl+U' },
  { id: 'strikethrough', label: '취소선', category: 'text', defaultKeys: 'Ctrl+Shift+X' },
  { id: 'code', label: '코드', category: 'text', defaultKeys: 'Ctrl+E' },
  { id: 'highlight', label: '하이라이트', category: 'text', defaultKeys: 'Ctrl+Shift+H' },

  // Heading
  { id: 'heading1', label: '제목 1 (H1)', category: 'heading', defaultKeys: 'Ctrl+1' },
  { id: 'heading2', label: '제목 2 (H2)', category: 'heading', defaultKeys: 'Ctrl+2' },
  { id: 'heading3', label: '제목 3 (H3)', category: 'heading', defaultKeys: 'Ctrl+3' },
  { id: 'heading4', label: '제목 4 (H4)', category: 'heading', defaultKeys: 'Ctrl+4' },
  { id: 'heading5', label: '제목 5 (H5)', category: 'heading', defaultKeys: 'Ctrl+5' },
  { id: 'heading6', label: '제목 6 (H6)', category: 'heading', defaultKeys: 'Ctrl+6' },

  // List
  { id: 'bulletList', label: '글머리 목록', category: 'list', defaultKeys: 'Ctrl+Shift+8' },
  { id: 'orderedList', label: '번호 목록', category: 'list', defaultKeys: 'Ctrl+Shift+7' },
  { id: 'taskList', label: '체크리스트', category: 'list', defaultKeys: 'Ctrl+Shift+9' },
  { id: 'indent', label: '들여쓰기', category: 'list', defaultKeys: 'Tab' },
  { id: 'outdent', label: '내어쓰기', category: 'list', defaultKeys: 'Shift+Tab' },

  // Block
  { id: 'blockquote', label: '인용', category: 'block', defaultKeys: 'Ctrl+Shift+B' },
  { id: 'codeBlock', label: '코드 블록', category: 'block', defaultKeys: 'Ctrl+Shift+E' },
  { id: 'horizontalRule', label: '구분선', category: 'block', defaultKeys: 'Ctrl+Shift+-' },

  // System
  { id: 'save', label: '저장', category: 'system', defaultKeys: 'Ctrl+S' },
  { id: 'undo', label: '실행 취소', category: 'system', defaultKeys: 'Ctrl+Z' },
  { id: 'redo', label: '다시 실행', category: 'system', defaultKeys: 'Ctrl+Shift+Z' },
  { id: 'deleteNote', label: '노트/폴더 삭제', category: 'system', defaultKeys: 'Ctrl+D' },
  { id: 'toggleMemo', label: 'Hover 창 메모', category: 'system', defaultKeys: 'Ctrl+M' },
  { id: 'toggleMetadata', label: 'Hover 창 메타데이터', category: 'system', defaultKeys: 'Ctrl+Shift+M' },

  // Navigation
  { id: 'newNote', label: '새 노트', category: 'navigation', defaultKeys: 'Ctrl+N' },
  { id: 'search', label: '검색', category: 'navigation', defaultKeys: 'Ctrl+Shift+F' },
  { id: 'calendar', label: '캘린더', category: 'navigation', defaultKeys: 'Ctrl+Shift+C' },
  { id: 'toggleSidebar', label: '사이드바 토글', category: 'navigation', defaultKeys: 'Ctrl+ArrowLeft' },
  { id: 'toggleRightPanel', label: '오른쪽 패널 토글', category: 'navigation', defaultKeys: 'Ctrl+ArrowRight' },
];

export function getActiveKeys(binding: ShortcutBinding): string {
  return binding.customKeys || binding.defaultKeys;
}

export function parseShortcut(keys: string): { ctrl: boolean; shift: boolean; alt: boolean; key: string } {
  const parts = keys.split('+');
  const result = { ctrl: false, shift: false, alt: false, key: '' };
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'ctrl' || lower === 'mod') result.ctrl = true;
    else if (lower === 'shift') result.shift = true;
    else if (lower === 'alt') result.alt = true;
    else result.key = part;
  }
  return result;
}

export const CATEGORY_LABELS: Record<string, string> = {
  text: '텍스트',
  heading: '제목',
  list: '목록',
  block: '블록',
  system: '시스템',
  navigation: '탐색',
};

// QWERTY keyboard layout
export const KEYBOARD_ROWS = [
  ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'"],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'],
];

export function getKeyBindings(shortcuts: ShortcutBinding[]): Map<string, ShortcutBinding[]> {
  const map = new Map<string, ShortcutBinding[]>();
  for (const binding of shortcuts) {
    const keys = getActiveKeys(binding);
    const parsed = parseShortcut(keys);
    const keyUpper = parsed.key.toUpperCase();
    if (!map.has(keyUpper)) {
      map.set(keyUpper, []);
    }
    map.get(keyUpper)!.push(binding);
  }
  return map;
}

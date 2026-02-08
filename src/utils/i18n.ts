// Internationalization utility for Notology

export type LanguageSetting = 'ko' | 'en';

interface Translations {
  // Settings modal
  settings: string;
  general: string;
  editor: string;
  templates: string;
  containers: string;
  shortcuts: string;
  developer: string;

  // General tab - Appearance
  appearance: string;
  theme: string;
  themeDesc: string;
  themeDark: string;
  themeLight: string;
  themeSystem: string;
  font: string;
  fontDesc: string;
  fontDefault: string;
  fontAddCustom: string;
  customFonts: string;
  addFont: string;
  removeFont: string;

  // General tab - Language
  languageRegion: string;
  language: string;
  languageDesc: string;

  // Editor tab
  editingToolbar: string;
  defaultCollapsed: string;
  defaultCollapsedDesc: string;
  popupWindow: string;
  ctrlScrollZoom: string;
  ctrlScrollZoomDesc: string;
  currentZoomLevel: string;
  defaultWindowSize: string;
  defaultWindowSizeDesc: string;
  windowSizeSmall: string;
  windowSizeMedium: string;
  windowSizeLarge: string;
  windowSizeWide: string;

  // Tags tab
  tags: string;
  tagColors: string;
  tagColorsDesc: string;
  addTag: string;
  tagName: string;
  tagNamePlaceholder: string;
  noTagsConfigured: string;

  // Templates tab
  noteTemplates: string;
  noteTemplatesDesc: string;
  edit: string;
  delete: string;

  // Containers tab
  containerSettings: string;
  containerSettingsDesc: string;
  noContainers: string;
  selectTemplate: string;

  // Shortcuts tab
  // (handled by KeyboardShortcuts component)

  // Developer tab
  developerTools: string;
  openDevTools: string;
  openDevToolsDesc: string;
  open: string;

  // Common
  on: string;
  off: string;
  cancel: string;
  save: string;
  close: string;

  // Sidebar
  files: string;
  newNote: string;
  newFolder: string;
  search: string;
  noVaultOpen: string;
  openVault: string;

  // Search
  frontmatter: string;
  contentSearch: string;
  detailedSearch: string;
  searchPlaceholder: string;
  noResults: string;
  results: string;
  createNote: string;
  notes: string;
  body: string;
  attachments: string;
  details: string;
  graph: string;
  titleTagTypeSearch: string;
  bodyContentSearch: string;
  attachmentSearch: string;
  tagSearch: string;
  dateFilter: string;
  typeFilter: string;

  // Context menu
  openInNewWindow: string;
  rename: string;
  moveTo: string;
  copyPath: string;
  revealInExplorer: string;

  // Editor placeholder
  editorPlaceholder: string;
  editorEmptyText: string;

  // Hover windows
  hoverWindows: string;
  activeWindows: string;
  minimizedWindows: string;
}

const ko: Translations = {
  // Settings modal
  settings: '설정',
  general: '일반',
  editor: '편집기',
  templates: '템플릿',
  containers: '컨테이너',
  shortcuts: '단축키',
  developer: '개발자',

  // General tab - Appearance
  appearance: '외관',
  theme: '테마',
  themeDesc: '앱의 색상 테마를 선택합니다',
  themeDark: '다크',
  themeLight: '라이트',
  themeSystem: '시스템 설정 따르기',
  font: '글꼴',
  fontDesc: '편집기 및 UI에 사용할 글꼴을 선택합니다',
  fontDefault: '시스템 기본 (Pretendard)',
  fontAddCustom: '글꼴 추가...',
  customFonts: '사용자 글꼴',
  addFont: '글꼴 추가',
  removeFont: '제거',

  // General tab - Language
  languageRegion: '언어',
  language: '언어',
  languageDesc: '앱 인터페이스 언어를 선택합니다',

  // Editor tab
  editingToolbar: '편집 툴바',
  defaultCollapsed: '기본 접힘 상태',
  defaultCollapsedDesc: '에디터 및 컨테이너 열 때 툴바를 접힌 상태로 시작',
  popupWindow: '팝업 창',
  ctrlScrollZoom: 'Ctrl+스크롤 줌',
  ctrlScrollZoomDesc: '팝업 창에서 Ctrl+스크롤로 글자 크기 조절',
  currentZoomLevel: '현재 줌 레벨',
  defaultWindowSize: '기본 창 크기',
  defaultWindowSizeDesc: '새 팝업 창이 열릴 때의 기본 크기',
  windowSizeSmall: '작게',
  windowSizeMedium: '보통',
  windowSizeLarge: '크게',
  windowSizeWide: '넓게',

  // Tags tab
  tags: '태그',
  tagColors: '태그 색상',
  tagColorsDesc: '자주 사용하는 태그에 커스텀 색상을 지정할 수 있습니다',
  addTag: '태그 추가',
  tagName: '태그 이름',
  tagNamePlaceholder: '태그 이름 입력...',
  noTagsConfigured: '설정된 태그가 없습니다',

  // Templates tab
  noteTemplates: '노트 템플릿',
  noteTemplatesDesc: '노트 생성 시 선택 가능한 템플릿 목록',
  edit: '편집',
  delete: '삭제',

  // Containers tab
  containerSettings: '컨테이너 설정',
  containerSettingsDesc: '각 컨테이너의 유형 및 할당 템플릿 관리',
  noContainers: '컨테이너가 없습니다',
  selectTemplate: '템플릿 선택...',

  // Developer tab
  developerTools: '개발자 도구',
  openDevTools: 'DevTools 열기',
  openDevToolsDesc: '브라우저 개발자 도구 (F12 또는 Ctrl+Shift+I)',
  open: '열기',

  // Common
  on: 'ON',
  off: 'OFF',
  cancel: '취소',
  save: '저장',
  close: '닫기',

  // Sidebar
  files: '파일',
  newNote: '새 노트',
  newFolder: '새 폴더',
  search: '검색',
  noVaultOpen: '보관소를 열어주세요',
  openVault: '보관소 열기',

  // Search
  frontmatter: '프론트매터',
  contentSearch: '내용 검색',
  detailedSearch: '상세 검색',
  searchPlaceholder: '검색어를 입력하세요...',
  noResults: '결과 없음',
  results: '개 결과',
  createNote: '노트 생성',
  notes: '노트',
  body: '본문',
  attachments: '첨부',
  details: '상세',
  graph: '그래프',
  titleTagTypeSearch: '제목, 태그, 타입 검색...',
  bodyContentSearch: '본문 내용 검색...',
  attachmentSearch: '첨부파일, 노트, 컨테이너 검색...',
  tagSearch: '태그 검색...',
  dateFilter: '날짜 필터',
  typeFilter: '타입 필터',

  // Context menu
  openInNewWindow: '새 창에서 열기',
  rename: '이름 바꾸기',
  moveTo: '이동...',
  copyPath: '경로 복사',
  revealInExplorer: '탐색기에서 열기',

  // Editor placeholder
  editorPlaceholder: '내용을 입력하세요...',
  editorEmptyText: 'Container를 선택하거나 Search를 열어주세요',

  // Hover windows
  hoverWindows: 'Hover 창',
  activeWindows: '활성 창',
  minimizedWindows: '최소화된 창',
};

const en: Translations = {
  // Settings modal
  settings: 'Settings',
  general: 'General',
  editor: 'Editor',
  templates: 'Templates',
  containers: 'Containers',
  shortcuts: 'Shortcuts',
  developer: 'Developer',

  // General tab - Appearance
  appearance: 'Appearance',
  theme: 'Theme',
  themeDesc: 'Select the color theme for the app',
  themeDark: 'Dark',
  themeLight: 'Light',
  themeSystem: 'Follow system',
  font: 'Font',
  fontDesc: 'Select the font for editor and UI',
  fontDefault: 'System Default (Pretendard)',
  fontAddCustom: 'Add font...',
  customFonts: 'Custom Fonts',
  addFont: 'Add Font',
  removeFont: 'Remove',

  // General tab - Language
  languageRegion: 'Language',
  language: 'Language',
  languageDesc: 'Select the interface language',

  // Editor tab
  editingToolbar: 'Editing Toolbar',
  defaultCollapsed: 'Default Collapsed',
  defaultCollapsedDesc: 'Start with toolbar collapsed when opening editor or container',
  popupWindow: 'Popup Window',
  ctrlScrollZoom: 'Ctrl+Scroll Zoom',
  ctrlScrollZoomDesc: 'Adjust font size with Ctrl+Scroll in popup window',
  currentZoomLevel: 'Current Zoom Level',
  defaultWindowSize: 'Default Window Size',
  defaultWindowSizeDesc: 'Default size when opening a new popup window',
  windowSizeSmall: 'Small',
  windowSizeMedium: 'Medium',
  windowSizeLarge: 'Large',
  windowSizeWide: 'Wide',

  // Tags tab
  tags: 'Tags',
  tagColors: 'Tag Colors',
  tagColorsDesc: 'Assign custom colors to frequently used tags',
  addTag: 'Add Tag',
  tagName: 'Tag Name',
  tagNamePlaceholder: 'Enter tag name...',
  noTagsConfigured: 'No tags configured',

  // Templates tab
  noteTemplates: 'Note Templates',
  noteTemplatesDesc: 'Templates available when creating notes',
  edit: 'Edit',
  delete: 'Delete',

  // Containers tab
  containerSettings: 'Container Settings',
  containerSettingsDesc: 'Manage container types and assigned templates',
  noContainers: 'No containers',
  selectTemplate: 'Select template...',

  // Developer tab
  developerTools: 'Developer Tools',
  openDevTools: 'Open DevTools',
  openDevToolsDesc: 'Browser developer tools (F12 or Ctrl+Shift+I)',
  open: 'Open',

  // Common
  on: 'ON',
  off: 'OFF',
  cancel: 'Cancel',
  save: 'Save',
  close: 'Close',

  // Sidebar
  files: 'Files',
  newNote: 'New Note',
  newFolder: 'New Folder',
  search: 'Search',
  noVaultOpen: 'Please open a vault',
  openVault: 'Open Vault',

  // Search
  frontmatter: 'Frontmatter',
  contentSearch: 'Content Search',
  detailedSearch: 'Detailed Search',
  searchPlaceholder: 'Enter search term...',
  noResults: 'No results',
  results: 'results',
  createNote: 'Create Note',
  notes: 'Notes',
  body: 'Body',
  attachments: 'Attachments',
  details: 'Details',
  graph: 'Graph',
  titleTagTypeSearch: 'Search title, tags, type...',
  bodyContentSearch: 'Search body content...',
  attachmentSearch: 'Search attachments, notes, containers...',
  tagSearch: 'Search tags...',
  dateFilter: 'Date filter',
  typeFilter: 'Type filter',

  // Context menu
  openInNewWindow: 'Open in New Window',
  rename: 'Rename',
  moveTo: 'Move to...',
  copyPath: 'Copy Path',
  revealInExplorer: 'Reveal in Explorer',

  // Editor placeholder
  editorPlaceholder: 'Start typing...',
  editorEmptyText: 'Select a Container or open Search',

  // Hover windows
  hoverWindows: 'Hover Windows',
  activeWindows: 'Active Windows',
  minimizedWindows: 'Minimized Windows',
};

const translations: Record<LanguageSetting, Translations> = { ko, en };

export function t(key: keyof Translations, lang: LanguageSetting): string {
  return translations[lang][key] || translations['ko'][key] || key;
}

export function getTranslations(lang: LanguageSetting): Translations {
  return translations[lang];
}

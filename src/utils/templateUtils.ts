import { fileCommands } from '../services/tauriCommands';
import { join } from '@tauri-apps/api/path';
import type { Frontmatter, NoteType } from '../types/frontmatter';
import { generateNoteId, createDefaultFrontmatter } from './frontmatterUtils';

interface TemplateConfig {
  templates: Record<NoteType, any>;
}

let cachedTemplates: TemplateConfig | null = null;

/**
 * Load note templates from .notology/templates/note-template.yaml
 */
export async function loadTemplates(vaultPath: string): Promise<TemplateConfig> {
  if (cachedTemplates) {
    return cachedTemplates;
  }

  try {
    const templatePath = await join(vaultPath, '.notology', 'templates', 'note-template.yaml');
    const yamlContent = await fileCommands.readTextFile(templatePath);

    // Simple YAML parsing for templates (could use a proper YAML parser)
    // For now, we'll use the createDefaultFrontmatter as fallback
    cachedTemplates = { templates: {} as Record<NoteType, any> };
    return cachedTemplates;
  } catch (error) {
    console.error('Failed to load templates:', error);
    return { templates: {} as Record<NoteType, any> };
  }
}

/**
 * Clear cached templates
 */
export function clearTemplateCache() {
  cachedTemplates = null;
}

/**
 * Apply template variables to a template string
 */
export function applyTemplateVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value);
  }

  return result;
}

/**
 * Create frontmatter from template
 */
export function createFromTemplate(
  noteType: NoteType,
  title: string,
  customVariables?: Record<string, string>
): Frontmatter {
  const now = new Date().toISOString();
  const id = generateNoteId();

  const variables = {
    id,
    title,
    created: now,
    modified: now,
    ...customVariables,
  };

  // For now, use the default frontmatter creator
  // In future, we can load from template files
  const frontmatter = createDefaultFrontmatter(noteType, title);

  // Apply type-specific defaults (only metadata, NO hardcoded tags)
  switch (noteType) {
    case 'MTG':
      frontmatter.date = customVariables?.date || now;
      if (customVariables?.participants) {
        frontmatter.participants = customVariables.participants.split(',').map(p => p.trim()).filter(Boolean);
      } else {
        frontmatter.participants = [];
      }
      break;

    case 'PAPER':
      if (customVariables?.authors) {
        frontmatter.authors = customVariables.authors.split(',').map(a => a.trim()).filter(Boolean);
      } else {
        frontmatter.authors = [];
      }
      frontmatter.year = customVariables?.year ? parseInt(customVariables.year) : undefined;
      frontmatter.venue = customVariables?.venue || undefined;
      frontmatter.doi = customVariables?.doi || undefined;
      frontmatter.url = customVariables?.url || undefined;
      frontmatter.state.maturity = 2;
      break;

    case 'THEO':
      // No type-specific defaults for THEO
      break;

    case 'LIT':
      if (customVariables?.authors) {
        frontmatter.authors = customVariables.authors.split(',').map(a => a.trim()).filter(Boolean);
      } else {
        frontmatter.authors = [];
      }
      frontmatter.year = customVariables?.year ? parseInt(customVariables.year) : undefined;
      frontmatter.publisher = customVariables?.publisher || undefined;
      frontmatter.source = customVariables?.source || undefined;
      frontmatter.url = customVariables?.url || undefined;
      frontmatter.state.maturity = 2;
      break;

    case 'EVENT':
      frontmatter.date = customVariables?.date || undefined;
      frontmatter.location = customVariables?.location || undefined;
      frontmatter.organizer = customVariables?.organizer || undefined;
      if (customVariables?.participants) {
        frontmatter.participants = customVariables.participants.split(',').map(p => p.trim()).filter(Boolean);
      } else {
        frontmatter.participants = [];
      }
      break;

    case 'CONTACT':
      frontmatter.state.workflow = 'final';
      frontmatter.state.confidence = 'verified';
      frontmatter.state.maturity = 3;
      frontmatter.email = customVariables?.email || '';
      frontmatter.phone = customVariables?.phone || '';
      frontmatter.organization = customVariables?.organization || customVariables?.company || '';
      frontmatter.role = customVariables?.role || customVariables?.position || '';
      frontmatter.location = customVariables?.location || '';
      // Add @mention alias for contact lookup
      if (customVariables?.name || title) {
        const contactName = customVariables?.name || title;
        frontmatter.aliases = [`@${contactName}`];
      }
      break;

    case 'CONTAINER':
      frontmatter.state.workflow = 'final';
      frontmatter.state.confidence = 'verified';
      frontmatter.state.maturity = 3;
      break;

    case 'SKETCH':
      frontmatter.state.workflow = 'draft';
      frontmatter.state.confidence = 'unverified';
      frontmatter.state.maturity = 1;
      (frontmatter as any).canvas = true;  // Enable canvas mode for SKETCH notes
      // NO hardcoded tags - use template tagCategories instead
      break;
  }

  return frontmatter;
}

/**
 * Get body template for note type
 */
export function getBodyTemplate(noteType: NoteType): string {
  switch (noteType) {
    case 'MTG':
      return `## 미팅 정보
- **날짜**: {{date}}
- **참석자**: {{participants}}

## 안건


## 논의 내용


## 결정 사항

`;

    case 'PAPER':
      return `## 논문 정보
- **저자**: {{authors}}
- **발행년도**: {{year}}
- **출판처**: {{venue}}
- **DOI**: {{doi}}

## 요약


## 주요 기여


## 방법론


## 결과

`;

    case 'THEO':
      return `## 정의


## 배경


## 핵심 개념


## 응용


## 관련 이론

`;

    case 'LIT':
      return `## 문헌 정보
- **저자**: {{authors}}
- **발행년도**: {{year}}
- **출판사**: {{publisher}}
- **출처**: {{source}}
- **URL**: {{url}}

## 요약


## 주요 내용

`;

    case 'EVENT':
      return `## 행사 정보
- **날짜**: {{date}}
- **장소**: {{location}}
- **주최**: {{organizer}}
- **참가자**: {{participants}}

## 개요


## 일정

`;

    case 'CONTACT':
      return `## 연락 정보
- **이메일**: {{email}}
- **전화**: {{phone}}
- **소속**: {{organization}}
- **직책**: {{role}}

## 소통 이력
-

## 관련 노트
-
`;

    case 'CONTAINER':
      return `## 개요


## 하위 항목

`;

    case 'SKETCH':
      return ''; // Canvas notes don't need a markdown body template

    case 'SEM':
      return `## 개요


## 내용


## 핵심 포인트

`;

    case 'OFA':
      return `## 개요


## 내용


## 결정 사항

`;

    case 'DATA':
      return `## 개요


## 데이터 설명

`;

    case 'SETUP':
      return `## 개요


## 컨텍스트

`;

    case 'NOTE':
    default:
      return `## 개요


## 내용

`;
  }
}

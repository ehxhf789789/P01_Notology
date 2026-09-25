import { useState, useEffect, memo } from 'react';
import { fileCommands } from '../../../core/services/tauriCommands';
import { useLanguage } from '../../../core/stores/zustand';
import { t } from '../../../core/utils/i18n';
import { hoverWindowPropsAreEqual, type HoverEditorWindowProps } from '../hoverAnimationUtils';
import { HoverWindowChrome } from '../components/HoverWindowChrome';
import hljs from 'highlight.js';
import 'highlight.js/styles/vs2015.css';

/**
 * HoverCodeViewer — Stage 5.0.9d migration.
 *
 * Highlight.js renders the file body with line numbers. Chrome (titlebar /
 * drag / resize / min / close / animation / multi-window detection) is
 * fully owned by `<HoverWindowChrome>`. Pre-migration: ~360 lines.
 */

/** 확장자 → highlight.js 언어. «개인 GitHub» 창(features/code)도 **이 한 표**를 쓴다 (두 벌 금지). */
export function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    json: 'json', py: 'python', js: 'javascript', ts: 'typescript',
    jsx: 'javascript', tsx: 'typescript', css: 'css', html: 'xml',
    xml: 'xml', yaml: 'yaml', yml: 'yaml', toml: 'ini',
    rs: 'rust', go: 'go', java: 'java', c: 'c', cpp: 'cpp',
    h: 'c', hpp: 'cpp', cs: 'csharp', rb: 'ruby', php: 'php',
    sh: 'bash', bash: 'bash', zsh: 'bash', sql: 'sql', lua: 'lua',
    r: 'r', swift: 'swift', kt: 'kotlin', scala: 'scala',
    vue: 'xml', svelte: 'xml', ini: 'ini', conf: 'ini', cfg: 'ini',
    md: 'markdown', markdown: 'markdown', diff: 'diff', patch: 'diff', ipynb: 'json', dockerfile: 'dockerfile',
  };
  return map[ext] || 'plaintext';
}

const HoverCodeViewer = memo(function HoverCodeViewer({ window: win }: HoverEditorWindowProps) {
  const language = useLanguage();
  const [code, setCode] = useState('');
  const [highlighted, setHighlighted] = useState('');

  useEffect(() => {
    fileCommands.readTextFile(win.filePath)
      .then(src => {
        setCode(src);
        const lang = getLanguageFromPath(win.filePath);
        try {
          const result = hljs.highlight(src, { language: lang });
          setHighlighted(result.value);
        } catch {
          setHighlighted(hljs.highlightAuto(src).value);
        }
      })
      .catch(() => setCode(t('viewerCodeLoadError', language)));
  }, [win.filePath, language]);

  const fileName = win.filePath.split(/[/\\]/).pop() || '';
  // 🔴 2026-09-20 (한빈) — 창 제목도 **실물 이름 그대로**.
  //    밑줄을 공백으로 바꾸면 `(13_00 ~ 17_00)` 이 `(13 00 ~ 17 00)` 이 된다.
  const displayFileName = fileName;
  const lineCount = code.split('\n').length;

  return (
    <HoverWindowChrome
      window={win}
      title={displayFileName}
      bodyClassName="code-viewer-body"
      logLabel="HoverCodeViewer"
    >
      <div className="code-viewer">
        <div className="code-line-numbers">
          {Array.from({ length: lineCount }, (_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
        <pre className="code-content">
          <code dangerouslySetInnerHTML={{ __html: highlighted || code }} />
        </pre>
      </div>
    </HoverWindowChrome>
  );
}, hoverWindowPropsAreEqual);

export default HoverCodeViewer;

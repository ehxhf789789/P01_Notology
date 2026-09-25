/**
 * README 읽기 — 노트와 같은 TipTap 을 **읽기 전용**으로 (플랜 B5 ② · 기존 마크다운 렌더러).
 * 🔴 html 끔 — 저장소의 README 는 믿지 않는 입력이다 (스크립트·이상한 태그를 그리지 않는다).
 */
import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';

export function Readme({ text }: { text: string }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: true, autolink: false, HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' } },
      }),
      Markdown.configure({ html: false, tightLists: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: '',
    editable: false,
    editorProps: { attributes: { class: 'tiptap-editor ghub-readme__body', spellcheck: 'false' } },
  });
  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(text || '');
  }, [editor, text]);
  return <div className="ghub-readme"><EditorContent editor={editor} /></div>;
}

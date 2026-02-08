import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import { searchCommands } from '../services/tauriCommands';
import { MentionSuggestionPluginKey } from '../extensions/MentionSuggestion';
import MentionSuggestionList from '../components/MentionSuggestionList';
import type { MentionSuggestionListRef } from '../components/MentionSuggestionList';
import type { Editor, Range } from '@tiptap/core';
import type { EditorState } from '@tiptap/pm/state';

type TippyInstance = ReturnType<typeof tippy>;

export interface ContactResult {
  displayName: string;
  fileName: string;
  path: string;
  organization?: string;
  role?: string;
}

interface NoteMetadata {
  path: string;
  note_type: string;
  title?: string;
}

// Contact cache with loading state
let contactCache: ContactResult[] = [];
let cacheLoaded = false;
let cacheLoadPromise: Promise<void> | null = null;

async function loadContacts(): Promise<void> {
  if (cacheLoaded) return;
  if (cacheLoadPromise) return cacheLoadPromise;

  cacheLoadPromise = (async () => {
    try {
      const notes = await searchCommands.queryNotes({});
      const contacts: ContactResult[] = [];

      for (const note of notes) {
        if (note.note_type === 'CONTACT') {
          const fileName = note.path.split(/[/\\]/).pop()?.replace(/\.md$/, '') || '';
          contacts.push({
            displayName: note.title || fileName,
            fileName,
            path: note.path,
          });
        }
      }

      contactCache = contacts;
      cacheLoaded = true;
    } catch (err) {
      console.error('Failed to load contacts for mention:', err);
    }
  })();

  return cacheLoadPromise;
}

// Call this to refresh cache when contacts may have changed
export function refreshContactCache(): void {
  cacheLoaded = false;
  cacheLoadPromise = null;
}

function searchContacts(query: string): ContactResult[] {
  const lowerQuery = query.toLowerCase();
  return contactCache
    .filter(contact =>
      contact.displayName.toLowerCase().includes(lowerQuery) ||
      contact.fileName.toLowerCase().includes(lowerQuery)
    )
    .slice(0, 10);
}

export function createMentionSuggestion() {
  // Preload contacts
  loadContacts();

  return {
    char: '@', // Trigger character for mention
    pluginKey: MentionSuggestionPluginKey,
    command: ({ editor, range, props }: { editor: Editor; range: Range; props: { displayName: string; fileName: string } }) => {
      // Delete the @ trigger and insert wiki link to contact note
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent(`[[${props.fileName}|@${props.displayName}]] `)
        .run();
    },
    allow: ({ editor, state }: { editor: Editor; state: EditorState }) => {
      // Don't allow if not editable
      if (!editor.isEditable) return false;

      const $from = state.selection.$from;
      const text = $from.parent.textContent;
      const posInParent = $from.parentOffset;

      // Get text before cursor
      const beforeCursor = text.substring(0, posInParent);

      // Don't trigger if @ is part of an email address
      if (posInParent > 0) {
        const charBefore = text[posInParent - 1];
        if (/[a-zA-Z0-9]/.test(charBefore)) {
          return false;
        }
      }

      // Don't trigger inside wiki links [[ ]]
      const lastOpenBracket = beforeCursor.lastIndexOf('[[');
      const lastCloseBracket = beforeCursor.lastIndexOf(']]');
      if (lastOpenBracket > lastCloseBracket) {
        return false;
      }

      return true;
    },
    items: async ({ query }: { query: string }) => {
      // Ensure contacts are loaded
      await loadContacts();
      return searchContacts(query);
    },

    render: () => {
      let component: ReactRenderer<MentionSuggestionListRef> | undefined;
      let popup: TippyInstance | undefined;

      return {
        onStart: (props: any) => {
          component = new ReactRenderer(MentionSuggestionList, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) {
            return;
          }

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect as () => DOMRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            maxWidth: '350px',
            theme: 'mention-suggestion',
          });
        },

        onUpdate(props: any) {
          component?.updateProps(props);

          if (!props.clientRect) {
            return;
          }

          popup?.[0]?.setProps({
            getReferenceClientRect: props.clientRect as () => DOMRect,
          });
        },

        onKeyDown(props: any) {
          if (props.event.key === 'Escape') {
            popup?.[0]?.hide();
            return true;
          }

          return component?.ref?.onKeyDown(props) || false;
        },

        onExit() {
          popup?.[0]?.destroy();
          component?.destroy();
        },
      };
    },
  };
}

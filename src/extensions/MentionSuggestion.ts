import { Extension, type Editor } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { PluginKey, type EditorState } from '@tiptap/pm/state';
import type { Range } from '@tiptap/core';

export interface MentionSuggestionOptions {
  suggestion: any;
}

export const MentionSuggestionPluginKey = new PluginKey('mentionSuggestion');

export const MentionSuggestion = Extension.create<MentionSuggestionOptions>({
  name: 'mentionSuggestion',

  addOptions() {
    return {
      suggestion: {
        char: '@',
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
        allow: ({ editor, state }: { editor: Editor; state: EditorState; range: Range }) => {
          // Don't allow if not editable
          if (!editor.isEditable) return false;

          const $from = state.selection.$from;
          const text = $from.parent.textContent;
          const posInParent = $from.parentOffset;

          // Get text before cursor
          const beforeCursor = text.substring(0, posInParent);

          // Don't trigger if @ is part of an email address
          // Check if there's an alphanumeric character immediately before @
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
            // We're inside an unclosed [[, don't trigger @
            return false;
          }

          return true;
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export default MentionSuggestion;

import HorizontalRule from '@tiptap/extension-horizontal-rule';
import { InputRule } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';

/**
 * Custom HorizontalRule extension that creates hr without extra blank line
 * When user types *** or --- and presses Enter, cursor is placed directly after hr
 */
const HorizontalRuleNoGap = HorizontalRule.extend({
  addInputRules() {
    return [
      // Match *** at start of line
      new InputRule({
        find: /^\*\*\*$/,
        handler: ({ state, range }) => {
          const { tr } = state;
          const start = range.from;
          const end = range.to;

          // Replace the *** with horizontal rule
          tr.delete(start, end);
          tr.insert(start, this.type.create());

          // Set selection right after the horizontal rule (no extra paragraph)
          const newPos = start + 1;
          tr.setSelection(TextSelection.near(tr.doc.resolve(newPos)));
        },
      }),
      // Match --- at start of line (for backwards compatibility)
      new InputRule({
        find: /^---$/,
        handler: ({ state, range }) => {
          const { tr } = state;
          const start = range.from;
          const end = range.to;

          tr.delete(start, end);
          tr.insert(start, this.type.create());

          const newPos = start + 1;
          tr.setSelection(TextSelection.near(tr.doc.resolve(newPos)));
        },
      }),
    ];
  },
});

export default HorizontalRuleNoGap;

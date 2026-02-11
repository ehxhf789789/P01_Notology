import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import { AttachmentSuggestionPluginKey } from '../extensions/AttachmentSuggestion';
import AttachmentSuggestionList from '../components/AttachmentSuggestionList';
import type { AttachmentSuggestionListRef } from '../components/AttachmentSuggestionList';
import type { FileNode } from '../types';
import type { Editor, Range } from '@tiptap/core';
import type { EditorState } from '@tiptap/pm/state';

type TippyInstance = ReturnType<typeof tippy>;

export interface AttachmentResult {
  fileName: string;
  path: string;
  isImage: boolean;
}

// Image extensions
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'];

function isImageFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXTENSIONS.includes(ext);
}

/**
 * Convert absolute path to relative path by removing vault prefix
 */
function toRelativePath(absolutePath: string, vaultPath: string): string {
  if (!vaultPath || !absolutePath) return absolutePath;

  const normalizedAbsolute = absolutePath.replace(/\\/g, '/');
  const normalizedVault = vaultPath.replace(/\\/g, '/').replace(/\/$/, '');

  if (normalizedAbsolute.startsWith(normalizedVault)) {
    return normalizedAbsolute.slice(normalizedVault.length + 1); // +1 to remove leading slash
  }
  return absolutePath;
}

/**
 * Find files in the note's _att folder
 * @param fileTree The file tree
 * @param notePath The current note's absolute path (e.g., "C:/Users/.../Vault/Folder/MyNote.md")
 * @param vaultPath The vault root path (e.g., "C:/Users/.../Vault")
 * @param query Search query to filter files
 */
function findAttachmentFiles(
  fileTree: FileNode[],
  notePath: string,
  vaultPath: string,
  query: string
): AttachmentResult[] {
  if (!notePath) return [];

  // Convert absolute path to relative path
  const relativePath = toRelativePath(notePath, vaultPath);

  // Extract note name without extension
  // e.g., "Folder/MyNote.md" -> "MyNote"
  const pathParts = relativePath.replace(/\\/g, '/').split('/');
  const noteFileName = pathParts.pop() || '';
  const noteName = noteFileName.replace(/\.md$/, '');
  const parentPath = pathParts.join('/');

  // The attachment folder is named "{noteName}_att" and is a sibling of the note
  const attFolderName = `${noteName}_att`;
  const attFolderPath = parentPath ? `${parentPath}/${attFolderName}` : attFolderName;

  const results: AttachmentResult[] = [];
  const lowerQuery = query.toLowerCase();

  // Find the att folder in the file tree
  function findAttFolder(nodes: FileNode[], currentPath: string = ''): FileNode | null {
    for (const node of nodes) {
      const fullPath = currentPath ? `${currentPath}/${node.name}` : node.name;

      if (node.is_dir && fullPath === attFolderPath) {
        return node;
      }

      if (node.children) {
        const found = findAttFolder(node.children, fullPath);
        if (found) return found;
      }
    }
    return null;
  }

  const attFolder = findAttFolder(fileTree);
  if (!attFolder || !attFolder.children) return [];

  // Collect all files from the att folder (including subdirectories)
  function collectFiles(nodes: FileNode[], subPath: string = '') {
    for (const node of nodes) {
      if (!node.is_dir) {
        const fileName = subPath ? `${subPath}/${node.name}` : node.name;
        if (fileName.toLowerCase().includes(lowerQuery)) {
          results.push({
            fileName,
            path: `${attFolderPath}/${fileName}`,
            isImage: isImageFile(node.name),
          });
        }
      } else if (node.children) {
        const newSubPath = subPath ? `${subPath}/${node.name}` : node.name;
        collectFiles(node.children, newSubPath);
      }
    }
  }

  collectFiles(attFolder.children);

  return results.slice(0, 15); // Limit to 15 results
}

/**
 * Create attachment suggestion configuration
 * @param getNotePath Function to get the current note's path
 * @param getFileTree Function to get the file tree
 * @param getVaultPath Function to get the vault root path
 */
export function createAttachmentSuggestion(
  getNotePath: () => string,
  getFileTree: () => FileNode[],
  getVaultPath: () => string
) {
  return {
    char: '//', // Trigger: double slash for "local path" (att folder)
    pluginKey: AttachmentSuggestionPluginKey,
    command: ({ editor, range, props }: { editor: Editor; range: Range; props: { fileName: string; isImage: boolean } }) => {
      // Delete the // trigger and insert wiki link to attachment
      const prefix = props.isImage ? '!' : '';
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent(`${prefix}[[${props.fileName}]]`)
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

      // Don't trigger inside wiki links [[ ]]
      const lastOpenBracket = beforeCursor.lastIndexOf('[[');
      const lastCloseBracket = beforeCursor.lastIndexOf(']]');
      if (lastOpenBracket > lastCloseBracket) {
        return false;
      }

      // Check if there's a note path (att folder only makes sense for saved notes)
      const notePath = getNotePath();
      if (!notePath) return false;

      return true;
    },
    items: ({ query }: { query: string }) => {
      const notePath = getNotePath();
      const fileTree = getFileTree();
      const vaultPath = getVaultPath();
      return findAttachmentFiles(fileTree, notePath, vaultPath, query);
    },

    render: () => {
      let component: ReactRenderer<AttachmentSuggestionListRef> | undefined;
      let popup: TippyInstance | undefined;

      return {
        onStart: (props: any) => {
          component = new ReactRenderer(AttachmentSuggestionList, {
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
            maxWidth: '400px',
            theme: 'attachment-suggestion',
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

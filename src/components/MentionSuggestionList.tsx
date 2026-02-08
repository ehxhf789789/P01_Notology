import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { ContactResult } from '../utils/mentionSuggestion';

interface MentionSuggestionListProps {
  items: ContactResult[];
  command: (props: any) => void;
}

export interface MentionSuggestionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const MentionSuggestionList = forwardRef<
  MentionSuggestionListRef,
  MentionSuggestionListProps
>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command({ displayName: item.displayName, fileName: item.fileName });
    }
  };

  const upHandler = () => {
    if (props.items.length === 0) return;
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    if (props.items.length === 0) return;
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }

      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  // Detect theme from document
  const isLightMode = typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-theme') === 'light';

  const listStyle = {
    backgroundColor: isLightMode ? '#ffffff' : '#1e1e2e',
    border: isLightMode ? '1px solid #ddd' : '1px solid #3a3a4a',
    color: isLightMode ? '#1a1a1a' : '#e0e0e0',
  };

  const headerStyle = {
    color: isLightMode ? '#555' : '#888',
    borderBottomColor: isLightMode ? '#ddd' : '#3a3a4a',
  };

  const itemStyle = (selected: boolean) => ({
    color: selected ? '#fff' : (isLightMode ? '#1a1a1a' : '#e0e0e0'),
    backgroundColor: selected ? '#7aa2f7' : 'transparent',
  });

  const nameStyle = (selected: boolean) => ({
    color: selected ? '#fff' : (isLightMode ? '#1a1a1a' : '#e0e0e0'),
  });

  if (props.items.length === 0) {
    return (
      <div className="mention-suggestion-list" style={listStyle}>
        <div className="mention-suggestion-empty" style={{ color: isLightMode ? '#666' : '#888' }}>
          No contacts found
        </div>
      </div>
    );
  }

  return (
    <div className="mention-suggestion-list" style={listStyle}>
      <div className="mention-suggestion-header" style={headerStyle}>Contacts</div>
      {props.items.map((item, index) => {
        const selected = index === selectedIndex;
        return (
          <button
            key={item.path}
            className={`mention-suggestion-item${selected ? ' selected' : ''}`}
            style={itemStyle(selected)}
            onClick={() => selectItem(index)}
          >
            <div className="mention-suggestion-item-avatar">@</div>
            <div className="mention-suggestion-item-info">
              <div className="mention-suggestion-item-name" style={nameStyle(selected)}>
                @{item.displayName}
              </div>
              {item.organization && (
                <div className="mention-suggestion-item-org">{item.organization}</div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
});

MentionSuggestionList.displayName = 'MentionSuggestionList';

export default MentionSuggestionList;

import { useState, useEffect, useRef, useCallback } from 'react';
import type { TagOntology, TagNode, FacetNamespace } from '../../types/tagOntology';
import {
  getTagsForFacet,
  getTagBreadcrumb,
  searchTags,
  getRecentTags,
  addNewTag,
  removeFromRecentTags,
  deleteTagFromOntology,
  clearOntologyCache,
} from '../../utils/tagOntologyUtils';
import { refreshActions } from '../../stores/zustand/refreshStore';

interface HierarchicalTagSelectorProps {
  namespace: FacetNamespace;
  ontology: TagOntology;
  onSelect: (tagId: string) => void;
  onClose: () => void;
  vaultPath: string;
}

function HierarchicalTagSelector({
  namespace,
  ontology,
  onSelect,
  onClose,
  vaultPath,
}: HierarchicalTagSelectorProps) {
  const incrementOntologyRefresh = refreshActions.incrementOntologyRefresh;
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPath, setCurrentPath] = useState<TagNode[]>([]);
  const [recentTags, setRecentTags] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1); // Keyboard navigation index
  const [isKeyboardNavActive, setIsKeyboardNavActive] = useState(false); // Track if using keyboard nav
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load all recent tags (including orphans - users can remove them manually)
    const recent = getRecentTags(namespace);
    setRecentTags(recent);

    // Click outside to close
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [namespace, onClose, ontology]);

  const rootTags = getTagsForFacet(ontology, namespace);
  const currentNode = currentPath.length > 0 ? currentPath[currentPath.length - 1] : null;
  const visibleTags = currentNode?.children || rootTags;

  // Search results for keyboard navigation
  const searchResults = searchQuery.trim()
    ? searchTags(ontology, searchQuery, namespace)
    : [];

  // Reset selectedIndex when search query changes
  useEffect(() => {
    setSelectedIndex(-1);
    setIsKeyboardNavActive(false);
  }, [searchQuery]);

  const handleSelectTag = (tagId: string) => {
    onSelect(tagId);
  };

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const items = searchQuery.trim() ? searchResults : visibleTags;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsKeyboardNavActive(true);
      setSelectedIndex(prev => (prev < items.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsKeyboardNavActive(true);
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();

      if (selectedIndex >= 0 && selectedIndex < items.length) {
        // Select the highlighted item
        const item = items[selectedIndex];
        if (searchQuery.trim()) {
          // In search mode, select the tag directly
          handleSelectTag((item as { id: string }).id);
        } else {
          // In hierarchical mode, navigate or select
          handleNavigate(item as TagNode);
        }
      } else if (searchQuery.trim() && searchResults.length === 0) {
        // Create new tag if no results
        handleCreateNewTag();
      } else if (searchQuery.trim() && searchResults.length > 0) {
        // Select first result if nothing is selected
        handleSelectTag(searchResults[0].id);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  }, [searchQuery, searchResults, visibleTags, selectedIndex, onClose]);

  const handleNavigate = (node: TagNode) => {
    if (node.children && node.children.length > 0) {
      setCurrentPath([...currentPath, node]);
    } else {
      handleSelectTag(node.id);
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      setCurrentPath([]);
    } else {
      setCurrentPath(currentPath.slice(0, index + 1));
    }
  };

  const handleCreateNewTag = async () => {
    if (!searchQuery.trim()) return;

    try {
      const parentId = currentNode?.id;
      const newTagId = await addNewTag(vaultPath, namespace, searchQuery.trim(), parentId);
      incrementOntologyRefresh(); // Trigger refresh for all components
      onSelect(newTagId);
    } catch (error) {
      console.error('Failed to create tag:', error);
      alert(`태그 생성 실패: ${error}`);
    }
  };

  const handleRemoveRecentTag = (e: React.MouseEvent, tagId: string) => {
    e.stopPropagation();
    removeFromRecentTags(tagId, namespace);
    setRecentTags(recentTags.filter((id) => id !== tagId));
  };

  const handleDeleteTag = async (e: React.MouseEvent, tagId: string) => {
    e.stopPropagation();
    try {
      await deleteTagFromOntology(vaultPath, tagId);
      setSearchQuery(''); // Clear search to refresh results
      incrementOntologyRefresh(); // Trigger refresh for all components
      onClose();
    } catch (error) {
      console.error('Failed to delete tag:', error);
    }
  };

  return (
    <div ref={containerRef} className="hierarchical-tag-selector">
      {/* Search Input */}
      <div className="tag-search">
        <input
          ref={inputRef}
          type="text"
          placeholder="태그 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          autoComplete="off"
        />
      </div>

      {/* Search Results */}
      {searchQuery.trim() && (
        <div className="tag-search-results">
          {searchResults.length === 0 ? (
            <div className="tag-empty">
              <div>검색 결과가 없습니다.</div>
              <button
                className="tag-create-btn"
                onClick={handleCreateNewTag}
              >
                + 새 태그 생성: "{searchQuery.trim()}"
              </button>
            </div>
          ) : (
            <div className={`tag-list ${isKeyboardNavActive ? 'keyboard-nav-active' : ''}`}>
              {searchResults.map((result, index) => (
                <div key={result.id} className="tag-item-wrapper">
                  <button
                    className={`tag-item ${index === selectedIndex ? 'tag-item-selected' : ''}`}
                    onClick={() => handleSelectTag(result.id)}
                    onMouseEnter={() => {
                      if (!isKeyboardNavActive) {
                        setSelectedIndex(index);
                      }
                    }}
                    onMouseMove={() => {
                      // Re-enable mouse selection when mouse moves
                      if (isKeyboardNavActive) {
                        setIsKeyboardNavActive(false);
                        setSelectedIndex(index);
                      }
                    }}
                  >
                    <div className="tag-item-label">{result.label}</div>
                    <div className="tag-item-breadcrumb">
                      {result.breadcrumb.join(' > ')}
                    </div>
                  </button>
                  <button
                    className="tag-item-delete"
                    onClick={(e) => handleDeleteTag(e, result.id)}
                    title="태그 삭제 (온톨로지에서 완전 삭제)"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hierarchical Navigation */}
      {!searchQuery.trim() && (
        <>
          {/* Breadcrumb */}
          {currentPath.length > 0 && (
            <div className="tag-breadcrumb">
              <button
                className="breadcrumb-item"
                onClick={() => handleBreadcrumbClick(-1)}
              >
                루트
              </button>
              {currentPath.map((node, index) => (
                <div key={node.id} className="breadcrumb-separator-wrapper">
                  <span className="breadcrumb-separator">/</span>
                  <button
                    className="breadcrumb-item"
                    onClick={() => handleBreadcrumbClick(index)}
                  >
                    {node.label}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Tag List */}
          <div className={`tag-list ${isKeyboardNavActive ? 'keyboard-nav-active' : ''}`}>
            {visibleTags.length === 0 ? (
              <div className="tag-empty">하위 태그가 없습니다.</div>
            ) : (
              visibleTags.map((tag, index) => (
                <div key={tag.id} className="tag-item-wrapper">
                  <button
                    className={`tag-item ${index === selectedIndex ? 'tag-item-selected' : ''}`}
                    onClick={() => handleNavigate(tag)}
                    onMouseEnter={() => {
                      if (!isKeyboardNavActive) {
                        setSelectedIndex(index);
                      }
                    }}
                    onMouseMove={() => {
                      if (isKeyboardNavActive) {
                        setIsKeyboardNavActive(false);
                        setSelectedIndex(index);
                      }
                    }}
                  >
                    <span className="tag-item-label">{tag.label}</span>
                    {tag.children && tag.children.length > 0 && (
                      <span className="tag-item-arrow">▸</span>
                    )}
                  </button>
                  <button
                    className="tag-item-delete"
                    onClick={(e) => handleDeleteTag(e, tag.id)}
                    title="태그 삭제"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Recent Tags */}
          {currentPath.length === 0 && recentTags.length > 0 && (
            <div className="tag-recent">
              <div className="tag-recent-title">최근 사용한 태그</div>
              <div className="tag-recent-list">
                {recentTags.map((tagId) => {
                  const definition = ontology.definitions[tagId];
                  const isOrphan = !definition;
                  // Extract display label: use definition label or extract from tagId (e.g., "domain/ㅇㅇ" -> "ㅇㅇ")
                  const displayLabel = definition?.label || tagId.split('/').pop() || tagId;

                  return (
                    <div key={tagId} className={`tag-chip-small-wrapper ${isOrphan ? 'tag-chip-orphan' : ''}`}>
                      <button
                        className={`tag-chip-small ${isOrphan ? 'tag-chip-small-orphan' : ''}`}
                        onClick={() => !isOrphan && handleSelectTag(tagId)}
                        title={isOrphan ? `삭제된 태그: ${tagId}` : tagId}
                        disabled={isOrphan}
                      >
                        {displayLabel}
                      </button>
                      <button
                        className="tag-chip-remove"
                        onClick={(e) => handleRemoveRecentTag(e, tagId)}
                        title="최근 태그에서 제거"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default HierarchicalTagSelector;

import { useState, useEffect } from 'react';
import type { FacetedTags } from '../../types/frontmatter';
import type { TagOntology, FacetNamespace } from '../../types/tagOntology';
import { FACET_NAMESPACES } from '../../types/tagOntology';
import { loadTagOntology, addToRecentTags, addNewTag } from '../../utils/tagOntologyUtils';
import HierarchicalTagSelector from './HierarchicalTagSelector';
import { useOntologyRefreshTrigger, refreshActions } from '../../stores/zustand/refreshStore';

interface FacetedTagEditorProps {
  tags: FacetedTags;
  onChange: (tags: FacetedTags) => void;
  vaultPath: string;
}

function FacetedTagEditor({ tags, onChange, vaultPath }: FacetedTagEditorProps) {
  const ontologyRefreshTrigger = useOntologyRefreshTrigger();
  const incrementOntologyRefresh = refreshActions.incrementOntologyRefresh;
  const [ontology, setOntology] = useState<TagOntology | null>(null);
  const [activeFacet, setActiveFacet] = useState<FacetNamespace | null>(null);

  // Strip namespace prefix from tag name
  const stripNamespacePrefix = (tagName: string): string => {
    let clean = tagName;
    const namespaces = ['domain', 'who', 'org', 'ctx'];
    for (const ns of namespaces) {
      while (clean.startsWith(`${ns}/`)) {
        clean = clean.slice(ns.length + 1);
      }
    }
    return clean;
  };

  useEffect(() => {
    const loadOntology = async () => {
      // OPTIMIZATION: Use cached ontology for fast loading
      // Cache is only cleared when explicitly needed (tag edit, ontology refresh)
      const ont = await loadTagOntology(vaultPath);
      setOntology(ont);
    };
    loadOntology();
  }, [vaultPath, ontologyRefreshTrigger]);

  const addTag = async (namespace: FacetNamespace, tagId: string) => {
    // Strip namespace prefix if present (e.g., "domain/특허출원" -> "특허출원")
    let cleanTagId = tagId;
    const namespaces = ['domain', 'who', 'org', 'ctx'];
    for (const ns of namespaces) {
      while (cleanTagId.startsWith(`${ns}/`)) {
        cleanTagId = cleanTagId.slice(ns.length + 1);
      }
    }

    const currentTags = tags[namespace] || [];

    // Don't add if already exists (case-insensitive comparison)
    const existsInTags = currentTags.some(
      t => t.toLowerCase() === cleanTagId.toLowerCase()
    );
    if (existsInTags) {
      return;
    }

    onChange({
      ...tags,
      [namespace]: [...currentTags, cleanTagId],
    });

    // Add tag to ontology if it doesn't exist (case-insensitive check)
    if (ontology) {
      const fullTagId = `${namespace}/${cleanTagId}`;
      const fullTagIdLower = fullTagId.toLowerCase();
      const existsInOntology = Object.keys(ontology.definitions).some(
        key => key.toLowerCase() === fullTagIdLower
      );
      if (!existsInOntology) {
        try {
          await addNewTag(vaultPath, namespace, cleanTagId);
          incrementOntologyRefresh(); // Trigger refresh for all components
        } catch (error) {
          console.error('Failed to add tag to ontology:', error);
        }
      }
    }

    addToRecentTags(tagId, namespace); // Keep full ID for recent tags (ontology lookup)
    setActiveFacet(null);
  };

  const removeTag = (namespace: FacetNamespace, tagId: string) => {
    const currentTags = tags[namespace] || [];
    const cleanId = stripNamespacePrefix(tagId);
    // Remove both the clean ID and the full ID (for backwards compatibility)
    onChange({
      ...tags,
      [namespace]: currentTags.filter((t) => t !== tagId && t !== cleanId && stripNamespacePrefix(t) !== cleanId),
    });
  };

  const getTagLabel = (namespace: FacetNamespace, tagId: string): string => {
    if (!ontology) return stripNamespacePrefix(tagId);
    // Try full ID first (namespace/tagName), then just tagName
    const fullId = tagId.includes('/') ? tagId : `${namespace}/${tagId}`;
    const def = ontology.definitions[fullId] || ontology.definitions[tagId];
    return def?.label || stripNamespacePrefix(tagId);
  };

  if (!ontology) {
    return <div className="faceted-tag-editor-loading">태그 온톨로지 로딩 중...</div>;
  }

  return (
    <div className="faceted-tag-editor">
      <h3 className="faceted-tag-editor-title">패싯 태그</h3>

      {FACET_NAMESPACES.map((facet) => {
        const facetTags = tags[facet.namespace] || [];

        return (
          <div key={facet.namespace} className="facet-group">
            <div className="facet-header">
              <div>
                <span className="facet-label">{facet.label}</span>
                <span className="facet-description">{facet.description}</span>
              </div>
              <button
                className="facet-add-btn"
                onClick={() =>
                  setActiveFacet(
                    activeFacet === facet.namespace ? null : facet.namespace
                  )
                }
              >
                + 추가
              </button>
            </div>

            {facetTags.length > 0 && (
              <div className="facet-tags">
                {facetTags.map((tagId) => (
                  <div
                    key={tagId}
                    className={`tag-chip tag-${facet.namespace}`}
                  >
                    <span className="tag-label">{getTagLabel(facet.namespace, tagId)}</span>
                    <button
                      className="tag-remove-btn"
                      onClick={() => removeTag(facet.namespace, tagId)}
                      title="제거"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {activeFacet === facet.namespace && (
              <HierarchicalTagSelector
                namespace={facet.namespace}
                ontology={ontology}
                onSelect={(tagId) => addTag(facet.namespace, tagId)}
                onClose={() => setActiveFacet(null)}
                vaultPath={vaultPath}
              />
            )}
          </div>
        );
      })}

    </div>
  );
}

export default FacetedTagEditor;

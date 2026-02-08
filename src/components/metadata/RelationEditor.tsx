import { useState, useRef, useEffect } from 'react';
import type { Relation, RelationType } from '../../types/frontmatter';
import { useSettingsStore } from '../../stores/zustand/settingsStore';
import { t } from '../../utils/i18n';
import type { LanguageSetting } from '../../utils/i18n';

interface RelationEditorProps {
  relations: Relation[];
  onChange: (relations: Relation[]) => void;
  availableNotes: string[]; // List of note titles
}

const RELATION_TYPE_KEYS: Array<{ type: RelationType; labelKey: string; descKey: string }> = [
  { type: 'supports', labelKey: 'relationSupports', descKey: 'relationSupportsDesc' },
  { type: 'refutes', labelKey: 'relationRefutes', descKey: 'relationRefutesDesc' },
  { type: 'extends', labelKey: 'relationExtends', descKey: 'relationExtendsDesc' },
  { type: 'derives-from', labelKey: 'relationDerivesFrom', descKey: 'relationDerivesFromDesc' },
];

function getRelationTypes(lang: LanguageSetting) {
  return RELATION_TYPE_KEYS.map(rt => ({
    type: rt.type,
    label: t(rt.labelKey, lang),
    description: t(rt.descKey, lang),
  }));
}

function RelationEditor({ relations, onChange, availableNotes }: RelationEditorProps) {
  const language = useSettingsStore(s => s.language);
  const relationTypes = getRelationTypes(language);
  const [isAdding, setIsAdding] = useState(false);
  const [newRelation, setNewRelation] = useState<Relation>({
    relation_type: 'supports',
    target: '',
      });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredNotes, setFilteredNotes] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const addRelation = () => {
    if (!newRelation.target.trim()) return;

    onChange([...relations, newRelation]);
    setNewRelation({
      relation_type: 'supports',
      target: '',
          });
    setIsAdding(false);
  };

  const removeRelation = (index: number) => {
    onChange(relations.filter((_, i) => i !== index));
  };

  const updateRelation = (index: number, field: keyof Relation, value: any) => {
    const updated = [...relations];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const getRelationLabel = (type: RelationType): string => {
    return relationTypes.find((rt) => rt.type === type)?.label || type;
  };

  const handleTargetChange = (value: string) => {
    setNewRelation({ ...newRelation, target: value });

    if (value.trim()) {
      const filtered = availableNotes.filter(note =>
        note.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 10);
      setFilteredNotes(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectNote = (note: string) => {
    setNewRelation({ ...newRelation, target: note });
    setShowSuggestions(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relation-editor">
      <div className="relation-editor-header">
        <h3 className="relation-editor-title">{t('semanticRelations', language)}</h3>
        <button
          className="relation-add-btn"
          onClick={() => setIsAdding(!isAdding)}
        >
          {isAdding ? t('cancelAddRelation', language) : t('addRelation', language)}
        </button>
      </div>

      {/* Add New Relation Form */}
      {isAdding && (
        <div className="relation-add-form">
          <div className="relation-form-row">
            <div className="relation-form-field">
              <label>{t('relationType', language)}</label>
              <select
                value={newRelation.relation_type}
                onChange={(e) =>
                  setNewRelation({
                    ...newRelation,
                    relation_type: e.target.value as RelationType,
                  })
                }
              >
                {relationTypes.map((rt) => (
                  <option key={rt.type} value={rt.type} title={rt.description}>
                    {rt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="relation-form-field" style={{ position: 'relative' }}>
              <label>{t('targetNote', language)}</label>
              <input
                ref={inputRef}
                type="text"
                value={newRelation.target}
                onChange={(e) => handleTargetChange(e.target.value)}
                onFocus={() => {
                  if (newRelation.target.trim() && filteredNotes.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                placeholder={t('noteSearchPlaceholder', language)}
              />
              {showSuggestions && filteredNotes.length > 0 && (
                <div ref={suggestionsRef} className="note-suggestions">
                  {filteredNotes.map((note, idx) => (
                    <div
                      key={idx}
                      className="note-suggestion-item"
                      onClick={() => selectNote(note)}
                    >
                      {note}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button className="relation-form-submit" onClick={addRelation}>
            {t('add', language)}
          </button>
        </div>
      )}

      {/* Existing Relations */}
      {relations.length === 0 && !isAdding && (
        <div className="relation-empty">{t('noRelations', language)}</div>
      )}

      {relations.length > 0 && (
        <div className="relation-list">
          {relations.map((relation, index) => (
            <div key={index} className="relation-item">
              <div className="relation-item-header">
                <span className="relation-type">
                  {getRelationLabel(relation.relation_type)}
                </span>
                <span className="relation-arrow">→</span>
                <span className="relation-target">{relation.target}</span>
                <button
                  className="relation-remove-btn"
                  onClick={() => removeRelation(index)}
                  title={t('removeBtn', language)}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RelationEditor;

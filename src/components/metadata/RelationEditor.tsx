import { useState, useRef, useEffect } from 'react';
import type { Relation, RelationType } from '../../types/frontmatter';

interface RelationEditorProps {
  relations: Relation[];
  onChange: (relations: Relation[]) => void;
  availableNotes: string[]; // List of note titles
}

const RELATION_TYPES: Array<{ type: RelationType; label: string; description: string }> = [
  { type: 'supports', label: '관련', description: '일반적인 관련 관계 (가장 많이 사용)' },
  { type: 'refutes', label: '참조', description: '참고 자료 또는 인용' },
  { type: 'extends', label: '후속', description: '이어지는 내용 또는 발전' },
  { type: 'derives-from', label: '기반', description: '기반이 되는 내용' },
];

function RelationEditor({ relations, onChange, availableNotes }: RelationEditorProps) {
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
    return RELATION_TYPES.find((rt) => rt.type === type)?.label || type;
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
        <h3 className="relation-editor-title">시맨틱 관계</h3>
        <button
          className="relation-add-btn"
          onClick={() => setIsAdding(!isAdding)}
        >
          {isAdding ? '취소' : '+ 관계 추가'}
        </button>
      </div>

      {/* Add New Relation Form */}
      {isAdding && (
        <div className="relation-add-form">
          <div className="relation-form-row">
            <div className="relation-form-field">
              <label>관계 유형</label>
              <select
                value={newRelation.relation_type}
                onChange={(e) =>
                  setNewRelation({
                    ...newRelation,
                    relation_type: e.target.value as RelationType,
                  })
                }
              >
                {RELATION_TYPES.map((rt) => (
                  <option key={rt.type} value={rt.type} title={rt.description}>
                    {rt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="relation-form-field" style={{ position: 'relative' }}>
              <label>대상 노트</label>
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
                placeholder="노트 제목 입력..."
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
            추가
          </button>
        </div>
      )}

      {/* Existing Relations */}
      {relations.length === 0 && !isAdding && (
        <div className="relation-empty">관계가 없습니다. 추가 버튼을 클릭하세요.</div>
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
                  title="제거"
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

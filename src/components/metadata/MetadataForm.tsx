import { useState, useEffect } from 'react';
import type { Frontmatter, State, FacetedTags, Relation } from '../../types/frontmatter';
import {
  WORKFLOW_LABELS,
  CONFIDENCE_LABELS,
} from '../../utils/frontmatterUtils';
import FacetedTagEditor from './FacetedTagEditor';
import RelationEditor from './RelationEditor';
import { fileCommands } from '../../services/tauriCommands';
import { useSettingsStore } from '../../stores/zustand/settingsStore';
import { t } from '../../utils/i18n';

interface MetadataFormProps {
  frontmatter: Frontmatter;
  onChange: (fm: Frontmatter) => void;
  vaultPath: string;
}

function MetadataForm({ frontmatter, onChange, vaultPath }: MetadataFormProps) {
  const language = useSettingsStore(s => s.language);
  const [availableNotes, setAvailableNotes] = useState<string[]>([]);

  useEffect(() => {
    const loadAvailableNotes = async () => {
      try {
        const fileTree = await fileCommands.readDirectory(vaultPath);
        const notes: string[] = [];

        const extractNotes = (nodes: any[]) => {
          for (const node of nodes) {
            if (node.is_dir && node.children) {
              extractNotes(node.children);
            } else if (node.name.endsWith('.md')) {
              // Extract note title (filename without .md)
              const title = node.name.replace(/\.md$/, '');
              notes.push(title);
            }
          }
        };

        extractNotes(fileTree);
        setAvailableNotes(notes);
      } catch (error) {
        console.error('Failed to load available notes:', error);
      }
    };

    if (vaultPath) {
      loadAvailableNotes();
    }
  }, [vaultPath]);

  const formatDateTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;

      return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const updateField = <K extends keyof Frontmatter>(field: K, value: Frontmatter[K]) => {
    onChange({ ...frontmatter, [field]: value });
  };

  const updateState = <K extends keyof State>(field: K, value: State[K]) => {
    onChange({
      ...frontmatter,
      state: { ...frontmatter.state, [field]: value },
    });
  };

  const updateTags = (tags: FacetedTags) => {
    onChange({ ...frontmatter, tags });
  };

  const updateRelations = (relations: Relation[]) => {
    onChange({ ...frontmatter, relations });
  };

  return (
    <div className="metadata-form">
      {/* Identity Section */}
      <section className="form-section">
        <h3 className="form-section-title">{t('basicInfoMeta', language)}</h3>

        <div className="form-field">
          <label htmlFor="title">{t('titleLabel', language)}</label>
          <input
            id="title"
            type="text"
            value={frontmatter.title}
            onChange={(e) => updateField('title', e.target.value)}
          />
        </div>

        <div className="form-field">
          <label htmlFor="id">ID</label>
          <input id="id" type="text" value={frontmatter.id} disabled />
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="created">{t('createdLabel', language)}</label>
            <input id="created" type="text" value={formatDateTime(frontmatter.created)} disabled />
          </div>
          <div className="form-field">
            <label htmlFor="modified">{t('modifiedLabel', language)}</label>
            <input id="modified" type="text" value={formatDateTime(frontmatter.modified)} disabled />
          </div>
        </div>
      </section>

      {/* State Section */}
      <section className="form-section">
        <h3 className="form-section-title">{t('noteStatus', language)}</h3>

        <div className="form-field">
          <label htmlFor="workflow">{t('workflowLabel', language)}</label>
          <select
            id="workflow"
            value={frontmatter.state.workflow}
            onChange={(e) => updateState('workflow', e.target.value as any)}
          >
            {Object.entries(WORKFLOW_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="confidence">{t('confidenceLabel', language)}</label>
          <select
            id="confidence"
            value={frontmatter.state.confidence}
            onChange={(e) => updateState('confidence', e.target.value as any)}
          >
            {Object.entries(CONFIDENCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="maturity">{t('maturityLabel', language)}</label>
          <div className="maturity-slider">
            <input
              id="maturity"
              type="range"
              min="1"
              max="5"
              step="1"
              value={frontmatter.state.maturity}
              onChange={(e) => updateState('maturity', parseInt(e.target.value))}
            />
            <span className="maturity-value">{frontmatter.state.maturity}</span>
          </div>
          <div className="maturity-labels">
            <span>{t('maturityInitial', language)}</span>
            <span>{t('maturityGrowth', language)}</span>
            <span>{t('maturityMature', language)}</span>
            <span>{t('maturityStable', language)}</span>
            <span>{t('maturityImmutable', language)}</span>
          </div>
        </div>
      </section>

      {/* Tags Section */}
      <section className="form-section">
        <FacetedTagEditor
          tags={frontmatter.tags || {}}
          onChange={updateTags}
          vaultPath={vaultPath}
        />
      </section>

      {/* Relations Section */}
      <section className="form-section">
        <RelationEditor
          relations={frontmatter.relations || []}
          onChange={updateRelations}
          availableNotes={availableNotes}
        />
      </section>

      {/* Type-specific fields */}
      {frontmatter.type === 'MTG' && (() => {
        const fm = frontmatter as { date?: string; participants?: string[] };
        return (
          <section className="form-section">
            <h3 className="form-section-title">{t('meetingInfo', language)}</h3>

            <div className="form-field">
              <label htmlFor="date">{t('dateLabel', language)}</label>
              <input
                id="date"
                type="datetime-local"
                value={fm.date || ''}
                onChange={(e) => updateField('date', e.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="participants">{t('participantsComma', language)}</label>
              <input
                id="participants"
                type="text"
                value={fm.participants?.join(', ') || ''}
                onChange={(e) =>
                  updateField(
                    'participants',
                    e.target.value.split(',').map((p) => p.trim())
                  )
                }
              />
            </div>
          </section>
        );
      })()}

      {frontmatter.type === 'PAPER' && (() => {
        const fm = frontmatter as { authors?: string[]; venue?: string; year?: number; doi?: string; url?: string };
        return (
          <section className="form-section">
            <h3 className="form-section-title">{t('paperInfo', language)}</h3>

            <div className="form-field">
              <label htmlFor="authors">{t('authorsComma', language)}</label>
              <input
                id="authors"
                type="text"
                value={fm.authors?.join(', ') || ''}
                onChange={(e) =>
                  updateField(
                    'authors',
                    e.target.value.split(',').map((a) => a.trim())
                  )
                }
              />
            </div>

            <div className="form-row">
              <div className="form-field">
                <label htmlFor="venue">{t('venueLabel', language)}</label>
                <input
                  id="venue"
                  type="text"
                  value={fm.venue || ''}
                  onChange={(e) => updateField('venue', e.target.value)}
                />
              </div>
              <div className="form-field">
                <label htmlFor="year">{t('yearLabel', language)}</label>
                <input
                  id="year"
                  type="number"
                  value={fm.year || ''}
                  onChange={(e) => updateField('year', parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="doi">DOI</label>
              <input
                id="doi"
                type="text"
                value={fm.doi || ''}
                onChange={(e) => updateField('doi', e.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="url">URL</label>
              <input
                id="url"
                type="url"
                value={fm.url || ''}
                onChange={(e) => updateField('url', e.target.value)}
              />
            </div>
          </section>
        );
      })()}

      {frontmatter.type === 'CONTACT' && (() => {
        const fm = frontmatter as { email?: string; phone?: string; organization?: string; role?: string };
        return (
          <section className="form-section">
            <h3 className="form-section-title">{t('contactInfo', language)}</h3>

            <div className="form-field">
              <label htmlFor="email">{t('emailLabel', language)}</label>
              <input
                id="email"
                type="email"
                value={fm.email || ''}
                onChange={(e) => updateField('email', e.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="phone">{t('phoneLabel', language)}</label>
              <input
                id="phone"
                type="tel"
                value={fm.phone || ''}
                onChange={(e) => updateField('phone', e.target.value)}
              />
            </div>

            <div className="form-row">
              <div className="form-field">
                <label htmlFor="organization">{t('organizationLabel', language)}</label>
                <input
                  id="organization"
                  type="text"
                  value={fm.organization || ''}
                  onChange={(e) => updateField('organization', e.target.value)}
                />
              </div>
              <div className="form-field">
                <label htmlFor="role">{t('roleLabel', language)}</label>
                <input
                  id="role"
                  type="text"
                  value={fm.role || ''}
                  onChange={(e) => updateField('role', e.target.value)}
                />
              </div>
            </div>
          </section>
        );
      })()}
    </div>
  );
}

export default MetadataForm;

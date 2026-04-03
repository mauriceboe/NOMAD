import React, { useState, useEffect } from 'react';
import { storageApi } from '../../api/client';
import { useTranslation } from '../../i18n/TranslationContext';
import { useToast } from '../shared/Toast';

interface StorageAssignment {
  purpose: string;
  target_id: number | null;
  target_name: string;
}

interface StorageTarget {
  id: number;
  name: string;
  type: string;
  enabled: boolean;
}

export default function StorageAssignmentsPanel() {
  const { t } = useTranslation();
  const toast = useToast();
  const [assignments, setAssignments] = useState<StorageAssignment[]>([]);
  const [targets, setTargets] = useState<StorageTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [applyAllTarget, setApplyAllTarget] = useState<number | ''>('');
  const [applyingAll, setApplyingAll] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [assignmentsData, targetsData] = await Promise.all([
        storageApi.getAssignments(),
        storageApi.getTargets(),
      ]);
      setAssignments(assignmentsData.assignments);
      setTargets(targetsData.targets.filter((t: StorageTarget) => t.enabled));
    } catch (err) {
      console.error('Failed to load storage data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignmentChange = async (purpose: string, targetId: number | null) => {
    setSaving(purpose);
    try {
      await storageApi.updateAssignment(purpose, targetId);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update assignment');
    } finally {
      setSaving(null);
    }
  };

  const handleApplyToAll = async () => {
    setApplyingAll(true);
    const targetId = applyAllTarget === '' ? null : Number(applyAllTarget);
    try {
      await Promise.all(assignments.map(a => storageApi.updateAssignment(a.purpose, targetId)));
      await loadData();
      toast.success(t('admin.storage.applyToAllSuccess'));
    } catch (err: any) {
      toast.error(err.message || 'Failed to apply to all');
    } finally {
      setApplyingAll(false);
    }
  };

  const getPurposeIcon = (purpose: string) => {
    switch (purpose) {
      case 'backup':
        return '💾';
      case 'photos':
        return '📷';
      case 'files':
        return '📄';
      case 'covers':
        return '🖼️';
      case 'avatars':
        return '👤';
      default:
        return '📦';
    }
  };

  if (loading) {
    return <div className="text-center py-8">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('admin.storage.assignments')}
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {t('admin.storage.assignmentsDescription')}
        </p>
      </div>

      <div className="rounded-lg border p-4 flex flex-wrap items-center gap-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          {t('admin.storage.applyToAll')}:
        </span>
        <select
          value={applyAllTarget}
          onChange={e => setApplyAllTarget(e.target.value === '' ? '' : Number(e.target.value))}
          className="px-3 py-1 border rounded-lg text-sm"
          style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
        >
          <option value="">{t('admin.storage.localStorage')}</option>
          {targets.map(target => (
            <option key={target.id} value={target.id}>
              {target.name} ({target.type.toUpperCase()})
            </option>
          ))}
        </select>
        <button
          onClick={handleApplyToAll}
          disabled={applyingAll}
          className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50 transition-colors"
        >
          {applyingAll ? `${t('common.saving')}...` : t('admin.storage.applyToAllBtn')}
        </button>
      </div>

      <div className="rounded-lg shadow overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
        <table className="min-w-full">
          <thead style={{ background: 'var(--bg-secondary)' }}>
            <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {t('admin.storage.purpose')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {t('admin.storage.currentTarget')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {t('admin.storage.assignTarget')}
              </th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment) => (
              <tr key={assignment.purpose} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="text-2xl me-3">{getPurposeIcon(assignment.purpose)}</span>
                    <div>
                      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {t(`admin.storage.purpose_${assignment.purpose}`)}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {t(`admin.storage.purpose_${assignment.purpose}_desc`)}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-700">
                    {assignment.target_name}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    value={assignment.target_id || ''}
                    onChange={(e) =>
                      handleAssignmentChange(
                        assignment.purpose,
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    disabled={saving === assignment.purpose}
                    className="px-3 py-1 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50 text-sm"
                    style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  >
                    <option value="">{t('admin.storage.localStorage')}</option>
                    {targets.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.name} ({target.type.toUpperCase()})
                      </option>
                    ))}
                  </select>
                  {saving === assignment.purpose && (
                    <span className="ms-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {t('common.saving')}...
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-blue-400"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ms-3">
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {t('admin.storage.assignmentsNote')}
            </h3>
            <div className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <p>{t('admin.storage.assignmentsNoteText')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

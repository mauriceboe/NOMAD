import React, { useState, useEffect } from 'react';
import { storageApi } from '../../api/client';
import Modal from '../shared/Modal';
import { useTranslation } from '../../i18n/TranslationContext';
import { useToast } from '../shared/Toast';

interface StorageTarget {
  id: number;
  name: string;
  type: 'local' | 's3';
  enabled: boolean;
  config: {
    bucket?: string;
    region?: string;
    endpoint?: string;
    access_key_id?: string;
    secret_access_key?: string;
    path_prefix?: string;
    use_presigned_urls?: boolean;
  };
  encrypted: boolean;
  created_at: string;
  updated_at: string;
}

interface StorageTargetFormData {
  name: string;
  type: 'local' | 's3';
  enabled: boolean;
  encrypted: boolean;
  bucket: string;
  region: string;
  endpoint: string;
  access_key_id: string;
  secret_access_key: string;
  path_prefix: string;
  use_presigned_urls: boolean;
}

export default function StorageTargetsPanel() {
  const { t } = useTranslation();
  const toast = useToast();
  const [targets, setTargets] = useState<StorageTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTarget, setEditingTarget] = useState<StorageTarget | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [formData, setFormData] = useState<StorageTargetFormData>({
    name: '',
    type: 's3',
    enabled: true,
    encrypted: false,
    bucket: '',
    region: 'us-east-1',
    endpoint: '',
    access_key_id: '',
    secret_access_key: '',
    path_prefix: '',
    use_presigned_urls: false,
  });

  useEffect(() => {
    loadTargets();
  }, []);

  const loadTargets = async () => {
    try {
      const data = await storageApi.getTargets();
      setTargets(data.targets);
    } catch (err) {
      console.error('Failed to load storage targets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTarget(null);
    setFormData({
      name: '',
      type: 's3',
      enabled: true,
      encrypted: false,
      bucket: '',
      region: 'us-east-1',
      endpoint: '',
      access_key_id: '',
      secret_access_key: '',
      path_prefix: '',
      use_presigned_urls: false,
    });
    setShowModal(true);
  };

  const handleEdit = (target: StorageTarget) => {
    setEditingTarget(target);
    setFormData({
      name: target.name,
      type: target.type,
      enabled: target.enabled,
      encrypted: target.encrypted,
      bucket: target.config.bucket || '',
      region: target.config.region || 'us-east-1',
      endpoint: target.config.endpoint || '',
      access_key_id: target.config.access_key_id || '',
      secret_access_key: '', // Never populate password fields
      path_prefix: target.config.path_prefix || '',
      use_presigned_urls: target.config.use_presigned_urls || false,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: formData.name,
        type: formData.type,
        enabled: formData.enabled,
        encrypted: formData.encrypted,
      };

      if (formData.type === 's3') {
        payload.config = {
          bucket: formData.bucket,
          region: formData.region,
          endpoint: formData.endpoint || undefined,
          access_key_id: formData.access_key_id,
          secret_access_key: formData.secret_access_key || undefined,
          path_prefix: formData.path_prefix || undefined,
          use_presigned_urls: formData.use_presigned_urls,
        };
      }

      if (editingTarget) {
        await storageApi.updateTarget(editingTarget.id, payload);
      } else {
        await storageApi.createTarget(payload);
      }

      setShowModal(false);
      loadTargets();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save storage target');
    }
  };

  const handleTest = async (id: number) => {
    setTestingId(id);
    try {
      await storageApi.testTarget(id);
      toast.success(t('admin.storage.testSuccess'));
    } catch (err: any) {
      toast.error(t('admin.storage.testFailed') + ': ' + (err.message || 'Unknown error'));
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = (id: number, name: string) => {
    setConfirmDeleteTarget({ id, name });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteTarget) return;
    const { id } = confirmDeleteTarget;
    setConfirmDeleteTarget(null);
    try {
      await storageApi.deleteTarget(id);
      loadTargets();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete storage target');
    }
  };

  if (loading) {
    return <div className="text-center py-8">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('admin.storage.title')}
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {t('admin.storage.description')}
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {t('admin.storage.addTarget')}
        </button>
      </div>

      <div className="rounded-lg shadow overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
        <table className="min-w-full">
          <thead style={{ background: 'var(--bg-secondary)' }}>
            <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {t('admin.storage.name')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {t('admin.storage.type')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {t('admin.storage.status')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {t('admin.storage.encryption')}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {t('common.actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {targets.map((target) => (
              <tr key={target.id} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {target.name}
                  </div>
                  {target.type === 's3' && target.config.bucket && (
                    <div className="text-xs" style={{ color: 'var(--text-faint)' }}>
                      {target.config.bucket}
                      {target.config.path_prefix && ` / ${target.config.path_prefix}`}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    {target.type.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      target.enabled
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {target.enabled ? t('admin.storage.enabled') : t('admin.storage.disabled')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--text-muted)' }}>
                  {target.encrypted ? '🔒 ' + t('admin.storage.encrypted') : t('admin.storage.unencrypted')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex justify-end gap-2">
                  <button
                    onClick={() => handleTest(target.id)}
                    disabled={testingId === target.id}
                    className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                  >
                    {testingId === target.id ? t('admin.storage.testing') : t('admin.storage.test')}
                  </button>
                  <button
                    onClick={() => handleEdit(target)}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    onClick={() => handleDelete(target.id, target.name)}
                    className="text-red-600 hover:text-red-900"
                  >
                    {t('common.delete')}
                  </button>
                </td>
              </tr>
            ))}
            {targets.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                  {t('admin.storage.noTargets')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={editingTarget ? t('admin.storage.editTarget') : t('admin.storage.addTarget')}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                {t('admin.storage.name')}
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                {t('admin.storage.type')}
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'local' | 's3' })}
                disabled={!!editingTarget}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
              >
                <option value="s3">S3</option>
                <option value="local">Local</option>
              </select>
            </div>

            {formData.type === 's3' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    {t('admin.storage.bucket')}
                  </label>
                  <input
                    type="text"
                    value={formData.bucket}
                    onChange={(e) => setFormData({ ...formData, bucket: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    {t('admin.storage.region')}
                  </label>
                  <input
                    type="text"
                    value={formData.region}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    required
                    placeholder="us-east-1"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    {t('admin.storage.endpoint')} ({t('common.optional')})
                  </label>
                  <input
                    type="text"
                    value={formData.endpoint}
                    onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                    placeholder="https://s3.example.com"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {t('admin.storage.endpointHelp')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    {t('admin.storage.accessKeyId')}
                  </label>
                  <input
                    type="text"
                    value={formData.access_key_id}
                    onChange={(e) => setFormData({ ...formData, access_key_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    {t('admin.storage.secretAccessKey')}
                    {editingTarget && ` (${t('admin.storage.leaveBlankToKeep')})`}
                  </label>
                  <input
                    type="password"
                    value={formData.secret_access_key}
                    onChange={(e) => setFormData({ ...formData, secret_access_key: e.target.value })}
                    required={!editingTarget}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    {t('admin.storage.pathPrefix')} ({t('common.optional')})
                  </label>
                  <input
                    type="text"
                    value={formData.path_prefix}
                    onChange={(e) => setFormData({ ...formData, path_prefix: e.target.value })}
                    placeholder="trek/"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="use_presigned_urls"
                    checked={formData.use_presigned_urls}
                    onChange={(e) => setFormData({ ...formData, use_presigned_urls: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="use_presigned_urls" className="ms-2 block text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {t('admin.storage.usePresignedUrls')}
                  </label>
                </div>
              </>
            )}

            <div className="flex items-center">
              <input
                type="checkbox"
                id="encrypted"
                checked={formData.encrypted}
                onChange={(e) => setFormData({ ...formData, encrypted: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="encrypted" className="ms-2 block text-sm" style={{ color: 'var(--text-secondary)' }}>
                {t('admin.storage.encryptAtRest')}
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="enabled"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="enabled" className="ms-2 block text-sm" style={{ color: 'var(--text-secondary)' }}>
                {t('admin.storage.enabled')}
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border rounded-lg transition-colors"
                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingTarget ? t('common.save') : t('common.create')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {confirmDeleteTarget && (
        <Modal
          isOpen={!!confirmDeleteTarget}
          onClose={() => setConfirmDeleteTarget(null)}
          title={t('admin.storage.deleteTarget')}
        >
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            {t('admin.storage.confirmDelete', { name: confirmDeleteTarget.name })}
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setConfirmDeleteTarget(null)}
              className="px-4 py-2 border rounded-lg transition-colors"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              {t('common.delete')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

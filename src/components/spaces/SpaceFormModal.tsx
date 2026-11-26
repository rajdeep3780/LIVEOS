import { Home, Users, X } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { extractErrorMessage } from '../../services/api.ts';
import { createSpace } from '../../services/spaceService.ts';

interface SpaceFormModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (spaceId: string) => void;
}

export function SpaceFormModal({ open, onClose, onCreated }: SpaceFormModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'family' | 'community'>('family');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError('Please enter a space name (at least 2 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const space = await createSpace({
        name: name.trim(),
        type,
        description: description.trim(),
      });
      setName('');
      setDescription('');
      setType('family');
      onCreated(space.id);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to create space.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="space-modal-title"
    >
      <div className="w-full max-w-lg rounded-lg border border-[#2A2D36] bg-[#14161A] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#23262E] pb-4">
          <div>
            <h2
              id="space-modal-title"
              className="font-display text-lg font-semibold text-white"
            >
              Create Shared Space
            </h2>
            <p className="mt-0.5 text-xs text-[#9CA3AF]">
              Organize shared Matters with your household or private community.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-[#9CA3AF] transition-colors hover:bg-[#1E2128] hover:text-white"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="rounded-md border border-[#522424] bg-[#291416] px-3.5 py-2.5 text-sm text-[#FCA5A5]">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#CBD5E1]">
              Space Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('family')}
                className={`flex items-start gap-3 rounded-md border p-3 text-left transition-colors ${
                  type === 'family'
                    ? 'border-[#F97316] bg-[#26180F]'
                    : 'border-[#262930] bg-[#191C22] hover:border-[#363B45]'
                }`}
              >
                <Home
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    type === 'family' ? 'text-[#F97316]' : 'text-[#9CA3AF]'
                  }`}
                />
                <div>
                  <div className="text-sm font-medium text-white">Family Space</div>
                  <div className="mt-0.5 text-xs text-[#9CA3AF]">
                    Household tasks, repairs, and family responsibilities.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType('community')}
                className={`flex items-start gap-3 rounded-md border p-3 text-left transition-colors ${
                  type === 'community'
                    ? 'border-[#F97316] bg-[#26180F]'
                    : 'border-[#262930] bg-[#191C22] hover:border-[#363B45]'
                }`}
              >
                <Users
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    type === 'community' ? 'text-[#F97316]' : 'text-[#9CA3AF]'
                  }`}
                />
                <div>
                  <div className="text-sm font-medium text-white">Community Space</div>
                  <div className="mt-0.5 text-xs text-[#9CA3AF]">
                    Private invitation-only clubs, committees, or local groups.
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="space-name"
              className="mb-1.5 block text-xs font-medium text-[#CBD5E1]"
            >
              Space Name
            </label>
            <input
              id="space-name"
              type="text"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                type === 'family'
                  ? 'e.g., Sharma Household'
                  : 'e.g., Oakwood Building Committee'
              }
              className="w-full rounded-md border border-[#2B2E38] bg-[#0F1114] px-3.5 py-2.5 text-sm text-white placeholder-[#6B7280] focus:border-[#F97316] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="space-desc"
              className="mb-1.5 block text-xs font-medium text-[#CBD5E1]"
            >
              Description (Optional)
            </label>
            <textarea
              id="space-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Purpose or scope of this space..."
              className="w-full rounded-md border border-[#2B2E38] bg-[#0F1114] px-3.5 py-2.5 text-sm text-white placeholder-[#6B7280] focus:border-[#F97316] focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#23262E] pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md border border-[#2B2E38] bg-[#1A1D23] px-4 py-2 text-sm font-medium text-[#E5E7EB] transition-colors hover:bg-[#22262E]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-[#F97316] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#EA580C] disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Space'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

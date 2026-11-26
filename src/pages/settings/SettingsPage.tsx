import { LogOut, Save, Shield } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.tsx';
import { formatLongDate } from '../../lib/date.ts';
import { extractErrorMessage } from '../../services/api.ts';

export function SettingsPage() {
  const { user, updateProfileName, logout } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedMessage(null);

    if (displayName.trim().length < 2) {
      setError('Display name must be at least 2 characters.');
      return;
    }

    setSaving(true);
    try {
      await updateProfileName(displayName.trim());
      setSavedMessage('Profile updated successfully.');
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to update profile.'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-white">
          Settings
        </h2>
        <p className="mt-0.5 text-sm text-[#9CA3AF]">
          Manage your profile identity and active session.
        </p>
      </div>

      {/* Profile Section */}
      <section className="rounded-lg border border-[#23262E] bg-[#14161A] p-6">
        <h3 className="font-display text-base font-semibold text-white">
          Account Profile
        </h3>
        <p className="mt-1 text-xs text-[#9CA3AF]">
          Your display name appears on Matters, ownership assignments, and timeline
          updates.
        </p>

        <form onSubmit={handleSave} className="mt-5 space-y-4">
          {error && (
            <div className="rounded-md border border-[#522424] bg-[#291416] px-3.5 py-2 text-sm text-[#FCA5A5]">
              {error}
            </div>
          )}
          {savedMessage && (
            <div className="rounded-md border border-[#1E4734] bg-[#0E1E16] px-3.5 py-2 text-sm text-[#6EE7B7]">
              {savedMessage}
            </div>
          )}

          <div>
            <label
              htmlFor="settings-display-name"
              className="mb-1.5 block text-xs font-medium text-[#CBD5E1]"
            >
              Display Name
            </label>
            <input
              id="settings-display-name"
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-md border border-[#2B2E38] bg-[#0F1114] px-3.5 py-2.5 text-sm text-white focus:border-[#F97316] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="settings-email"
              className="mb-1.5 block text-xs font-medium text-[#CBD5E1]"
            >
              Email Address
            </label>
            <input
              id="settings-email"
              type="email"
              disabled
              value={user?.email || ''}
              className="w-full rounded-md border border-[#23262E] bg-[#0B0C0E] px-3.5 py-2.5 text-sm text-[#8B929E]"
            />
          </div>

          {user?.createdAt && (
            <div className="text-xs text-[#8B929E]">
              Member since {formatLongDate(new Date(user.createdAt))}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-[#F97316] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#EA580C] disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Privacy & Session Section */}
      <section className="rounded-lg border border-[#23262E] bg-[#14161A] p-6">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-4 w-4 text-[#F97316]" />
          <div>
            <h3 className="font-display text-base font-semibold text-white">
              Privacy &amp; Session
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[#9CA3AF]">
              All Personal, Family, and Community Spaces enforce server-side
              membership verification. Personal Spaces remain strictly private
              to your account.
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-[#20232B] pt-4">
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-md border border-[#2B2E38] bg-[#1A1D23] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#22262E]"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign out of LIFEOS</span>
          </button>
        </div>
      </section>
    </div>
  );
}

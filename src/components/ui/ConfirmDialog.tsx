import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-lg border border-[#2A2D36] bg-[#14161A] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${
                destructive
                  ? 'border-[#522424] bg-[#291416] text-[#F87171]'
                  : 'border-[#523018] bg-[#26180F] text-[#F97316]'
              }`}
            >
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h3
                id="confirm-dialog-title"
                className="font-display text-base font-semibold text-white"
              >
                {title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[#9CA3AF]">
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded p-1 text-[#9CA3AF] transition-colors hover:bg-[#1E2128] hover:text-white"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-md border border-[#2B2E38] bg-[#1A1D23] px-4 py-2 text-sm font-medium text-[#E5E7EB] transition-colors hover:bg-[#22262E] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
              destructive
                ? 'bg-[#DC2626] hover:bg-[#B91C1C]'
                : 'bg-[#F97316] hover:bg-[#EA580C]'
            }`}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

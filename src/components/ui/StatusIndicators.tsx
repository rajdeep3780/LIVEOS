import {
  Archive,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CircleDot,
  Clock,
  Home,
  Lock,
  Minus,
  PlayCircle,
  Users,
} from 'lucide-react';
import type { MatterPriority, MatterStatus, SpaceType } from '../../types/lifeos.ts';

const STATUS_STYLES: Record<
  MatterStatus,
  { bg: string; border: string; text: string }
> = {
  Open: {
    bg: 'bg-[#161F2E]',
    border: 'border-[#273854]',
    text: 'text-[#7DD3FC]',
  },
  'In Progress': {
    bg: 'bg-[#26180F]',
    border: 'border-[#573218]',
    text: 'text-[#FB923C]',
  },
  Waiting: {
    bg: 'bg-[#251E10]',
    border: 'border-[#4E3D19]',
    text: 'text-[#FBBF24]',
  },
  Completed: {
    bg: 'bg-[#10231A]',
    border: 'border-[#1E4734]',
    text: 'text-[#34D399]',
  },
  Archived: {
    bg: 'bg-[#181A1F]',
    border: 'border-[#2B2E38]',
    text: 'text-[#8B929E]',
  },
};

export function StatusTag({ status }: { status: MatterStatus }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.Open;

  const Icon =
    status === 'Open'
      ? CircleDot
      : status === 'In Progress'
      ? PlayCircle
      : status === 'Waiting'
      ? Clock
      : status === 'Completed'
      ? CheckCircle2
      : Archive;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 ${style.bg} ${style.border} ${style.text}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{status}</span>
    </span>
  );
}

export function PriorityTag({ priority }: { priority: MatterPriority }) {
  if (priority === 'High') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#F87171] whitespace-nowrap shrink-0">
        <ArrowUp className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>High</span>
      </span>
    );
  }
  if (priority === 'Low') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#8B929E] whitespace-nowrap shrink-0">
        <ArrowDown className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>Low</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-[#CBD5E1] whitespace-nowrap shrink-0">
      <Minus className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>Normal</span>
    </span>
  );
}

export function SpaceTypeIndicator({ type }: { type: SpaceType }) {
  if (type === 'personal') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[#9CA3AF] whitespace-nowrap shrink-0">
        <Lock className="h-3.5 w-3.5 text-[#9CA3AF]" aria-hidden="true" />
        <span>Personal</span>
      </span>
    );
  }
  if (type === 'family') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[#FB923C] whitespace-nowrap shrink-0">
        <Home className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Family</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[#7DD3FC] whitespace-nowrap shrink-0">
      <Users className="h-3.5 w-3.5" aria-hidden="true" />
      <span>Community</span>
    </span>
  );
}

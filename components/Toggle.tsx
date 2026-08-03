'use client';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  color?: 'primary' | 'gold' | 'blue';
  size?: 'sm' | 'md';
  id?: string;
  className?: string;
}

const COLOR_MAP = {
  primary: { on: 'bg-primary-500', ring: 'focus:ring-primary-500/40' },
  gold: { on: 'bg-gold-500', ring: 'focus:ring-gold-500/40' },
  blue: { on: 'bg-blue-500', ring: 'focus:ring-blue-500/40' },
};

const SIZE_MAP = {
  sm: {
    track: 'h-5 w-9',
    thumb: 'h-4 w-4',
    thumbOn: 'translate-x-4',
    thumbOff: 'translate-x-0.5',
  },
  md: {
    track: 'h-6 w-11',
    thumb: 'h-5 w-5',
    thumbOn: 'translate-x-5',
    thumbOff: 'translate-x-0.5',
  },
};

export default function Toggle({
  checked,
  onChange,
  disabled = false,
  color = 'primary',
  size = 'md',
  id,
  className = '',
}: ToggleProps) {
  const colors = COLOR_MAP[color];
  const sizes = SIZE_MAP[size];

  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex shrink-0 cursor-pointer items-center
        ${sizes.track} rounded-full transition-colors duration-200 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-base
        ${colors.ring}
        ${checked ? colors.on : 'bg-border-subtle'}
        ${disabled ? 'cursor-not-allowed opacity-50' : ''}
        ${className}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block ${sizes.thumb} transform rounded-full
          bg-white shadow ring-0 transition-transform duration-200 ease-in-out
          ${checked ? sizes.thumbOn : sizes.thumbOff}
        `}
      />
    </button>
  );
}

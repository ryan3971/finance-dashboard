import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'warning';
type Size = 'sm' | 'md';

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-content-primary text-white hover:bg-gray-800 disabled:opacity-50',
  secondary:
    'border border-border-strong hover:bg-surface-subtle disabled:opacity-40',
  ghost: 'text-content-secondary hover:text-content-primary',
  warning:
    'bg-warning-action text-white hover:bg-amber-700 disabled:opacity-50',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1 text-xs rounded',
  md: 'px-4 py-1.5 text-sm rounded-md',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className = '', children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`font-medium transition-colors disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});

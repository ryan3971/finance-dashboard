interface FormFieldProps {
  label: React.ReactNode;
  error?: string;
  labelSize?: 'sm' | 'xs';
  children: React.ReactNode;
}

export function FormField({
  label,
  error,
  labelSize = 'sm',
  children,
}: FormFieldProps) {
  return (
    <div>
      <label className={labelSize === 'xs' ? 'label-xs' : 'label-sm'}>
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}

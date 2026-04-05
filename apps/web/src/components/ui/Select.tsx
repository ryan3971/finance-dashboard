import React from 'react';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className = '', children, ...props }, ref) => {
  return (
    <select ref={ref} className={`select-base ${className}`} {...props}>
      {children}
    </select>
  );
});

Select.displayName = 'Select';

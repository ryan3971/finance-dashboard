import React from 'react';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className = '', ...props }, ref) => {
  return <input ref={ref} className={`input-base ${className}`} {...props} />;
});

Input.displayName = 'Input';

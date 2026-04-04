import React from 'react';

export function Input({
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input-base ${className}`} {...props} />;
}

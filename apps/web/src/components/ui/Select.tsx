import React from 'react';

export function Select({
  className = '',
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`select-base ${className}`} {...props}>
      {children}
    </select>
  );
}

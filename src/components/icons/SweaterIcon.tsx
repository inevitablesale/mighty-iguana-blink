import React from 'react';

export const SweaterIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M8 20H6a2 2 0 0 1-2-2V7.5a2.5 2.5 0 0 1 2.5-2.5h1.5"/>
    <path d="M18 20h-2a2 2 0 0 1-2-2V7.5a2.5 2.5 0 0 1 2.5-2.5h1.5"/>
    <path d="M12 5a2 2 0 0 0-2 2v11h4V7a2 2 0 0 0-2-2Z"/>
    <path d="M9.5 5C9.5 3.34 10.84 2 12.5 2s3 1.34 3 3"/>
  </svg>
);
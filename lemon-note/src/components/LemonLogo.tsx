interface LemonLogoProps {
  size?: number;
  className?: string;
}

export function LemonLogo({ size = 28, className }: LemonLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <radialGradient id="lemonGrad" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="100%" stopColor="#EAB308" />
        </radialGradient>
      </defs>
      {/* 柠檬果实 */}
      <ellipse cx="14" cy="15" rx="10" ry="11.5" fill="url(#lemonGrad)" />
      {/* 高光 */}
      <ellipse cx="11" cy="10.5" rx="3.5" ry="5" fill="#FEF08A" opacity="0.45" />
      {/* 果梗 */}
      <line x1="14" y1="4" x2="14" y2="1.5" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round" />
      {/* 叶子 */}
      <path d="M14 4 C13 5.5 11 5 11 3 C11 1.5 13 1 14 2.5" fill="#4ADE80" />
    </svg>
  );
}

import type { CSSProperties, ReactNode } from 'react';

type PageScaleProps = {
  scale: number;
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
};

export default function PageScale({ scale, className, children, style }: PageScaleProps) {
  return (
    <div
      className={className}
      style={{
        zoom: scale,
        width: '100%',
        minHeight: `calc(100svh / ${scale})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

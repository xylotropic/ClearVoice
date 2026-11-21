export function VoiceMark({
  className,
  width = 32,
  height = width,
  warning = false,
}: {
  className?: string;
  width?: number | string;
  height?: number | string;
  warning?: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      width={width}
      height={height}
      className={className}
      fill="none"
    >
      <path
        d={
          warning ? "M16 9v9m0 4v.5" : "M6 13v6m5-10v14m5-18v22m5-18v14m5-10v6"
        }
        stroke="currentColor"
        strokeWidth="2.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

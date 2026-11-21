const APP_NAME = "ClearVoice";

const ClearVoiceWordmark = ({
  width = 120,
  className,
}: {
  width?: number;
  className?: string;
}) => (
  <svg
    aria-label={APP_NAME}
    role="img"
    width={width}
    viewBox="0 0 142 29"
    className={className}
  >
    <text
      x="0"
      y="23"
      fill="currentColor"
      fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
      fontSize="27"
      fontWeight="660"
      letterSpacing="-0.9"
    >
      {APP_NAME}
    </text>
  </svg>
);

export default ClearVoiceWordmark;

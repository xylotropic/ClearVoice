import mark from "@/assets/prism-mark.webp";

export default function PrismWordmark({
  width = 112,
  className,
}: {
  width?: number;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{ display: "inline-flex", width, alignItems: "center", gap: 7 }}
      role="img"
      aria-label="Prism"
    >
      <img src={mark} alt="" width={30} height={30} />
      <span
        className="font-semibold"
        style={{ fontSize: 27, letterSpacing: "-.06em", lineHeight: 1 }}
        aria-hidden="true"
      >
        {"Prism"}
      </span>
    </span>
  );
}

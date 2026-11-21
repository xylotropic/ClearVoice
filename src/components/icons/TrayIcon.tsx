import { VoiceMark } from "./VoiceMark";

type TrayIconState = "idle" | "recording" | "transcribing";

const TrayIcon = ({
  state,
  size,
}: {
  state: TrayIconState;
  size: number | string;
}) => (
  <VoiceMark
    width={size}
    className={state === "idle" ? "" : "text-current opacity-65"}
  />
);

export default TrayIcon;

import { Cpu } from "lucide-react";
import alibaba from "@/assets/model-makers/alibabacloud.svg";
import ibm from "@/assets/model-makers/ibm.svg";
import moonshine from "@/assets/model-makers/moonshine.png";
import nvidia from "@/assets/model-makers/nvidia.svg";
import openai from "@/assets/model-makers/openai.svg";

const NVIDIA = { name: "NVIDIA", src: nvidia };
const ALIBABA = { name: "Alibaba Cloud", src: alibaba };
const IBM = { name: "IBM", src: ibm };
const MOONSHINE = { name: "Moonshine AI", src: moonshine };

const MAKERS: Record<string, { name: string; src: string }> = {
  parakeet: NVIDIA,
  canary: NVIDIA,
  canary_qwen: NVIDIA,
  whisper: { name: "OpenAI", src: openai },
  qwen3_asr: ALIBABA,
  funasr_nano: ALIBABA,
  sensevoice: ALIBABA,
  granite5_ctc: IBM,
  granite_speech: IBM,
  granite_speech_nar: IBM,
  moonshine: MOONSHINE,
  moonshine_streaming: MOONSHINE,
};

export function ModelMakerIcon({ family }: { family?: string }) {
  const maker = family ? MAKERS[family] : undefined;
  return maker ? (
    <img
      src={maker.src}
      alt=""
      title={maker.name}
      className="size-[18px] shrink-0 rounded-[3px] object-contain"
    />
  ) : (
    <Cpu
      className="size-[18px] shrink-0 p-[1px] text-ink-3"
      aria-hidden="true"
    />
  );
}

import React from "react";
import NoticeChip from "./NoticeChip";
import TranscriptionStatus from "./TranscriptionStatus";
import { useNoticeStore } from "@/stores/noticeStore";
import { useModelsLocked } from "@/stores/transcriptionJobsStore";

interface FooterProps {
  onShowHistory: () => void;
}

const Footer: React.FC<FooterProps> = ({ onShowHistory }) => {
  const hasJobs = useModelsLocked();
  const hasNotices = useNoticeStore(
    (state) =>
      state.notices.length > 0 || state.local.some((notice) => notice.kept),
  );
  if (!hasJobs && !hasNotices) return null;

  return (
    <div className="flex w-full items-center justify-end gap-3 border-t border-line px-4 py-2 text-xs text-ink-2">
      <TranscriptionStatus onShowHistory={onShowHistory} />
      <NoticeChip />
    </div>
  );
};

export default Footer;

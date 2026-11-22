import React from "react";

interface SettingsGroupProps {
  id?: string;
  title?: string;
  description?: string;
  children: React.ReactNode;
}

export const SettingsGroup: React.FC<SettingsGroupProps> = ({
  id,
  title,
  description,
  children,
}) => {
  return (
    <div id={id} className="scroll-mt-4 space-y-2.5">
      {title && (
        <div className="px-1">
          <h2 className="text-[14px] font-semibold text-text">{title}</h2>
          {description && (
            <p className="text-xs text-ink-3 mt-1">{description}</p>
          )}
        </div>
      )}
      <div className="overflow-visible rounded-panel border border-line bg-background">
        <div className="divide-y divide-line">{children}</div>
      </div>
    </div>
  );
};

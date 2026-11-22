import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, Clock3, Flame, Layers2, Mic } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isRTLLanguage } from "@/lib/utils/rtl";
import { commands, events, type ActivitySummary } from "@/bindings";
import { Button } from "../ui/Button";
import "./Home.css";

const WEEKS = 16;
const DAY_MS = 86_400_000;
const LEVELS = [0, 1, 2, 3, 4];

function ActivityCalendar({ data }: { data: ActivitySummary }) {
  const { t, i18n } = useTranslation();
  const [focusedDate, setFocusedDate] = useState<string>();
  const [hoveredDate, setHoveredDate] = useState<string>();
  const dateButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const end = new Date(`${data.today}T00:00:00Z`);
  const mondayOffset = (end.getUTCDay() + 6) % 7;
  const start = end.getTime() - (mondayOffset + (WEEKS - 1) * 7) * DAY_MS;
  const counts = new Map(data.days.map(({ date, words }) => [date, words]));
  const days = Array.from({ length: WEEKS * 7 }, (_, index) => {
    const date = new Date(start + index * DAY_MS);
    const id = date.toISOString().slice(0, 10);
    const words = counts.get(id) ?? 0;
    const level =
      words === 0 ? 0 : words < 100 ? 1 : words < 300 ? 2 : words < 750 ? 3 : 4;
    return { date, id, level, words };
  });
  const weeks = days.filter((_, index) => index % 7 === 0);
  const selected =
    days.find(({ id }) => id === focusedDate && id <= data.today)?.id ??
    data.today;
  const detail = days.find(({ id }) => id === (hoveredDate ?? selected));
  const number = new Intl.NumberFormat(i18n.language);
  const dateLabel = new Intl.DateTimeFormat(i18n.language, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const weekdayLabel = new Intl.DateTimeFormat(i18n.language, {
    weekday: "short",
    timeZone: "UTC",
  });
  const monthLabel = new Intl.DateTimeFormat(i18n.language, {
    month: "short",
    timeZone: "UTC",
  });
  const horizontal = isRTLLanguage(i18n.language) ? -7 : 7;

  return (
    <section aria-labelledby="activity-title" className="prism-activity">
      <div className="prism-activity-heading">
        <h2 id="activity-title">{t("home.activity")}</h2>
        {detail && (
          <p className="prism-activity-detail">
            <time dateTime={detail.id}>{dateLabel.format(detail.date)}</time>
            <span>
              {t("home.dailyWords", { words: number.format(detail.words) })}
            </span>
          </p>
        )}
      </div>
      <div
        className="prism-calendar"
        role="group"
        aria-labelledby="activity-title"
      >
        <div className="prism-calendar-labels" aria-hidden="true">
          {[0, 2, 4, 6].map((index) => (
            <span key={index} style={{ gridRow: index + 1 }}>
              {weekdayLabel.format(days[index].date)}
            </span>
          ))}
        </div>
        <div className="prism-calendar-months" aria-hidden="true">
          {weeks.map(
            ({ date, id }, index) =>
              (index === 0 ||
                date.getUTCMonth() !== weeks[index - 1].date.getUTCMonth()) && (
                <span key={id} style={{ gridColumn: index + 1 }}>
                  {monthLabel.format(date)}
                </span>
              ),
          )}
        </div>
        <div
          className="prism-calendar-days"
          onPointerLeave={() => setHoveredDate(undefined)}
        >
          {days.map(({ date, id, level, words }, index) => {
            if (id > data.today) return <span aria-hidden="true" key={id} />;
            const label = `${dateLabel.format(date)}. ${t("home.dailyWords", { words: number.format(words) })}`;
            return (
              <button
                type="button"
                key={id}
                ref={(button) => {
                  dateButtons.current[id] = button;
                }}
                aria-label={label}
                aria-current={id === data.today ? "date" : undefined}
                data-level={level}
                tabIndex={selected === id ? 0 : -1}
                onFocus={() => {
                  setHoveredDate(undefined);
                  setFocusedDate(id);
                }}
                onPointerEnter={() => setHoveredDate(id)}
                onClick={() => setFocusedDate(id)}
                onKeyDown={(event) => {
                  const offsets: Record<string, number> = {
                    ArrowUp: -1,
                    ArrowDown: 1,
                    ArrowLeft: -horizontal,
                    ArrowRight: horizontal,
                  };
                  const offset = offsets[event.key];
                  if (offset === undefined) return;
                  event.preventDefault();
                  const next = days[index + offset];
                  if (next) dateButtons.current[next.id]?.focus();
                }}
              />
            );
          })}
        </div>
      </div>
      <div
        className="prism-activity-legend"
        aria-label={`${t("home.less")} – ${t("home.more")}`}
      >
        <span>{t("home.less")}</span>
        {LEVELS.map((level) => (
          <i key={level} data-level={level} aria-hidden="true" />
        ))}
        <span>{t("home.more")}</span>
      </div>
    </section>
  );
}

export function Home() {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<ActivitySummary>();
  const [failed, setFailed] = useState(false);
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const generation = ++request.current;
    try {
      const response = await commands.getActivitySummary();
      if (generation !== request.current) return;
      if (response.status === "error") throw response.error;
      setData(response.data);
      setFailed(false);
    } catch (error) {
      if (generation !== request.current) return;
      console.error("Could not load dictation activity", error);
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const listen = events.historyUpdatePayload.listen(({ payload }) => {
      if (payload.action === "added" || payload.action === "updated")
        void refresh();
    });
    window.addEventListener("focus", refresh);
    // Refresh at midnight even if the window stays open.
    let midnight: number;
    function scheduleMidnight() {
      const next = new Date();
      next.setHours(24, 0, 0, 50);
      midnight = window.setTimeout(() => {
        void refresh();
        scheduleMidnight();
      }, next.getTime() - Date.now());
    }
    scheduleMidnight();
    return () => {
      ++request.current;
      window.removeEventListener("focus", refresh);
      window.clearTimeout(midnight);
      void listen.then(
        (stop) => stop(),
        () => {},
      );
    };
  }, [refresh]);

  const number = new Intl.NumberFormat(i18n.language);
  const unit = (value: number, unit: "day" | "hour") =>
    new Intl.NumberFormat(i18n.language, {
      style: "unit",
      unit,
      maximumFractionDigits: 2,
    }).format(value);
  const hoursSaved = data ? (data.words_total * (1 / 50 - 1 / 150)) / 60 : 0;
  const stats = [
    {
      label: "wordsToday",
      value: data && number.format(data.words_today),
      icon: Mic,
    },
    {
      label: "wordsTotal",
      value: data && number.format(data.words_total),
      icon: AudioLines,
    },
    { label: "streak", value: data && unit(data.streak, "day"), icon: Flame },
    {
      label: "timeSaved",
      value: data && unit(hoursSaved, "hour"),
      icon: Clock3,
    },
    {
      label: "transcriptions",
      value: data && number.format(data.transcriptions),
      icon: Layers2,
    },
  ];

  return (
    <div className="prism-home">
      <h1 className="font-display text-[30px] font-[680] leading-tight tracking-[-0.045em]">
        {t("sidebar.home")}
      </h1>
      <dl className="prism-home-totals" aria-busy={!data && !failed}>
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className={`prism-stat prism-stat-${label}`}>
            <dt>
              <Icon aria-hidden="true" size={15} strokeWidth={1.8} />
              {t(`home.${label}`)}
            </dt>
            <dd>{value ?? "—"}</dd>
            {label === "timeSaved" && (
              <span
                className="prism-stat-detail"
                tabIndex={0}
                aria-label={t("home.timeEstimate")}
                title={t("home.timeEstimate")}
              >
                {t("home.estimated")}
              </span>
            )}
          </div>
        ))}
      </dl>
      {failed && (
        <div
          className="flex items-center justify-between gap-4 text-small"
          role="status"
        >
          <span>{t("home.unavailable")}</span>
          <Button onClick={() => void refresh()} size="sm" variant="outline">
            {t("home.retry")}
          </Button>
        </div>
      )}
      {data && <ActivityCalendar data={data} />}
    </div>
  );
}

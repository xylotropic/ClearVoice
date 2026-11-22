use chrono::{DateTime, Days, Local, NaiveDate};
use rusqlite::{params, Connection, TransactionBehavior};
use serde::Serialize;
use specta::Type;
use unicode_segmentation::UnicodeSegmentation;

#[derive(Debug, Serialize, Type)]
pub struct ActivitySummary {
    pub today: String,
    pub words_today: u64,
    pub words_total: u64,
    pub transcriptions: u64,
    pub streak: u32,
    pub days: Vec<ActivityDay>,
}

#[derive(Debug, Serialize, Type)]
pub struct ActivityDay {
    pub date: String,
    pub words: u64,
}

/// Keep only daily counts so normal history retention can remove old audio
/// and text without erasing lifetime totals. Seed once from retained history.
pub(super) fn initialize(conn: &mut Connection) -> rusqlite::Result<()> {
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let exists: bool = tx.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_schema WHERE name = 'prism_activity')",
        [],
        |row| row.get(0),
    )?;
    if exists {
        return Ok(());
    }
    tx.execute_batch(
        "CREATE TABLE prism_activity (
            day TEXT PRIMARY KEY,
            words INTEGER NOT NULL,
            transcriptions INTEGER NOT NULL
        );",
    )?;
    {
        let mut entries = tx.prepare(
            "SELECT timestamp, transcription_text, source_name IS NULL
             FROM transcription_history WHERE transcription_text <> ''",
        )?;
        let mut rows = entries.query([])?;
        while let Some(row) = rows.next()? {
            let text: String = row.get(1)?;
            record(&tx, row.get(0)?, &text, row.get(2)?)?;
        }
    }
    tx.commit()
}

/// File transcriptions count toward the total. Spoken words come from the
/// microphone and use the original text, before optional cleanup or rewriting.
pub(super) fn record(
    conn: &Connection,
    timestamp: i64,
    text: &str,
    dictation: bool,
) -> rusqlite::Result<()> {
    let words = text.unicode_words().count();
    let Some(date) = DateTime::from_timestamp(timestamp, 0) else {
        return Ok(());
    };
    if words == 0 {
        return Ok(());
    }

    conn.execute(
        "INSERT INTO prism_activity (day, words, transcriptions) VALUES (?1, ?2, 1)
         ON CONFLICT(day) DO UPDATE SET
            words = words + excluded.words,
            transcriptions = transcriptions + 1",
        params![
            date.with_timezone(&Local).date_naive().to_string(),
            if dictation { words } else { 0 },
        ],
    )?;
    Ok(())
}

pub(super) fn summary(conn: &Connection, today: NaiveDate) -> rusqlite::Result<ActivitySummary> {
    let mut query =
        conn.prepare("SELECT day, words, transcriptions FROM prism_activity ORDER BY day DESC")?;
    let mut rows = query.query([])?;
    let first_day = today.checked_sub_days(Days::new(111)).unwrap_or(today);
    let mut result = ActivitySummary {
        today: today.to_string(),
        words_today: 0,
        words_total: 0,
        transcriptions: 0,
        streak: 0,
        days: Vec::new(),
    };
    let mut streak_day = Some(today);
    while let Some(row) = rows.next()? {
        let date: String = row.get(0)?;
        let words: u64 = row.get(1)?;
        result.words_total += words;
        result.transcriptions += row.get::<_, u64>(2)?;

        let Ok(day) = NaiveDate::parse_from_str(&date, "%Y-%m-%d") else {
            continue;
        };
        if day == today {
            result.words_today = words;
        }
        if words == 0 || day > today {
            continue;
        }
        if streak_day == Some(today) && day < today {
            // Yesterday's streak remains active until the current day closes.
            streak_day = today.pred_opt();
        }
        if streak_day == Some(day) {
            result.streak += 1;
            streak_day = day.pred_opt();
        }
        if day >= first_day {
            result.days.push(ActivityDay { date, words });
        }
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn existing_history_is_seeded_once_and_retention_preserves_totals() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE transcription_history (
                timestamp INTEGER NOT NULL,
                transcription_text TEXT NOT NULL,
                source_name TEXT
            );",
        )
        .unwrap();
        let timestamp = Local::now().timestamp();
        conn.execute(
            "INSERT INTO transcription_history VALUES (?1, 'Hello from Prism!', NULL),
                (?1, 'This was a file', 'audio.wav'), (?1, '', 'empty.wav')",
            [timestamp],
        )
        .unwrap();
        initialize(&mut conn).unwrap();
        initialize(&mut conn).unwrap();
        conn.execute("DELETE FROM transcription_history", [])
            .unwrap();
        let today = DateTime::from_timestamp(timestamp, 0)
            .unwrap()
            .with_timezone(&Local)
            .date_naive();
        let result = summary(&conn, today).unwrap();
        assert_eq!(result.words_today, 3);
        assert_eq!(result.words_total, 3);
        assert_eq!(result.transcriptions, 2);
        assert_eq!(result.streak, 1);
        assert_eq!(result.days.len(), 1);
    }

    #[test]
    fn yesterday_counts_toward_the_streak_and_an_older_gap_breaks_it() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE prism_activity (day TEXT PRIMARY KEY, words INTEGER, transcriptions INTEGER);
             INSERT INTO prism_activity VALUES
                ('2026-03-07', 8, 1), ('2026-03-09', 51, 1), ('2026-03-10', 22, 1),
                ('2026-03-11', 0, 1);",
        ).unwrap();
        let today = NaiveDate::from_ymd_opt(2026, 3, 11).unwrap();
        let result = summary(&conn, today).unwrap();
        assert_eq!(result.streak, 2);
        assert_eq!(result.words_today, 0);
        assert_eq!(result.words_total, 81);
        assert_eq!(result.transcriptions, 4);
        assert_eq!(result.days.len(), 3);
    }
}

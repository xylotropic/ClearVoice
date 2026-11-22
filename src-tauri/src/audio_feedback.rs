use crate::audio_toolkit::audio::output_device_name;
use crate::settings::SoundTheme;
use crate::settings::{self, AppSettings};
use log::{debug, error, warn};
use rodio::cpal::traits::HostTrait;
use rodio::DeviceSinkBuilder;
use std::fs::File;
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::thread;
use tauri::{AppHandle, Manager};

pub enum SoundType {
    Start,
    Stop,
    Cancel,
}

fn resolve_sound_path(
    app: &AppHandle,
    settings: &AppSettings,
    sound_type: SoundType,
) -> Option<PathBuf> {
    let selected = match sound_type {
        SoundType::Start => settings.recording_sounds.start,
        SoundType::Stop => settings.recording_sounds.stop,
        SoundType::Cancel => settings.recording_sounds.cancel,
    };
    let mut theme = selected.unwrap_or(settings.sound_theme);
    if theme == SoundTheme::Custom {
        let name = match sound_type {
            SoundType::Start => "custom_start.wav",
            SoundType::Stop => "custom_stop.wav",
            SoundType::Cancel => "custom_cancel.wav",
        };
        let custom = crate::portable::resolve_app_data(app, name).ok();
        if custom.as_ref().is_some_and(|path| path.is_file()) {
            return custom;
        }
        theme = SoundTheme::Marimba;
    }
    let sound_file = match sound_type {
        SoundType::Start => theme.to_start_path(),
        SoundType::Stop => theme.to_stop_path(),
        SoundType::Cancel if theme == SoundTheme::Pop => "resources/pop_cancel.wav".into(),
        SoundType::Cancel => "resources/marimba_cancel.wav".into(),
    };
    app.path()
        .resolve(&sound_file, tauri::path::BaseDirectory::Resource)
        .ok()
}

pub fn play_feedback_sound(app: &AppHandle, sound_type: SoundType) {
    let settings = settings::get_settings(app);
    if !settings.audio_feedback {
        return;
    }
    if let Some(path) = resolve_sound_path(app, &settings, sound_type) {
        play_sound_async(app, path);
    }
}

pub fn play_feedback_sound_blocking(app: &AppHandle, sound_type: SoundType) {
    let settings = settings::get_settings(app);
    if !settings.audio_feedback {
        return;
    }
    if let Some(path) = resolve_sound_path(app, &settings, sound_type) {
        play_sound_blocking(app, &path);
    }
}

pub fn play_test_sound(app: &AppHandle, sound_type: SoundType) {
    let settings = settings::get_settings(app);
    if let Some(path) = resolve_sound_path(app, &settings, sound_type) {
        play_sound_blocking(app, &path);
    }
}

fn play_sound_async(app: &AppHandle, path: PathBuf) {
    let app_handle = app.clone();
    thread::spawn(move || {
        if let Err(e) = play_sound_at_path(&app_handle, path.as_path()) {
            error!("Failed to play sound '{}': {}", path.display(), e);
        }
    });
}

fn play_sound_blocking(app: &AppHandle, path: &Path) {
    if let Err(e) = play_sound_at_path(app, path) {
        error!("Failed to play sound '{}': {}", path.display(), e);
    }
}

fn play_sound_at_path(app: &AppHandle, path: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let settings = settings::get_settings(app);
    let volume = settings.audio_feedback_volume;
    let selected_device = settings.selected_output_device.clone();
    play_audio_file(path, selected_device, volume)
}

fn play_audio_file(
    path: &std::path::Path,
    selected_device: Option<String>,
    volume: f32,
) -> Result<(), Box<dyn std::error::Error>> {
    let sink_builder = if let Some(device_name) = selected_device {
        if device_name == "Default" {
            debug!("Using default device");
            DeviceSinkBuilder::from_default_device()?
        } else {
            let host = crate::audio_toolkit::get_cpal_host();
            let found_device = host
                .output_devices()?
                .find(|device| output_device_name(device).as_deref() == Some(&device_name));

            match found_device {
                Some(device) => DeviceSinkBuilder::from_device(device)?,
                None => {
                    warn!("Device '{}' not found, using default device", device_name);
                    DeviceSinkBuilder::from_default_device()?
                }
            }
        }
    } else {
        debug!("Using default device");
        DeviceSinkBuilder::from_default_device()?
    };

    let device_sink = sink_builder.open_stream()?;
    let mixer = device_sink.mixer();

    let file = File::open(path)?;
    let buf_reader = BufReader::new(file);

    let player = rodio::play(mixer, buf_reader)?;
    player.set_volume(volume);
    player.sleep_until_end();

    Ok(())
}

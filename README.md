# ClearVoice

ClearVoice is an MIT-licensed macOS dictation app based on [Handy](https://github.com/cjpais/Handy). Hold the shortcut to dictate, watch new words appear in a floating preview, and release to paste the finished text once. Press Escape during recording to cancel.

## Set up

1. Open ClearVoice and grant Microphone and Accessibility access when prompted.
2. Download a streaming model during setup. For English, start with **Parakeet Unified English 0.6B**. For other languages, choose a compatible streaming model in Models. A batch-only model shows recording status during dictation and transcribes after release.
3. After setup, hold **Option–Space** in an editable field, speak, and release. You can change the shortcut in Settings.

The default workflow needs an internet connection to download the model once. Dictation then runs locally. The live preview holds partial words inside ClearVoice and sends only the finalized text to the focused app. ClearVoice keeps zero dictation recordings by default. Set a positive history limit in Settings if you want to save them. Optional cloud text processing is off by default.

## Build on macOS

Install Xcode or its command line tools, a recent stable Rust toolchain, Bun, and CMake. From this repository, run:

```sh
bun install --frozen-lockfile
CMAKE_POLICY_VERSION_MINIMUM=3.5 bun run tauri build --bundles app
```

The app bundle is written to `src-tauri/target/release/bundle/macos/ClearVoice.app`. See [BUILD.md](BUILD.md) for upstream build details. Local builds are ad-hoc signed. If you build again, macOS may ask you to grant Accessibility access to the new build.

## Source and licenses

ClearVoice's app code is available under the [MIT license](LICENSE). It builds on Handy v0.10.1 and uses Handy's local speech engine, keyboard handling, and paste pipeline. ClearVoice's branding and live word animation are part of this fork.

The recommended English model is pinned to a [CC BY 4.0 release](https://huggingface.co/handy-computer/parakeet-unified-en-0.6b/tree/7e948f21b7bdbac698d3318db9d350f1096f3b6c). Model files have their own licenses. See the model's license in the [model catalog](src-tauri/src/catalog/catalog.json) and its linked upstream model card before redistribution. Model weights are downloaded separately from the app. ClearVoice does not require an account or a paid service for live dictation.

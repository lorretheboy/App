# `expo-video` patches

### [expo-video+55.0.3+001+catch_play_abort_error.patch](expo-video+55.0.3+001+catch_play_abort_error.patch)

- Reason: When rapidly seeking a video via the progress bar on web, `HTMLVideoElement.play()` returns a Promise that gets rejected with `AbortError` if `pause()` is called before it resolves. This patch wraps all 5 `video.play()` call sites in `VideoPlayer.web.js` with `.catch()` to silently swallow `AbortError` while re-throwing any other errors. This is the [standard fix recommended by Chrome](https://developer.chrome.com/blog/play-request-was-interrupted).

### [expo-video+55.0.3+002+guard_fullscreen_finish_crash.patch](expo-video+55.0.3+002+guard_fullscreen_finish_crash.patch)

- Reason: On Android, `FullscreenPlayerActivity.videoViewId` is a `lateinit var` only assigned in `onCreate` from the launch intent's `VideoManager.INTENT_PLAYER_KEY` extra. If that extra can't be resolved (e.g. Android relaunches the activity in a fresh process after killing the app while the fullscreen player was on top — common on HybridApp Android), `onCreate` bails out early via `finish()` before the assignment runs. The overridden `finish()` then unconditionally reads `videoViewId` for its exit-fullscreen cleanup, throwing `UninitializedPropertyAccessException` (wrapped in the `RuntimeException` seen in Sentry APP-8MA). This patch guards the cleanup in `finish()` with `this::videoViewId.isInitialized` so the early-exit path just closes the activity instead of crashing. Can be dropped when we next upgrade Expo past the version that includes the upstream guard.

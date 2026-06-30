# Voice typing

RoamPilot records short microphone clips in the browser and converts them to
text with Groq `whisper-large-v3-turbo`. The same shared control works for trip
descriptions, planning answers, chat, day changes, and eligible text fields.

## Usage

1. Focus the field you want to fill.
2. Select **Speak** and allow microphone access.
3. Speak naturally for up to 45 seconds.
4. Select **Stop & convert**, or wait for the automatic stop.
5. The transcript is appended to the existing text.

The recording is held in memory, sent through the authenticated server
transcription endpoint, and is not saved by RoamPilot. Each successful
transcription uses one AI credit. Failed requests are refunded by the existing
credit middleware.

## Configuration

```env
GROQ_SPEECH_MODEL=whisper-large-v3-turbo
GROQ_SPEECH_MIN_INTERVAL_MS=3200
```

The server accepts one supported audio file up to 8 MB. The speech endpoint is
limited to 15 requests per minute, below the standard Groq account limit shown
in the dashboard.

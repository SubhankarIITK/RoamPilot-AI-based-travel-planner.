# Voice typing

RoamPilot uses the browser's speech-recognition capability to convert speech
into text. Audio is not uploaded to the RoamPilot server by this feature.

## Where it works

- AI trip description
- AI planning instructions and guided interview answers
- Trip chat
- Day-regeneration instructions
- Every other eligible text input or textarea through the floating microphone

Passwords, dates, numbers, file fields, checkboxes, and other non-text controls
are intentionally excluded.

## Usage

1. Focus the field you want to fill.
2. Select **Speak** or the microphone button.
3. Allow microphone access when the browser requests it.
4. Speak naturally. The transcript is appended to existing text.
5. Select the microphone again to stop.

The recognition language follows the browser/device language. Voice typing
requires browser speech-recognition support and microphone permission. Browsers
that do not expose the capability show a disabled microphone with an
explanation instead of throwing an error.

# SignBridge — Real-Time Sign Language Translator

A browser-based real-time ASL (American Sign Language) finger spelling translator. Point your webcam at hand signs and see them translated to text instantly.

## Features

- **Live webcam capture** with mirrored preview
- **Hand landmark tracking** via MediaPipe Hands (21 points per hand)
- **ASL alphabet recognition** (A–Z) using geometric gesture rules
- **Hold-to-add** — hold a sign steady for ~1 second to append the letter
- **Word suggestions** for common partial words (HI, HELLO, THANK, etc.)
- **Copy & speak** — copy text or use browser speech synthesis
- **ASL reference chart** built into the page

## Quick Start

No build step or install required.

1. Open `index.html` in a modern browser (Chrome, Edge, or Firefox recommended).
2. Click **Start Camera** and allow webcam access.
3. Perform ASL finger spelling signs in front of the camera.
4. Hold each sign steady for about one second to add it to the translated text.

### Local server (optional)

Some browsers restrict camera access on `file://` URLs. If the camera fails, serve the folder locally:

```bash
# Python 3
python -m http.server 8080

# Node.js (npx)
npx serve .
```

Then open `http://localhost:8080` in your browser.

## Tips for Best Results

- Use **good lighting** and a **plain background**
- Keep your **full hand visible** in the frame
- Hold signs **steady** for recognition
- Face the camera directly; avoid extreme angles
- Start with simple letters: **A, B, I, L, V, Y**

## Tech Stack

- HTML5, CSS3, vanilla JavaScript
- [MediaPipe Hands](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker) (CDN)
- Web Speech API for text-to-speech

## Limitations

- Recognizes **ASL finger spelling** (static alphabet signs), not full dynamic signs or other sign languages
- Accuracy depends on lighting, camera quality, and hand positioning
- Letters like **J** and **Z** involve motion and are harder to detect statically
- Requires a webcam and HTTPS or localhost for camera permissions

## File Structure

```
sign-language-translator/
├── index.html    # Main page
├── styles.css    # UI styles
├── app.js        # Hand tracking & ASL classification
└── README.md     # This file
```

## License

MIT — use freely for learning and accessibility projects.

# AI-Powered Real-Time Detection and Prevention of Voice Cloning Impersonation Attacks

## What this prototype does

1. Accepts a WAV voice recording.
2. Converts the audio to a Mel-spectrogram.
3. Uses a CNN classifier to predict REAL or AI-GENERATED.
4. Stores each detection in SQLite.
5. Marks AI-generated detections as BLOCKED and real detections as ALLOWED.
6. Shows detection history in a web dashboard.

## Project structure

voice-cloning-detection/
├── app.py
├── train.py
├── predict.py
├── config.py
├── requirements.txt
├── dataset/
│   ├── real/
│   └── fake/
├── model/
├── preprocessing/
├── database/
├── templates/
├── static/
└── uploads/

## Setup on Windows

Open the project folder in VS Code.

Create and activate a virtual environment:

    python -m venv venv
    venv\Scripts\activate

Install packages:

    pip install -r requirements.txt

Put WAV files into:

    dataset/real/
    dataset/fake/

Train:

    python train.py

This creates:

    model/voice_detector.keras

Start the web application:

    python app.py

This starts Flask, starts the Next.js frontend automatically, and opens:

    http://localhost:3000

## Next.js frontend

The React dashboard lives in `frontend/`. `python app.py` starts both services.
You can also run them separately:

    C:\venvs\voice-detection\Scripts\python.exe app.py
    cd frontend
    npm install
    npm run dev

Open:

    http://localhost:3000

The frontend provides WAV upload, drag-and-drop intake, prediction results,
confidence visualization, and detection history.

## FastAPI and audit ledger

The original Flask service remains available. A parallel FastAPI service is
available for JSON clients:

    venv\Scripts\python.exe -m uvicorn fastapi_app:app --reload --port 8000

Open the API documentation at:

    http://127.0.0.1:8000/docs

Each saved detection is also added to a local SHA-256 hash-linked audit ledger
in SQLite. This provides blockchain-style tamper evidence for the prototype;
it is not a distributed public blockchain. Verify it with:

    http://127.0.0.1:8000/api/audit

## Labels

0 = REAL
1 = AI-GENERATED

## Notes

- The included CNN is a prototype for academic demonstration.
- The model is not guaranteed to detect every voice-cloning system.
- Use a properly separated train/test dataset for meaningful evaluation.
- Do not use the result as the sole factor for high-stakes identity decisions.
- Synthetic voices are blocked at a 98% model probability threshold to reduce
    false positives on human voices.

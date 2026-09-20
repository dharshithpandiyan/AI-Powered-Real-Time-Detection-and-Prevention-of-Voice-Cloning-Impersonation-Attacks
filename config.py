from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent
SAMPLE_RATE = 16000
DURATION = 4
N_MELS = 128
# Require stronger evidence before blocking a voice to reduce false positives.
FAKE_THRESHOLD = 0.98
MODEL_PATH = PROJECT_DIR / "model" / "voice_detector.keras"
DATABASE_PATH = PROJECT_DIR / "voice_detection.db"

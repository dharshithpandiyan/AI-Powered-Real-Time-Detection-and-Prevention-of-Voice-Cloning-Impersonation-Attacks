import librosa
import numpy as np
from config import SAMPLE_RATE, DURATION, N_MELS

def extract_mel_spectrogram(file_path, offset=0.0):
    audio, _ = librosa.load(
        file_path,
        sr=SAMPLE_RATE,
        offset=offset,
        duration=DURATION,
        mono=True
    )

    target_length = SAMPLE_RATE * DURATION

    if len(audio) < target_length:
        audio = np.pad(audio, (0, target_length - len(audio)))
    else:
        audio = audio[:target_length]

    mel = librosa.feature.melspectrogram(
        y=audio,
        sr=SAMPLE_RATE,
        n_mels=N_MELS
    )

    return librosa.power_to_db(mel, ref=np.max)

import numpy as np
import tensorflow as tf
from config import FAKE_THRESHOLD, MODEL_PATH
from preprocessing.audio_features import extract_mel_spectrogram

def predict_voice(file_path):
    if not MODEL_PATH.is_file():
        raise FileNotFoundError(
            f"Model not found at {MODEL_PATH}. "
            "Add WAV files to dataset/real and dataset/fake, then run "
            "'python train.py' before making predictions."
        )

    model = tf.keras.models.load_model(MODEL_PATH)

    feature = extract_mel_spectrogram(file_path)
    feature = feature[np.newaxis, ..., np.newaxis]

    probability = float(model.predict(feature, verbose=0)[0][0])

    if probability >= FAKE_THRESHOLD:
        return "AI-GENERATED", probability * 100
    return "REAL", (1 - probability) * 100

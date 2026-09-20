import os
import numpy as np
import tensorflow as tf
from sklearn.model_selection import train_test_split
from preprocessing.audio_features import extract_mel_spectrogram
from config import MODEL_PATH, PROJECT_DIR

REAL_DIR = PROJECT_DIR / "dataset" / "real"
FAKE_DIR = PROJECT_DIR / "dataset" / "fake"

X, y = [], []

def load_dataset(folder, label):
    if not os.path.isdir(folder):
        print(f"Dataset folder not found: {folder}")
        return

    for filename in os.listdir(folder):
        if filename.lower().endswith(".wav"):
            path = os.path.join(folder, filename)
            try:
                feature = extract_mel_spectrogram(path)
                X.append(feature)
                y.append(label)
            except Exception as exc:
                print("Error:", filename, exc)

print("Loading real voices...")
load_dataset(REAL_DIR, 0)
print("Loading fake voices...")
load_dataset(FAKE_DIR, 1)

if len(X) < 3 or len(set(y)) < 2:
    raise RuntimeError(
        "Add WAV files to dataset/real and dataset/fake before training."
    )

X = np.asarray(X, dtype=np.float32)[..., np.newaxis]
y = np.asarray(y, dtype=np.int32)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

model = tf.keras.Sequential([
    tf.keras.layers.Input(shape=X_train.shape[1:]),
    tf.keras.layers.Conv2D(32, (3, 3), activation="relu"),
    tf.keras.layers.MaxPooling2D((2, 2)),
    tf.keras.layers.Conv2D(64, (3, 3), activation="relu"),
    tf.keras.layers.MaxPooling2D((2, 2)),
    tf.keras.layers.Conv2D(128, (3, 3), activation="relu"),
    tf.keras.layers.MaxPooling2D((2, 2)),
    tf.keras.layers.Flatten(),
    tf.keras.layers.Dense(128, activation="relu"),
    tf.keras.layers.Dropout(0.4),
    tf.keras.layers.Dense(1, activation="sigmoid")
])

model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])
model.summary()

model.fit(
    X_train, y_train,
    epochs=20,
    batch_size=16,
    validation_split=0.2
)

loss, accuracy = model.evaluate(X_test, y_test, verbose=0)
print(f"Test accuracy: {accuracy:.4f}")

MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
model.save(MODEL_PATH)
print(f"Model saved to {MODEL_PATH}")

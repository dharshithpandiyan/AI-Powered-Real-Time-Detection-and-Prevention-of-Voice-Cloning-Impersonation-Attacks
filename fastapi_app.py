import shutil
import uuid
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from config import PROJECT_DIR
from database.database import (
    get_audit_count,
    get_results,
    get_connection,
    init_db,
    save_result,
    verify_audit_chain,
)

app = FastAPI(title="Voxguard Voice Detection API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
UPLOAD_FOLDER = PROJECT_DIR / "uploads"
UPLOAD_FOLDER.mkdir(exist_ok=True)
init_db()

@app.get("/health")
def health():
    return {"status": "ok", "service": "voxguard-fastapi"}

@app.get("/api/history")
def history():
    return [
        {
            "id": row[0],
            "filename": row[1],
            "result": row[2],
            "confidence": row[3],
            "action": row[4],
            "detected_at": row[5],
        }
        for row in get_results()
    ]

@app.get("/api/audit")
def audit_status():
    return {"valid": verify_audit_chain(), "blocks": get_audit_count()}

@app.post("/api/predict")
async def predict(audio: UploadFile = File(...)):
    if not audio.filename or not audio.filename.lower().endswith(".wav"):
        return {"error": "Please upload a WAV file."}

    filename = f"{uuid.uuid4()}.wav"
    filepath = UPLOAD_FOLDER / filename
    with filepath.open("wb") as output:
        shutil.copyfileobj(audio.file, output)

    try:
        from predict import predict_voice
        result, confidence = predict_voice(str(filepath))
    except Exception as exc:
        return {"error": f"Prediction error: {exc}"}

    action = "BLOCKED" if result == "AI-GENERATED" else "ALLOWED"
    save_result(filename, result, confidence, action)
    return {
        "filename": filename,
        "result": result,
        "confidence": round(confidence, 2),
        "action": action,
    }
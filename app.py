import os
import socket
import subprocess
import threading
import time
import uuid
import webbrowser
from flask import Flask, jsonify, render_template, request
from config import PROJECT_DIR
from database.database import init_db, save_result, get_results

app = Flask(__name__)
UPLOAD_FOLDER = PROJECT_DIR / "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

init_db()

@app.after_request
def add_api_cors(response):
    if request.path.startswith("/api/"):
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response

@app.errorhandler(500)
def api_server_error(error):
    if request.path.startswith("/api/"):
        return jsonify(error="Internal server error while processing the request."), 500
    return error

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/predict", methods=["POST"])
def predict():
    if "audio" not in request.files:
        return "No audio uploaded", 400

    audio = request.files["audio"]
    if audio.filename == "":
        return "No file selected", 400

    filename = f"{uuid.uuid4()}.wav"
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    audio.save(filepath)

    try:
        from predict import predict_voice

        result, confidence = predict_voice(filepath)
    except Exception as exc:
        return f"Prediction error: {exc}", 500

    action = "BLOCKED" if result == "AI-GENERATED" else "ALLOWED"
    save_result(filename, result, confidence, action)

    return render_template(
        "result.html",
        result=result,
        confidence=round(confidence, 2),
        action=action
    )

@app.route("/api/predict", methods=["POST"])
def predict_api():
    if "audio" not in request.files:
        return jsonify(error="No audio uploaded"), 400

    audio = request.files["audio"]
    if audio.filename == "":
        return jsonify(error="No file selected"), 400

    filename = f"{uuid.uuid4()}.wav"
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    audio.save(filepath)

    try:
        from predict import predict_voice

        result, confidence = predict_voice(filepath)
    except Exception as exc:
        return jsonify(error=f"Prediction error: {exc}"), 500

    action = "BLOCKED" if result == "AI-GENERATED" else "ALLOWED"
    save_result(filename, result, confidence, action)

    return jsonify(
        filename=filename,
        result=result,
        confidence=round(confidence, 2),
        action=action,
    )

@app.route("/history")
def history():
    return render_template("history.html", records=get_results())

@app.route("/api/history")
def history_api():
    return jsonify([
        {
            "id": row[0],
            "filename": row[1],
            "result": row[2],
            "confidence": row[3],
            "action": row[4],
            "detected_at": row[5],
        }
        for row in get_results()
    ])

FRONTEND_URL = "http://localhost:3000"

def is_port_open(host, port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as connection:
        connection.settimeout(0.5)
        return connection.connect_ex((host, port)) == 0

def start_frontend():
    if is_port_open("127.0.0.1", 3000):
        return None

    frontend_dir = PROJECT_DIR / "frontend"
    npm_command = "npm.cmd" if os.name == "nt" else "npm"
    return subprocess.Popen(
        [npm_command, "run", "dev"],
        cwd=frontend_dir,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
    )

def open_frontend():
    for _ in range(20):
        if is_port_open("127.0.0.1", 3000):
            webbrowser.open(FRONTEND_URL)
            return
        time.sleep(0.5)
    print(f"Frontend did not start automatically. Open {FRONTEND_URL} manually.")

if __name__ == "__main__":
    frontend_process = start_frontend()
    if frontend_process:
        threading.Thread(target=open_frontend, daemon=True).start()
        print(f"Starting Next.js frontend at {FRONTEND_URL}")
    else:
        print(f"Next.js frontend is already running at {FRONTEND_URL}")

    app.run(debug=False, host="127.0.0.1", port=5000, use_reloader=False)

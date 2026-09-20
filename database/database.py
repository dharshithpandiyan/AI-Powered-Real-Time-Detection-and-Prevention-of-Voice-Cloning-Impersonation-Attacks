import sqlite3
import hashlib
import json
from config import DATABASE_PATH

def _block_hash(detection_id, filename, result, confidence, action, previous_hash):
    payload = {
        "detection_id": detection_id,
        "filename": filename,
        "result": result,
        "confidence": confidence,
        "action": action,
        "previous_hash": previous_hash,
    }
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()

def get_connection():
    return sqlite3.connect(DATABASE_PATH)

def init_db():
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS detections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            result TEXT NOT NULL,
            confidence REAL NOT NULL,
            action TEXT NOT NULL,
            detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_blocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            detection_id INTEGER NOT NULL UNIQUE,
            previous_hash TEXT NOT NULL,
            block_hash TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (detection_id) REFERENCES detections(id)
        )
    """)
    cursor.execute("""
        SELECT d.id, d.filename, d.result, d.confidence, d.action
        FROM detections d
        LEFT JOIN audit_blocks a ON a.detection_id = d.id
        WHERE a.detection_id IS NULL
        ORDER BY d.id ASC
    """)
    missing_detections = cursor.fetchall()
    previous = cursor.execute(
        "SELECT block_hash FROM audit_blocks ORDER BY id DESC LIMIT 1"
    ).fetchone()
    previous_hash = previous[0] if previous else "0" * 64
    for detection_id, filename, result, confidence, action in missing_detections:
        block_hash = _block_hash(
            detection_id, filename, result, confidence, action, previous_hash
        )
        cursor.execute("""
            INSERT INTO audit_blocks (detection_id, previous_hash, block_hash)
            VALUES (?, ?, ?)
        """, (detection_id, previous_hash, block_hash))
        previous_hash = block_hash
    connection.commit()
    connection.close()

def save_result(filename, result, confidence, action):
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute("""
        INSERT INTO detections
        (filename, result, confidence, action)
        VALUES (?, ?, ?, ?)
    """, (filename, result, confidence, action))
    detection_id = cursor.lastrowid
    cursor.execute("SELECT block_hash FROM audit_blocks ORDER BY id DESC LIMIT 1")
    previous_hash = cursor.fetchone()
    previous_hash = previous_hash[0] if previous_hash else "0" * 64
    block_hash = _block_hash(
        detection_id, filename, result, confidence, action, previous_hash
    )
    cursor.execute("""
        INSERT INTO audit_blocks (detection_id, previous_hash, block_hash)
        VALUES (?, ?, ?)
    """, (detection_id, previous_hash, block_hash))
    connection.commit()
    connection.close()

def get_results():
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute("""
        SELECT id, filename, result, confidence, action, detected_at
        FROM detections
        ORDER BY id DESC
    """)
    records = cursor.fetchall()
    connection.close()
    return records

def verify_audit_chain():
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute("""
        SELECT a.id, a.detection_id, a.previous_hash, a.block_hash,
               d.filename, d.result, d.confidence, d.action
        FROM audit_blocks a
        JOIN detections d ON d.id = a.detection_id
        ORDER BY a.id ASC
    """)
    blocks = cursor.fetchall()
    connection.close()

    expected_previous = "0" * 64
    for block in blocks:
        _, detection_id, previous_hash, block_hash, filename, result, confidence, action = block
        if previous_hash != expected_previous:
            return False
        expected_hash = _block_hash(
            detection_id, filename, result, confidence, action, previous_hash
        )
        if block_hash != expected_hash:
            return False
        expected_previous = block_hash
    return True

def get_audit_count():
    connection = get_connection()
    count = connection.execute("SELECT COUNT(*) FROM audit_blocks").fetchone()[0]
    connection.close()
    return count

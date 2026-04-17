import pyaudio
import wave
import io
import time
import threading
import math
import json
import requests
from collections import deque
from datetime import datetime, timezone

# --- Firebase Imports ---
import firebase_admin
from firebase_admin import credentials, firestore

# --- Device Identity ---
DEVICE_CONFIG = {
    "device_id": "Mic-01",
    "room": "Living Room"
}

# --- Initialize Firebase ---
DATABASE_ID = "ai-studio-a7054366-0e85-4b5b-885c-d2b3cfaaf6c5"
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client(database_id=DATABASE_ID)

# --- CONFIGURATION ---
API_URL = "https://yamnet-api-237092750208.asia-south1.run.app/predict"
FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 16000
CHUNK = 1024
WINDOW_SIZE = 5
STEP_SIZE = 3
VAD_THRESHOLD = 200

# Buffer
max_chunks = math.ceil((RATE * WINDOW_SIZE) / CHUNK)
audio_buffer = deque(maxlen=max_chunks)

# --- Utility ---
def get_rms(frames):
    import struct
    if not frames:
        return 0
    shorts = struct.unpack("%dh" % (len(frames)//2), frames)
    sum_squares = sum(s**2 for s in shorts)
    return math.sqrt(sum_squares / len(shorts))

def current_iso_time():
    return datetime.now(timezone.utc).isoformat()

# --- NEW: Device Heartbeat ---
def send_heartbeat():
    """Continuously update device status every 30 sec"""
    device_ref = db.collection("devices").document(DEVICE_CONFIG["device_id"])

    while True:
        try:
            device_data = {
                "device_id": DEVICE_CONFIG["device_id"],
                "room": DEVICE_CONFIG["room"],
                "status": "active",
                "last_seen": current_iso_time()
            }

            device_ref.set(device_data, merge=True)
            print(">>> Heartbeat sent")

        except Exception as e:
            print(f"Heartbeat error: {e}")

        time.sleep(30)

# --- Audio Recording ---
def record_audio():
    p = pyaudio.PyAudio()
    stream = p.open(format=FORMAT, channels=CHANNELS, rate=RATE,
                    input=True, frames_per_buffer=CHUNK)

    while True:
        try:
            data = stream.read(CHUNK, exception_on_overflow=False)
            audio_buffer.append(data)
        except:
            continue

# --- MAIN ---
def main():
    # Start threads
    threading.Thread(target=record_audio, daemon=True).start()
    threading.Thread(target=send_heartbeat, daemon=True).start()

    print(f"--- REMOTE SYSTEM ACTIVE ---")
    print(f"Target API: {API_URL}")
    print("Listening... Press Ctrl+C to stop.")

    try:
        while True:
            time.sleep(STEP_SIZE)

            if len(audio_buffer) < max_chunks:
                print(f"Buffering... ({len(audio_buffer)}/{max_chunks})", end="\r")
                continue

            raw_audio_data = b"".join(list(audio_buffer))

            volume = get_rms(raw_audio_data)
            if volume < VAD_THRESHOLD:
                print(f"Skipping silence (Vol: {int(volume)})", end="\r")
                continue

            print(f"\n[Sending 5s Chunk - Vol: {int(volume)}]")

            buffer = io.BytesIO()
            with wave.open(buffer, 'wb') as wf:
                wf.setnchannels(CHANNELS)
                wf.setsampwidth(2)
                wf.setframerate(RATE)
                wf.writeframes(raw_audio_data)

            buffer.seek(0)

            try:
                files = {'file': ('audio.wav', buffer, 'audio/wav')}
                response = requests.post(API_URL, files=files, timeout=10)

                if response.status_code == 200:
                    data = response.json()
                    print("--- API RESPONSE ---")

                    predictions = data.get("predictions", [])
                    if not predictions:
                        print("No predictions found.")
                        continue

                    top_prediction = next(
                        (p for p in predictions if p['label'] != 'Silence'),
                        predictions[0]
                    )

                    label = top_prediction.get("label", "Unknown")
                    confidence = top_prediction.get("confidence", 0.0)

                    alert_data = {
                        "device_id": DEVICE_CONFIG["device_id"],
                        "room": DEVICE_CONFIG["room"],
                        "alert_type": label,
                        "confidence": confidence * 100,
                        "timestamp": firestore.SERVER_TIMESTAMP,
                        "severity": "high" if confidence > 0.8 else "medium"
                    }

                    db.collection("alerts").add(alert_data)
                    print(f">>> Alert synced: {label} ({int(confidence*100)}%)")

                else:
                    print(f"Error: API returned {response.status_code}")

            except Exception as e:
                print(f"Error: {e}")

    except KeyboardInterrupt:
        print("\nStopping Remote Monitor...")

        # Optional: mark device offline on shutdown
        try:
            db.collection("devices").document(DEVICE_CONFIG["device_id"]).set({
                "status": "offline",
                "last_seen": current_iso_time()
            }, merge=True)
        except:
            pass

if __name__ == "__main__":
    main()
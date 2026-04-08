import pyaudio
import wave
import io
import time
import threading
import math
import json
import requests
from collections import deque
# --- NEW: Firebase Imports ---
import firebase_admin
from firebase_admin import credentials, firestore

# --- NEW: Device Identity ---
DEVICE_CONFIG = {
    "device_id": "Mic-01",
    "room": "Living Room"
}

# --- NEW: Initialize Firebase ---
DATABASE_ID = "ai-studio-a7054366-0e85-4b5b-885c-d2b3cfaaf6c5"
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client(database_id=DATABASE_ID)

# ... (keep your existing audio buffer and get_rms code) ...
# --- CONFIGURATION ---
API_URL = "https://yamnet-api-237092750208.asia-south1.run.app/predict" 
FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 16000
CHUNK = 1024
WINDOW_SIZE = 5      # 5-second analysis window
STEP_SIZE = 3     # Send every 3 seconds
VAD_THRESHOLD = 200  # Only send if volume > this (saves bandwidth/API costs)

# Buffer to hold 5 seconds of audio
max_chunks = math.ceil((RATE * WINDOW_SIZE) / CHUNK)
audio_buffer = deque(maxlen=max_chunks)

def get_rms(frames):
    """Simple volume check so we don't spam the API with silence."""
    import struct
    if not frames: return 0
    shorts = struct.unpack("%dh" % (len(frames)/2), frames)
    sum_squares = sum(s**2 for s in shorts)
    return math.sqrt(sum_squares / len(shorts))

def record_audio():
    """Background thread to keep the mic open."""
    p = pyaudio.PyAudio()
    stream = p.open(format=FORMAT, channels=CHANNELS, rate=RATE,
                    input=True, frames_per_buffer=CHUNK)
    while True:
        try:
            data = stream.read(CHUNK, exception_on_overflow=False)
            audio_buffer.append(data)
        except:
            continue

def main():
    # ... (keep your existing thread start code) ...
    # Start the recording thread
    t = threading.Thread(target=record_audio, daemon=True)
    t.start()

    print(f"--- REMOTE SYSTEM ACTIVE ---")
    print(f"Target API: {API_URL}")
    print("Listening... Press Ctrl+C to stop.")

    try:
        while True:
            time.sleep(STEP_SIZE)
            
            # Ensure we have a full 5-second window before sending
            if len(audio_buffer) < max_chunks:
                print(f"Buffering... ({len(audio_buffer)}/{max_chunks})", end="\r")
                continue

            # 1. Capture the 5-second window from memory
            raw_audio_data = b"".join(list(audio_buffer))

            # 2. VAD: Only send if there's actually sound
            volume = get_rms(raw_audio_data)
            if volume < VAD_THRESHOLD:
                print(f"Skipping silence (Vol: {int(volume)})", end="\r")
                continue

            print(f"\n[Sending 5s Chunk - Vol: {int(volume)}]")

            # 3. Create a Virtual .WAV file in RAM using BytesIO
            buffer = io.BytesIO()
            with wave.open(buffer, 'wb') as wf:
                wf.setnchannels(CHANNELS)
                wf.setsampwidth(2) # 16-bit
                wf.setframerate(RATE)
                wf.writeframes(raw_audio_data)
            
            # Reset pointer to the start of the virtual file
            buffer.seek(0)

            # 4. POST the file to your API
            try:
                files = {'file': ('audio.wav', buffer, 'audio/wav')}
                response = requests.post(API_URL, files=files, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    print("--- API RESPONSE ---")
                    
                    # Parse the predictions list
                    predictions = data.get("predictions", [])
                    if not predictions:
                        print("No predictions found.")
                        continue
                        
                    # Logic to pick the best label (ignoring Silence if possible)
                    # We look for the first thing that isn't silence, 
                    # otherwise we just take the top one.
                    top_prediction = next((p for p in predictions if p['label'] != 'Silence'), predictions[0])
                    
                    label = top_prediction.get("label", "Unknown")
                    confidence = top_prediction.get("confidence", 0.0)

                    # Push to Dashboard
                    alert_data = {
                        "device_id": DEVICE_CONFIG["device_id"],
                        "room": DEVICE_CONFIG["room"],
                        "alert_type": label,
                        "confidence": confidence * 100, # Convert 0.72 to 72.0
                        "timestamp": firestore.SERVER_TIMESTAMP,
                        "severity": "high" if confidence > 0.8 else "medium"
                    }
                    
                    db.collection("alerts").add(alert_data)
                    print(f">>> Alert synced: {label} ({int(confidence*100)}%)")

                else:
                    print(f"Error: API returned status {response.status_code}")

            except Exception as e:
                print(f"Error: {e}")

    except KeyboardInterrupt:
        print("\nStopping Remote Monitor...")

if __name__ == "__main__":
    main()
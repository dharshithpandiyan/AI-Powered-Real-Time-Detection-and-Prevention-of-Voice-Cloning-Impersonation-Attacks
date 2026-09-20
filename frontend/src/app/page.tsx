"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import {
  Activity,
  AudioLines,
  Check,
  ChevronRight,
  Clock3,
  FileAudio,
  History,
  LayoutDashboard,
  LoaderCircle,
  Mic,
  ShieldAlert,
  ShieldCheck,
  Square,
  UploadCloud,
  X,
} from "lucide-react";

type Detection = {
  id: number;
  filename: string;
  result: "REAL" | "AI-GENERATED";
  confidence: number;
  action: "ALLOWED" | "BLOCKED";
  detected_at: string;
};

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000";

export default function Home() {
  const [view, setView] = useState<"scan" | "history">("scan");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Detection | null>(null);
  const [records, setRecords] = useState<Detection[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recordingChunksRef = useRef<Float32Array[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const response = await fetch(`${API_BASE}/api/history`);
      if (!response.ok) return;
      const payload = await readApiResponse(response);
      if (Array.isArray(payload)) setRecords(payload);
    } catch {
      // The scan view remains useful while the Flask service is offline.
    }
  }

  function chooseFile(candidate: File | undefined) {
    setError("");
    setResult(null);
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith(".wav")) {
      setError("Please choose a WAV audio file.");
      return;
    }
    if (candidate.size > MAX_FILE_SIZE) {
      setError("That file is larger than the 100 MB upload limit.");
      return;
    }
    setFile(candidate);
  }

  async function startRecording() {
    setError("");
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      recordingChunksRef.current = [];
      processor.onaudioprocess = (event) => {
        recordingChunksRef.current.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(context.destination);
      audioContextRef.current = context;
      mediaStreamRef.current = stream;
      processorRef.current = processor;
      sourceRef.current = source;
      setRecordingSeconds(0);
      setIsRecording(true);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
    } catch {
      setError("Microphone access was unavailable. Allow microphone access or choose a WAV file instead.");
    }
  }

  async function stopRecording() {
    if (!audioContextRef.current) return;
    const context = audioContextRef.current;
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    const samples = mergeAudioChunks(recordingChunksRef.current);
    const wav = encodeWav(samples, context.sampleRate);
    const recordedFile = new File([wav], `microphone-${new Date().toISOString().replace(/[:.]/g, "-")}.wav`, { type: "audio/wav" });
    await context.close();
    audioContextRef.current = null;
    mediaStreamRef.current = null;
    processorRef.current = null;
    sourceRef.current = null;
    recordingChunksRef.current = [];
    setIsRecording(false);
    setFile(recordedFile);
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    chooseFile(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    chooseFile(event.dataTransfer.files[0]);
  }

  async function analyze() {
    if (!file) return;
    setIsLoading(true);
    setError("");
    const body = new FormData();
    body.append("audio", file);

    try {
      const response = await fetch(`${API_BASE}/api/predict`, { method: "POST", body });
      const payload = await readApiResponse(response);
      if (!response.ok) throw new Error(getApiError(payload, response.status));
      if (!isPredictionPayload(payload)) throw new Error("The server returned an invalid prediction response.");
      setResult({ ...payload, id: Date.now(), detected_at: new Date().toISOString() });
      await loadHistory();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Prediction failed.");
    } finally {
      setIsLoading(false);
    }
  }

  const blockedCount = records.filter((record) => record.action === "BLOCKED").length;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><AudioLines size={20} strokeWidth={2.5} /></div>
          <div><strong>Voxguard</strong><span>Integrity console</span></div>
        </div>

        <nav className="side-nav" aria-label="Primary navigation">
          <button className={view === "scan" ? "nav-item active" : "nav-item"} onClick={() => setView("scan")}>
            <LayoutDashboard size={18} /> Scan voice <ChevronRight size={15} className="nav-arrow" />
          </button>
          <button className={view === "history" ? "nav-item active" : "nav-item"} onClick={() => setView("history")}>
            <History size={18} /> Detection history <ChevronRight size={15} className="nav-arrow" />
          </button>
        </nav>

        <div className="sidebar-foot">
          <div className="status-dot"><span /> Engine online</div>
          <small>Prototype classifier<br />v0.1.0 / local</small>
        </div>
      </aside>

      <section className="content-area">
        <header className="topbar">
          <div><span className="eyebrow">Voice security / {view === "scan" ? "Live scan" : "Audit log"}</span><h1>{view === "scan" ? "Analyze a voice" : "Detection history"}</h1></div>
          <div className="topbar-meta"><Activity size={16} /> <span>System ready</span></div>
        </header>

        {view === "scan" ? (
          <div className="workspace-grid">
            <section className="primary-column">
              <div className="intro-copy"><p className="section-kicker">01 / Intake</p><h2>Know who is speaking.</h2><p>Upload a clean WAV recording and let the classifier check it for synthetic voice patterns.</p></div>

              <div className={isDragging ? "drop-zone dragging" : "drop-zone"} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}>
                <input ref={fileInputRef} type="file" accept=".wav,audio/wav" onChange={handleInput} hidden />
                {file ? <div className="file-selected"><div className="file-icon"><FileAudio size={24} /></div><div className="file-copy"><strong>{file.name}</strong><span>{formatBytes(file.size)} · WAV audio</span></div><button className="icon-button" onClick={() => setFile(null)} aria-label="Remove selected file"><X size={18} /></button></div> : <><div className="upload-icon"><UploadCloud size={25} /></div><strong>Drop a voice recording here</strong><span>or <button className="browse-button" onClick={() => fileInputRef.current?.click()}>browse your files</button></span><small>WAV only · up to 100 MB</small></>}
              </div>

              <div className="recording-panel">
                <div className="recording-copy"><span className="section-kicker">Or record live</span><strong>Use your microphone</strong><small>Capture a short voice sample directly in the browser.</small></div>
                {isRecording ? <button className="record-button recording" onClick={stopRecording}><Square size={16} fill="currentColor" /> Stop <span className="recording-time">{formatRecordingTime(recordingSeconds)}</span></button> : <button className="record-button" onClick={startRecording}><Mic size={17} /> Start recording</button>}
              </div>

              {error && <div className="error-message"><ShieldAlert size={17} />{error}</div>}
              <button className="analyze-button" disabled={!file || isLoading} onClick={analyze}>{isLoading ? <><LoaderCircle className="spin" size={18} />Analyzing signal...</> : <><ShieldCheck size={18} />Analyze recording</>}</button>

              {result && <ResultCard result={result} />}
            </section>

            <aside className="insight-column">
              <div className="metric-card dark-card"><div className="metric-label">Scans completed <Activity size={15} /></div><strong>{records.length.toString().padStart(2, "0")}</strong><span>Across this workspace</span></div>
              <div className="metric-card"><div className="metric-label">Threats blocked <ShieldAlert size={15} /></div><strong>{blockedCount.toString().padStart(2, "0")}</strong><span>Potential synthetic voices</span></div>
              <div className="protocol-card"><p className="section-kicker">Detection protocol</p><h3>Signal analysis, made legible.</h3><p>Each recording is normalized to a four-second mono signal, transformed into a Mel-spectrogram, then classified by a convolutional model.</p><div className="protocol-line"><span>01</span><b>Upload</b><span className="line" /><span>02</span><b>Classify</b><span className="line" /><span>03</span><b>Act</b></div></div>
            </aside>
          </div>
        ) : <HistoryTable records={records} onRefresh={loadHistory} />}
      </section>
    </main>
  );
}

function ResultCard({ result }: { result: Detection }) {
  const isBlocked = result.action === "BLOCKED";
  const alternate = 100 - result.confidence;
  const detectedLabel = result.result === "AI-GENERATED" ? "AI-generated" : "Real voice";
  const alternateLabel = result.result === "AI-GENERATED" ? "Real voice" : "AI-generated";
  const chartColors = isBlocked ? "#b84238, #f1d8d2" : "#1e6b4f, #dcebd1";
  return <section className={isBlocked ? "result-card blocked" : "result-card allowed"}><div className="result-heading"><div className="result-icon">{isBlocked ? <ShieldAlert size={22} /> : <Check size={22} />}</div><div><p className="section-kicker">Analysis complete</p><h3>{isBlocked ? "Synthetic voice detected" : "Voice appears genuine"}</h3></div><span className="result-action">{result.action}</span></div><div className="confidence-row"><div><span>Confidence</span><strong>{result.confidence.toFixed(2)}%</strong></div><div className="confidence-track"><span style={{ width: `${result.confidence}%` }} /></div></div><div className="result-chart-row"><div className="pie-chart" style={{ background: `conic-gradient(${chartColors.split(", ")[0]} 0 ${result.confidence}%, ${chartColors.split(", ")[1]} ${result.confidence}% 100%)` }}><div className="pie-hole"><strong>{result.confidence.toFixed(0)}%</strong><span>match</span></div></div><div className="chart-legend"><div><i className={isBlocked ? "legend-swatch blocked-swatch" : "legend-swatch allowed-swatch"} /><span>{detectedLabel}</span><strong>{result.confidence.toFixed(2)}%</strong></div><div><i className="legend-swatch alternate-swatch" /><span>{alternateLabel}</span><strong>{alternate.toFixed(2)}%</strong></div></div></div><p className="result-note">{isBlocked ? "Authentication should be blocked while this signal is reviewed." : "The signal is consistent with a genuine voice. Authentication can continue."}</p></section>;
}

function HistoryTable({ records, onRefresh }: { records: Detection[]; onRefresh: () => void }) {
  return <section className="history-panel"><div className="panel-heading"><div><p className="section-kicker">Audit log</p><h2>Every scan, accounted for.</h2></div><button className="refresh-button" onClick={onRefresh}><Clock3 size={16} /> Refresh</button></div>{records.length === 0 ? <div className="empty-state"><History size={26} /><strong>No detections yet</strong><span>Your analyzed recordings will appear here.</span></div> : <div className="table-wrap"><table><thead><tr><th>Recording</th><th>Result</th><th>Confidence</th><th>Action</th><th>Detected</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td><div className="record-name"><FileAudio size={16} />{record.filename}</div></td><td><span className={record.result === "AI-GENERATED" ? "pill danger-pill" : "pill good-pill"}>{record.result}</span></td><td>{record.confidence.toFixed(2)}%</td><td><span className="action-text">{record.action}</span></td><td>{new Date(record.detected_at).toLocaleString()}</td></tr>)}</tbody></table></div>}</section>;
}

async function readApiResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(response.ok ? "The server returned an invalid response." : `Server error (${response.status}).`);
  }
}

function getApiError(payload: unknown, status: number) {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const error = payload.error;
    if (typeof error === "string") return error;
  }
  return `Server error (${status}). Please check that Flask is running.`;
}

function isPredictionPayload(payload: unknown): payload is Pick<Detection, "filename" | "result" | "confidence" | "action"> {
  if (typeof payload !== "object" || payload === null) return false;
  const value = payload as Record<string, unknown>;
  return typeof value.filename === "string" &&
    (value.result === "REAL" || value.result === "AI-GENERATED") &&
    typeof value.confidence === "number" &&
    (value.action === "ALLOWED" || value.action === "BLOCKED");
}

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function mergeAudioChunks(chunks: Float32Array[]) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const samples = new Float32Array(length);
  let offset = 0;
  chunks.forEach((chunk) => {
    samples.set(chunk, offset);
    offset += chunk.length;
  });
  return samples;
}

function encodeWav(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
}

function formatRecordingTime(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

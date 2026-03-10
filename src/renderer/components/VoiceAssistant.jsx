import React, { useState, useEffect, useRef, useCallback } from 'react';
import './VoiceAssistant.css';

const VoiceAssistant = ({ onTranscript }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, recording, processing, downloading
  const [transcript, setTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [modelStatus, setModelStatus] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const mediaStreamRef = useRef(null);

  // Check if Whisper model is available
  useEffect(() => {
    checkModel();

    // Listen for download progress
    if (window.electronAPI) {
      const cleanup = window.electronAPI.onWhisperDownloadProgress?.((data) => {
        setDownloadProgress(data.progress);
      });
      return cleanup;
    }
  }, []);

  const checkModel = async () => {
    if (!window.electronAPI) return;

    const result = await window.electronAPI.whisperCheckModel();
    setModelStatus(result);

    if (!result.exists || !result.whisperInstalled) {
      setStatus('needs-download');
    }
  };

  const installWhisper = async () => {
    if (!window.electronAPI) return;

    setStatus('installing');
    setTranscript('Installing whisper.cpp...');

    const result = await window.electronAPI.whisperInstallWhisper();

    if (result.success) {
      setTranscript('Whisper installed! Now download a model.');
      // Re-check model status to update whisperInstalled flag
      await checkModel();
      setTimeout(() => {
        setTranscript('');
      }, 2000);
    } else {
      setStatus('error');
      setTranscript(`Installation failed: ${result.error}`);
      setTimeout(() => {
        setStatus('needs-download');
        setTranscript('');
      }, 3000);
    }
  };

  const downloadModel = async (modelSize = 'base') => {
    if (!window.electronAPI) return;

    setStatus('downloading');
    setDownloadProgress(0);

    const result = await window.electronAPI.whisperDownloadModel(modelSize);

    if (result.success) {
      setModelStatus({ exists: true, path: result.path, size: modelSize });
      setStatus('idle');
    } else {
      setStatus('error');
      setTranscript(`Download failed: ${result.error}`);
      setTimeout(() => {
        setStatus('needs-download');
        setTranscript('');
      }, 3000);
    }
  };

  // Audio visualization
  const startAudioVisualization = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      microphone.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;

        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(average / 255); // Normalize to 0-1

        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setTranscript('Microphone access denied');
      setTimeout(() => setTranscript(''), 2000);
    }
  }, []);

  const stopAudioVisualization = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  const startRecording = useCallback(async () => {
    if (!modelStatus?.exists) {
      setStatus('needs-download');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
        }
      });
      mediaStreamRef.current = stream;

      // Try different codecs - prefer PCM if available, fallback to opus
      let options;
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=pcm')) {
        options = { mimeType: 'audio/webm;codecs=pcm' };
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        options = { mimeType: 'audio/wav' };
      } else {
        options = {
          mimeType: 'audio/webm;codecs=opus',
          audioBitsPerSecond: 128000,
        };
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      console.log('[VoiceAssistant] Using codec:', options.mimeType);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('[VoiceAssistant] Audio chunk:', event.data.size, 'bytes');
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: options.mimeType });
        console.log('[VoiceAssistant] Audio blob size:', audioBlob.size, 'bytes, type:', audioBlob.type);
        await processAudio(audioBlob);
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setStatus('recording');
      setTranscript('');
      startAudioVisualization();
    } catch (error) {
      console.error('Error starting recording:', error);
      setTranscript('Failed to start recording');
      setTimeout(() => setTranscript(''), 2000);
    }
  }, [modelStatus, startAudioVisualization]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setStatus('processing');
    stopAudioVisualization();
  }, [stopAudioVisualization]);

  const processAudio = async (audioBlob) => {
    if (!window.electronAPI) {
      setStatus('idle');
      return;
    }

    try {
      // Convert blob to array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      const buffer = Array.from(new Uint8Array(arrayBuffer));

      // Send to main process for transcription
      const result = await window.electronAPI.whisperTranscribeBlob(buffer);

      if (result.success && result.text) {
        setTranscript(result.text);
        onTranscript?.(result.text);

        // Clear transcript after a delay
        setTimeout(() => {
          setTranscript('');
          setStatus('idle');
        }, 3000);
      } else {
        setTranscript(result.error || 'Transcription failed');
        setTimeout(() => {
          setTranscript('');
          setStatus('idle');
        }, 2000);
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      setTranscript('Processing failed');
      setTimeout(() => {
        setTranscript('');
        setStatus('idle');
      }, 2000);
    }
  };

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Keyboard shortcut (Cmd/Ctrl + Shift + V)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        toggleRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleRecording]);

  // Render download prompt if model not available
  if (status === 'needs-download') {
    return (
      <div className="voice-assistant">
        <div className="voice-download-prompt">
          <div className="download-prompt-content">
            <h3>Setup Voice Assistant</h3>
            {!modelStatus?.whisperInstalled ? (
              <>
                <p>First, install whisper.cpp (one-time setup):</p>
                <button onClick={installWhisper} className="model-btn model-recommended">
                  <span className="model-name">Install Whisper.cpp</span>
                  <span className="model-size">~5 minutes</span>
                </button>
                <p style={{ marginTop: '12px', fontSize: '11px', color: 'var(--muted-foreground)' }}>
                  Requires: git, make, and a C++ compiler
                </p>
              </>
            ) : (
              <>
                <p>Choose a model size for offline voice recognition:</p>
                <div className="model-options">
                  <button onClick={() => downloadModel('tiny')} className="model-btn">
                    <span className="model-name">Tiny</span>
                    <span className="model-size">~75MB</span>
                  </button>
                  <button onClick={() => downloadModel('base')} className="model-btn model-recommended">
                    <span className="model-name">Base</span>
                    <span className="model-size">~150MB</span>
                    <span className="model-badge">Recommended</span>
                  </button>
                  <button onClick={() => downloadModel('small')} className="model-btn">
                    <span className="model-name">Small</span>
                    <span className="model-size">~500MB</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (status === 'installing') {
    return (
      <div className="voice-assistant">
        <div className="voice-download-prompt">
          <div className="download-prompt-content">
            <h3>Installing Whisper.cpp...</h3>
            <p>This may take a few minutes. Please wait...</p>
            <div className="installing-spinner">⟳</div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'downloading') {
    return (
      <div className="voice-assistant">
        <div className="voice-download-prompt">
          <div className="download-prompt-content">
            <h3>Downloading Model...</h3>
            <div className="download-progress-bar">
              <div
                className="download-progress-fill"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            <p>{Math.round(downloadProgress)}%</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`voice-assistant ${isRecording ? 'listening' : ''}`}>
      <button
        className="voice-orb"
        onClick={toggleRecording}
        title="Voice Input (Cmd+Shift+V)"
        disabled={status === 'processing'}
      >
        <div className="orb-inner" style={{ transform: `scale(${1 + audioLevel * 0.3})` }}>
          <div className="orb-pulse" style={{ opacity: audioLevel }} />
          <div className="orb-icon">
            {status === 'processing' ? '⟳' : isRecording ? '◉' : '◎'}
          </div>
        </div>
      </button>

      {(isRecording || transcript || status === 'processing') && (
        <div className="voice-transcript">
          <div className="transcript-text">
            {status === 'processing' ? 'Processing...' : transcript || 'Listening...'}
          </div>
        </div>
      )}

      {isRecording && (
        <div className="waveform">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="wave-bar"
              style={{
                height: `${20 + audioLevel * 60 + Math.sin(Date.now() / 100 + i) * 10}%`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default VoiceAssistant;
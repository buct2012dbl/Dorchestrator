const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { exec, spawn } = require('child_process');
const os = require('os');

class WhisperManager {
  constructor() {
    this.modelPath = null;
    this.isDownloading = false;
    this.downloadProgress = 0;
    this.whisperBinary = null;
    this.whisperProcess = null; // Keep process alive for reuse
    this.isProcessing = false;

    // Use project directory in dev, userData in production
    const isDev = !app.isPackaged;
    const baseDir = isDev ? process.cwd() : app.getPath('userData');

    this.whisperDir = path.join(baseDir, 'whisper.cpp');
    this.modelsDir = path.join(baseDir, 'models');
  }

  initialize() {
    console.log('[Whisper] Initializing WhisperManager...');
    console.log('[Whisper] Whisper directory:', this.whisperDir);
    console.log('[Whisper] Models directory:', this.modelsDir);

    // Register IPC handlers
    ipcMain.handle('whisper:checkModel', () => this.checkModel());
    ipcMain.handle('whisper:downloadModel', (event, modelSize) => this.downloadModel(event, modelSize));
    ipcMain.handle('whisper:transcribe', (event, audioPath) => this.transcribe(audioPath));
    ipcMain.handle('whisper:transcribeBlob', (event, audioBuffer) => this.transcribeBlob(audioBuffer));
    ipcMain.handle('whisper:installWhisper', () => this.installWhisper());

    // Check for whisper.cpp binary
    const found = this.findWhisperBinary();
    console.log('[Whisper] Binary found:', found);
  }

  findWhisperBinary() {
    // Check if whisper.cpp is installed
    const possiblePaths = [
      path.join(this.whisperDir, 'build', 'bin', 'whisper-cli'),
      path.join(this.whisperDir, 'build', 'bin', 'main'),
      '/opt/homebrew/bin/whisper-cpp',
      '/usr/local/bin/whisper-cpp',
      path.join(os.homedir(), '.local/bin/whisper-cpp'),
    ];

    for (const binPath of possiblePaths) {
      if (fs.existsSync(binPath)) {
        this.whisperBinary = binPath;
        console.log('[Whisper] Found binary at:', binPath);
        return true;
      }
    }

    console.log('[Whisper] No whisper.cpp binary found.');
    return false;
  }

  async installWhisper() {
    const mainBinary = path.join(this.whisperDir, 'build', 'bin', 'main');

    // Check if already installed
    if (fs.existsSync(mainBinary)) {
      this.whisperBinary = mainBinary;
      console.log('[Whisper] Binary already exists at:', mainBinary);
      return { success: true, message: 'Whisper already installed' };
    }

    return new Promise((resolve) => {
      console.log('[Whisper] Installing whisper.cpp...');

      // If directory exists but binary doesn't, remove it first
      if (fs.existsSync(this.whisperDir)) {
        console.log('[Whisper] Removing incomplete installation...');
        exec(`rm -rf "${this.whisperDir}"`, (err) => {
          if (err) console.error('[Whisper] Failed to remove old directory:', err);
          this.doInstall(mainBinary, resolve);
        });
      } else {
        this.doInstall(mainBinary, resolve);
      }
    });
  }

  doInstall(mainBinary, resolve) {
    const parentDir = path.dirname(this.whisperDir);

    // Ensure parent directory exists
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    const commands = [
      `cd "${parentDir}"`,
      'git clone https://github.com/ggerganov/whisper.cpp.git',
      'cd whisper.cpp',
      'git checkout v1.7.6',
      'cmake -B build',
      'cmake --build build --config Release',
    ].join(' && ');

    // Add common binary paths to PATH for cmake, git, etc.
    const env = {
      ...process.env,
      PATH: `/usr/local/bin:/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}`,
    };

    exec(commands, { maxBuffer: 10 * 1024 * 1024, env }, (error, stdout, stderr) => {
      console.log('[Whisper] Installation stdout:', stdout);
      console.log('[Whisper] Installation stderr:', stderr);

      if (error) {
        console.error('[Whisper] Installation failed:', error);
        console.error('[Whisper] stderr:', stderr);
        resolve({ success: false, error: error.message });
        return;
      }

      // Check for whisper-cli first (new binary name), then fall back to main
      const whisperCli = path.join(this.whisperDir, 'build', 'bin', 'whisper-cli');
      const binaryPath = fs.existsSync(whisperCli) ? whisperCli : mainBinary;

      // Verify the binary was created
      if (fs.existsSync(binaryPath)) {
        this.whisperBinary = binaryPath;
        console.log('[Whisper] Installation complete, binary at:', binaryPath);
        resolve({ success: true, message: 'Whisper installed successfully' });
      } else {
        console.error('[Whisper] Binary not found after compilation at:', binaryPath);
        console.log('[Whisper] stdout:', stdout);
        console.log('[Whisper] stderr:', stderr);
        resolve({ success: false, error: 'Compilation succeeded but binary not found' });
      }
    });
  }

  getModelPath(modelSize = 'base') {
    return path.join(this.modelsDir, `ggml-${modelSize}.bin`);
  }

  checkModel(modelSize = 'base') {
    const modelPath = this.getModelPath(modelSize);
    const exists = fs.existsSync(modelPath);

    if (exists) {
      this.modelPath = modelPath;
    }

    return {
      exists,
      path: modelPath,
      size: modelSize,
      whisperInstalled: this.whisperBinary !== null,
    };
  }

  async downloadModel(event, modelSize = 'base') {
    if (this.isDownloading) {
      return { success: false, error: 'Download already in progress' };
    }

    const modelPath = this.getModelPath(modelSize);
    const modelDir = path.dirname(modelPath);

    // Ensure models directory exists
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
    }

    // Create models directory if it doesn't exist
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
    }

    // Model URLs from Hugging Face
    const modelUrls = {
      tiny: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
      base: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
      small: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
    };

    const url = modelUrls[modelSize];
    if (!url) {
      return { success: false, error: 'Invalid model size' };
    }

    this.isDownloading = true;
    this.downloadProgress = 0;

    return new Promise((resolve) => {
      const file = fs.createWriteStream(modelPath);
      let downloadFailed = false;

      const handleError = (err) => {
        if (downloadFailed) return;
        downloadFailed = true;

        file.close();
        fs.unlink(modelPath, () => {});
        this.isDownloading = false;
        resolve({ success: false, error: err.message });
      };

      https.get(url, (response) => {
        // Handle redirects
        if (response.statusCode === 302 || response.statusCode === 301) {
          https.get(response.headers.location, (redirectResponse) => {
            this.handleDownloadResponse(redirectResponse, file, event, modelPath, resolve, handleError);
          }).on('error', handleError);
        } else {
          this.handleDownloadResponse(response, file, event, modelPath, resolve, handleError);
        }
      }).on('error', handleError);
    });
  }

  handleDownloadResponse(response, file, event, modelPath, resolve, handleError) {
    const totalSize = parseInt(response.headers['content-length'], 10);
    let downloadedSize = 0;

    if (!totalSize || totalSize < 1000000) {
      handleError(new Error('Invalid model file size'));
      return;
    }

    response.on('data', (chunk) => {
      downloadedSize += chunk.length;
      this.downloadProgress = (downloadedSize / totalSize) * 100;

      // Send progress to renderer
      event.sender.send('whisper:downloadProgress', {
        progress: this.downloadProgress,
        downloaded: downloadedSize,
        total: totalSize,
      });
    });

    response.pipe(file);

    file.on('finish', () => {
      file.close();

      // Verify file size
      const stats = fs.statSync(modelPath);
      if (stats.size < 1000000) {
        fs.unlinkSync(modelPath);
        this.isDownloading = false;
        resolve({ success: false, error: 'Downloaded file is too small. Please try again.' });
        return;
      }

      this.isDownloading = false;
      this.modelPath = modelPath;
      console.log('[Whisper] Model downloaded successfully:', modelPath, `(${stats.size} bytes)`);
      resolve({ success: true, path: modelPath });
    });

    response.on('error', handleError);
  }

  async transcribe(audioPath) {
    console.log('[Whisper] Starting transcription for:', audioPath);
    console.log('[Whisper] Model path:', this.modelPath);
    console.log('[Whisper] Binary path:', this.whisperBinary);

    if (!this.modelPath || !fs.existsSync(this.modelPath)) {
      console.error('[Whisper] Model not found at:', this.modelPath);
      return { success: false, error: 'Model not found. Please download a model first.' };
    }

    if (!this.whisperBinary || !fs.existsSync(this.whisperBinary)) {
      console.error('[Whisper] Binary not found at:', this.whisperBinary);
      return { success: false, error: 'Whisper binary not found. Please install whisper.cpp first.' };
    }

    // Convert webm to wav using ffmpeg
    const wavPath = audioPath.replace('.webm', '.wav');
    console.log('[Whisper] Converting audio to WAV format...');
    console.log('[Whisper] Input file:', audioPath);
    console.log('[Whisper] Output file:', wavPath);

    // Check if input file exists
    if (!fs.existsSync(audioPath)) {
      console.error('[Whisper] Input audio file not found:', audioPath);
      return { success: false, error: 'Input audio file not found' };
    }

    const audioStats = fs.statSync(audioPath);
    console.log('[Whisper] Input file size:', audioStats.size, 'bytes');

    return new Promise((resolve) => {
      // First convert to WAV format (16kHz, mono, 16-bit PCM)
      // -y: overwrite output file
      // -loglevel error: only show errors
      // -af "volume=8.0": boost volume significantly
      // Use faster preset for quicker conversion
      const ffmpegCmd = `ffmpeg -y -loglevel error -i "${audioPath}" -ar 16000 -ac 1 -c:a pcm_s16le -af "volume=8.0" -preset ultrafast "${wavPath}"`;

      console.log('[Whisper] Converting audio:', ffmpegCmd);

      // Add common binary paths to PATH for ffmpeg
      const env = {
        ...process.env,
        PATH: `/usr/local/bin:/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}`,
      };

      exec(ffmpegCmd, { env }, (error, stdout, stderr) => {
        console.log('[Whisper] FFmpeg completed');
        if (stdout) console.log('[Whisper] FFmpeg stdout:', stdout);
        if (stderr) console.log('[Whisper] FFmpeg stderr:', stderr);

        if (error) {
          console.error('[Whisper] FFmpeg conversion error:', error);
          console.error('[Whisper] FFmpeg stderr:', stderr);
          console.error('[Whisper] FFmpeg stdout:', stdout);

          // Clean up
          try { fs.unlinkSync(audioPath); } catch (e) {}

          resolve({ success: false, error: 'Audio conversion failed. Please install ffmpeg: brew install ffmpeg' });
          return;
        }

        // Verify WAV file was created and has content
        if (!fs.existsSync(wavPath)) {
          console.error('[Whisper] WAV file not created');
          try { fs.unlinkSync(audioPath); } catch (e) {}
          resolve({ success: false, error: 'Audio conversion failed' });
          return;
        }

        const wavStats = fs.statSync(wavPath);
        console.log('[Whisper] WAV file created:', wavPath, `(${wavStats.size} bytes)`);

        if (wavStats.size < 1000) {
          console.error('[Whisper] WAV file too small');
          try {
            fs.unlinkSync(audioPath);
            fs.unlinkSync(wavPath);
          } catch (e) {}
          resolve({ success: false, error: 'Audio file too short or empty' });
          return;
        }

        // Test: play the audio to verify it has sound
        console.log('[Whisper] Audio files saved for debugging:');
        console.log('[Whisper]   WebM:', audioPath);
        console.log('[Whisper]   WAV:', wavPath);
        console.log('[Whisper] You can play these files to verify audio was captured');

        // Now transcribe with whisper.cpp
        // Use faster settings: fewer threads, single beam for speed
        const args = [
          '-m', this.modelPath,
          '-f', wavPath,
          '-t', '2',              // 2 threads (faster startup)
          '-l', 'en',             // language
          '-otxt',                // output as text
          '--no-speech-thold', '0.01',  // Extremely low threshold
          '--entropy-thold', '2.0',     // Lower entropy threshold
          '--logprob-thold', '-1.0',    // More permissive log probability
          '--max-len', '0',             // No max length limit
          '--word-thold', '0.01',       // Lower word probability threshold
          '-bs', '1',                   // Beam size 1 (greedy decoding, faster)
          '-bo', '1',                   // Best of 1 (no sampling, faster)
        ];

        console.log('[Whisper] Running:', this.whisperBinary, args.join(' '));

        const whisper = spawn(this.whisperBinary, args);
        let output = '';
        let errorOutput = '';

        whisper.stdout.on('data', (data) => {
          const text = data.toString();
          output += text;
          console.log('[Whisper stdout]', text);
        });

        whisper.stderr.on('data', (data) => {
          const text = data.toString();
          errorOutput += text;
          console.log('[Whisper stderr]', text);
        });

        whisper.on('close', (code) => {
          console.log('[Whisper] Process exited with code:', code);
          console.log('[Whisper] Full stdout:', output);
          console.log('[Whisper] Full stderr:', errorOutput);

          // Clean up temp files
          try {
            fs.unlinkSync(audioPath);
            fs.unlinkSync(wavPath);
          } catch (e) {
            console.error('[Whisper] Error cleaning up temp files:', e);
          }

          // Check if text file was created
          const txtPath = wavPath + '.txt';
          if (fs.existsSync(txtPath)) {
            try {
              const text = fs.readFileSync(txtPath, 'utf8').trim();

              // Clean up text file
              try {
                fs.unlinkSync(txtPath);
              } catch (e) {}

              if (text && text.length > 1) {
                console.log('[Whisper] Transcribed text:', text);
                resolve({ success: true, text });
              } else {
                console.error('[Whisper] Text file is empty or too short:', text);
                resolve({ success: false, error: 'No speech detected. Please speak louder and closer to the microphone.' });
              }
            } catch (err) {
              console.error('[Whisper] Error reading text file:', err);
              resolve({ success: false, error: 'Failed to read transcription' });
            }
          } else if (code === 0 || errorOutput.includes('[')) {
            // Fallback: Extract text from stderr output
            const lines = errorOutput.split('\n');
            const transcriptLines = [];

            for (const line of lines) {
              // Match lines that contain transcribed text (after timestamp markers)
              if (line.includes('[') && line.includes(']') && line.includes('-->')) {
                const match = line.match(/\]\s+(.+)$/);
                if (match && match[1].trim()) {
                  transcriptLines.push(match[1].trim());
                }
              }
            }

            const text = transcriptLines.join(' ').trim();

            if (text) {
              console.log('[Whisper] Transcribed text from stderr:', text);
              resolve({ success: true, text });
            } else {
              console.error('[Whisper] No text extracted from output');
              resolve({ success: false, error: 'No speech detected or transcription empty' });
            }
          } else {
            console.error('[Whisper] Transcription failed with code:', code);
            resolve({ success: false, error: 'Transcription failed. Check if model file is valid.' });
          }
        });

        whisper.on('error', (err) => {
          // Clean up temp files
          try {
            fs.unlinkSync(audioPath);
            fs.unlinkSync(wavPath);
          } catch (e) {}

          resolve({ success: false, error: err.message });
        });
      });
    });
  }

  async transcribeBlob(audioBuffer) {
    console.log('[Whisper] transcribeBlob called with buffer size:', audioBuffer.byteLength || audioBuffer.length);

    if (!this.modelPath || !fs.existsSync(this.modelPath)) {
      console.error('[Whisper] Model not found at:', this.modelPath);
      return { success: false, error: 'Model not found. Please download a model first.' };
    }

    // Save audio buffer to temp file
    const tempPath = path.join(os.tmpdir(), `whisper-${Date.now()}.webm`);
    const buffer = Buffer.from(audioBuffer);

    console.log('[Whisper] Saving audio buffer to temp file:', tempPath);
    console.log('[Whisper] Buffer size:', buffer.length, 'bytes');

    try {
      fs.writeFileSync(tempPath, buffer);
      console.log('[Whisper] Audio buffer saved successfully');

      const result = await this.transcribe(tempPath);
      console.log('[Whisper] Transcription result:', result);
      return result;
    } catch (error) {
      console.error('[Whisper] Error saving audio buffer:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = WhisperManager;

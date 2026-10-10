const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const destDir = path.join(rootDir, 'resources', 'ai-runtime', 'llama.cpp');
fs.mkdirSync(destDir, { recursive: true });

const zipUrl = 'https://github.com/ggml-org/llama.cpp/releases/download/b11476/llama-b11476-bin-win-cpu-x64.zip';
const zipPath = path.join(rootDir, 'resources', 'llama-cpu-win-x64.zip');

function download(url, dest, cb) {
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
    if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
      return download(res.headers.location, dest, cb);
    }
    if (res.statusCode !== 200) {
      return cb(new Error('HTTP ' + res.statusCode));
    }
    const file = fs.createWriteStream(dest);
    res.pipe(file);
    file.on('finish', () => file.close(cb));
  }).on('error', cb);
}

console.log('Downloading llama.cpp runtime from GitHub releases...');
download(zipUrl, zipPath, (err) => {
  if (err) {
    console.error('Download error:', err);
    process.exit(1);
  }
  console.log('Downloaded zip (19.4 MB). Extracting...');
  try {
    const psCmd = `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`;
    execSync(psCmd, { stdio: 'inherit' });
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
    console.log('Extraction complete! Files in destination directory:');
    const files = fs.readdirSync(destDir);
    console.log(files);
  } catch(e) {
    console.error('Extraction error:', e);
    process.exit(1);
  }
});

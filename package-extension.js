const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const extensionPkg = require(path.join(__dirname, 'apps', 'extension', 'package.json'));
const version = extensionPkg.version;

const targetObj = {
  source: path.join(__dirname, 'apps', 'extension', 'dist'),
  dest: path.join(__dirname, 'apps', 'web', 'public', 'downloads', `study-assistant-extension-v${version}.zip`)
};

// Ensure downloads directory exists
const downloadsDir = path.dirname(targetObj.dest);
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

const output = fs.createWriteStream(targetObj.dest);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', function() {
  console.log('Successfully zipped extension to ' + targetObj.dest);
  console.log('Bytes: ' + archive.pointer());
  
  // Also create a copy named study-assistant-extension.zip as requested in distribution.ts
  const legacyDest = path.join(downloadsDir, 'study-assistant-extension.zip');
  fs.copyFileSync(targetObj.dest, legacyDest);
  console.log('Successfully copied to legacy destination: ' + legacyDest);
});

archive.on('warning', function(err) {
  if (err.code === 'ENOENT') {
    console.warn(err);
  } else {
    throw err;
  }
});

archive.on('error', function(err) {
  throw err;
});

archive.pipe(output);
archive.directory(targetObj.source, false);
archive.finalize();

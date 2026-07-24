const fs = require('fs');
const path = require('path');

const filesToCopy = ['index.html', 'app_v7.js', 'style.css'];
const distDir = path.join(__dirname, 'dist');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy each file
filesToCopy.forEach(file => {
  const src = path.join(__dirname, file);
  const dest = path.join(distDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Successfully copied ${file} to dist/`);
  } else {
    console.warn(`Warning: Source file ${file} does not exist.`);
  }
});

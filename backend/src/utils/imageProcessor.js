const sharp = require('sharp');
const fs = require('fs');

const RATIOS = {
  square:    { width: 1080, height: 1080 },
  landscape: { width: 1080, height: 608  },
  portrait:  { width: 1080, height: 1350 },
};

/**
 * Crop and resize an image to the specified aspect ratio.
 * Overwrites the original file.
 * @param {string} filePath - Absolute path to the uploaded image
 * @param {string} [crop='square'] - 'square', 'landscape', or 'portrait'
 * @returns {Promise<string>} The file path (same as input)
 */
async function cropImage(filePath, crop = 'square') {
  const size = RATIOS[crop] || RATIOS.square;
  const tempPath = filePath + '.tmp';

  try {
    await sharp(filePath)
      .resize(size.width, size.height, {
        fit: 'cover',
        position: 'center',
        background: { r: 255, g: 255, b: 255 },
      })
      .toFile(tempPath);

    // Replace original with processed version
    fs.unlinkSync(filePath);
    fs.renameSync(tempPath, filePath);

    return filePath;
  } catch (err) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    console.error('Image processing failed, keeping original:', err.message);
    return filePath;
  }
}

module.exports = { cropImage };

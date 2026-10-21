import path from 'node:path';
import tesseract from 'tesseract.js';
const { recognize } = tesseract;
process.once('message', async ({ image }) => {
  try {
    const result = await recognize(Buffer.from(image, 'base64'), 'eng', {
      workerPath: path.join(process.cwd(), 'node_modules/tesseract.js/src/worker-script/node/index.js'),
      langPath: path.join(process.cwd(), 'node_modules/@tesseract.js-data/eng/4.0.0'),
      gzip: true, cacheMethod: 'none',
    });
    process.send({ text: result.data.text.slice(0, 8000), confidence: result.data.confidence }, () => process.exit(0));
  } catch { process.exit(1); }
});

import { runRefresh } from '../src/pipeline.js';

const edition = await runRefresh();
console.log(`\nDone. Edition ${edition.id} written to ${process.env.DATA_DIR || 'data'}/editions/${edition.id}.json`);

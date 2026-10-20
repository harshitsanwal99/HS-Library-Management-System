const app = require('../backend/server');
const db = require('../backend/db');

let initPromise = null;

module.exports = async (req, res) => {
    if (!initPromise) {
        initPromise = db.initDatabase().catch(err => {
            console.error('[Vercel Serverless] DB init error:', err);
            initPromise = null;
        });
    }
    await initPromise;
    return app(req, res);
};

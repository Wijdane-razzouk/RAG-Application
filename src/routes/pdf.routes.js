import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlRoutes = express.Router();

htmlRoutes.get('/', async (req, res) => {
    res.sendFile(path.resolve(__dirname, "../../public/index.html"));
});

export default htmlRoutes;
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({status: 'ok', env: process.env.NODE_ENV});
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Fiora backend in ascolto su http://localhost:${PORT}`);
});
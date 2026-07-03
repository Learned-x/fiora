import dotenv from 'dotenv';
dotenv.config();

// If TypeScript reports: "Cannot find module './app' or its corresponding type declarations",
// ignore the error here while ensuring the runtime import works.
// @ts-ignore
import app from './app';
import { connectMqtt } from './lib/mqtt';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Fiora backend in ascolto su http://localhost:${PORT}`);
  connectMqtt();
});
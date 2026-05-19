/**
 * Zakat Calculator — App Manifest
 */
import { handler } from './handler.js';

const manifest = {
  id: 'zakat-calculator',
  name: 'Kalkulator Zakat',
  description: 'Hitung zakat mal dengan mudah. Ketik !zakat <jumlah harta> dan bot langsung hitung beserta penjelasannya.',
  icon: '💰',
  color: '#f59e0b',
  category: 'Islami',
  version: '1.0.0',
  author: 'SISIA Team',

  trigger: {
    type: 'KEYWORD',
    value: '!zakat',
  },

  requiresApiKey: false,  // Bisa jalan tanpa API Key (AI explain opsional)
  showProcessing: false,  // Langsung balas, tidak perlu typing indicator

  handler,
};

export default manifest;

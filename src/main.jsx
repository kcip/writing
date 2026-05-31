import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../essay-classroom.jsx';

// Mock window.storage using localStorage (mirrors the expected API)
window.storage = {
  get: async (key) => {
    const value = localStorage.getItem(key);
    return value !== null ? { value } : null;
  },
  set: async (key, value) => {
    localStorage.setItem(key, value);
  },
  delete: async (key) => {
    localStorage.removeItem(key);
  },
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

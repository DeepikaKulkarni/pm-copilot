/**
 * API client for communicating with the FastAPI backend.
 * All requests go through the Vite dev proxy (/api → http://localhost:8000/api).
 */
import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000, // 2 min — LLM calls with RAG retrieval can be slow
  headers: { 'Content-Type': 'application/json' },
});

// ── Chat & suggestions ──────────────────────────────────────────────────────

export const chatApi = {
  // Runs the full LangGraph pipeline: supervisor → specialist agent → guardrails
  sendMessage: async (query, architectureContext = null, conversationHistory = []) => {
    const res = await api.post('/chat', {
      query,
      architecture_context: architectureContext,
      conversation_history: conversationHistory,
    });
    return res.data;
  },

  // Returns context-aware starter questions (different when arch context is loaded)
  getSuggestedQuestions: async () => {
    const res = await api.get('/suggested-questions');
    return res.data.questions;
  },

  getCountries: async () => {
    const res = await api.get('/countries');
    return res.data.countries;
  },

  getModels: async () => {
    const res = await api.get('/models');
    return res.data.models;
  },
};

// ── Architecture context ────────────────────────────────────────────────────
// The backend holds one global context string; all subsequent chat calls use it.

export const contextApi = {
  setContext: async (context) => {
    const res = await api.post('/context', { context });
    return res.data;
  },

  getContext: async () => {
    const res = await api.get('/context');
    return res.data;
  },

  clearContext: async () => {
    const res = await api.delete('/context');
    return res.data;
  },
};

// ── Conversation memory ─────────────────────────────────────────────────────

export const conversationApi = {
  getHistory: async () => {
    const res = await api.get('/conversation/history');
    return res.data.history;
  },

  clear: async () => {
    const res = await api.delete('/conversation/clear');
    return res.data;
  },
};

// ── Response feedback ───────────────────────────────────────────────────────

export const feedbackApi = {
  submit: async (liked, query, agent) => {
    const res = await api.post('/feedback', { liked, query, agent });
    return res.data;
  },
};

// ── File upload ─────────────────────────────────────────────────────────────
// Uses raw axios (not the shared instance) so multipart/form-data isn't overridden.

export const uploadApi = {
  upload: async (file) => {
    const form = new FormData();
    form.append('file', file);
    const res = await axios.post('/api/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    });
    return res.data;
  },
};

// ── Session metrics ─────────────────────────────────────────────────────────

export const metricsApi = {
  get: async () => {
    const res = await api.get('/metrics');
    return res.data;
  },
};

export default api;

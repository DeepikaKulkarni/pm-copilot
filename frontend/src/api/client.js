/**
 * API client for communicating with the FastAPI backend.
 */
import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000, // 2 min timeout for LLM calls
  headers: { 'Content-Type': 'application/json' },
});

export const chatApi = {
  sendMessage: async (query, architectureContext = null, conversationHistory = []) => {
    const res = await api.post('/chat', {
      query,
      architecture_context: architectureContext,
      conversation_history: conversationHistory,
    });
    return res.data;
  },

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

export default api;

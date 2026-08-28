import client from './client';

export const consultAIApi = (pet_id, user_query) => 
  client.post('/ai/consult', { pet_id, user_query });

export const getAIHistoryApi = (pet_id) => 
  client.get(`/ai/history/${pet_id}`);
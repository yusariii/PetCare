import client from './client';

export const createDocumentApi = (payload) => client.post('/documents', payload);

export const listDocumentsApi = () => client.get('/documents');

export const updateDocumentApi = (id, payload) => client.put(`/documents/${id}`, payload);

export const deleteDocumentApi = (id) => client.delete(`/documents/${id}`);

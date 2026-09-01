import client from './client';

/**
 * Get all clinic rooms with services
 */
export const getRoomsApi = async () => {
  return client.get('/rooms');
};

/**
 * Get room availability for a specific date
 */
export const getRoomAvailabilityApi = async (roomId, date) => {
  return client.get(`/rooms/${roomId}/availability`, {
    params: { date }
  });
};

/**
 * Get services for a specific room
 */
export const getRoomServicesApi = async (roomId) => {
  return client.get(`/rooms/${roomId}/services`);
};

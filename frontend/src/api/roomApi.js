import client from './client';

/**
 * Get all clinic rooms with services
 */
export const getRoomsApi = async () => {
  return client.get('/rooms');
};

/**
 * BR08: Get live occupancy status for all rooms
 */
export const getLiveRoomsOccupancyApi = async () => {
  return client.get('/rooms/live-occupancy');
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

/**
 * Get the clinic room assigned to the signed-in doctor
 */
export const getMyRoomApi = async () => {
  return client.get('/rooms/my-room');
};

/**
 * Create a clinic room (admin only)
 */
export const createRoomApi = async (payload) => {
  return client.post('/rooms', payload);
};

/**
 * Update a clinic room (admin only)
 */
export const updateRoomApi = async (roomId, payload) => {
  return client.put(`/rooms/${roomId}`, payload);
};

/**
 * Assign (or unassign with doctor_id: null) the doctor responsible for a room (admin only)
 */
export const assignDoctorToRoomApi = async (roomId, doctorId) => {
  return client.patch(`/rooms/${roomId}/assign-doctor`, { doctor_id: doctorId });
};

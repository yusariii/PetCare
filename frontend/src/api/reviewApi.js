import client from './client';

/**
 * Create a review for a completed appointment (customer only)
 */
export const createReviewApi = (payload) => client.post('/reviews', payload);

/**
 * List reviews (doctor: own room; admin: all)
 */
export const listReviewsApi = () => client.get('/reviews');

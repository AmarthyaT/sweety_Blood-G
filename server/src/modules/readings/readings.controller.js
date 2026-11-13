import asyncHandler from '../../utils/asyncHandler.js';
import {
  createReading,
  deleteReading,
  listReadings,
  updateReading,
} from './readings.service.js';

export const index = asyncHandler(async (req, res) => {
  const result = await listReadings(req.user.id, req.query);
  res.json(result);
});

export const create = asyncHandler(async (req, res) => {
  const reading = await createReading(req.user.id, req.body);
  res.status(201).json({ reading });
});

export const update = asyncHandler(async (req, res) => {
  const reading = await updateReading(req.user.id, req.params.id, req.body);
  res.json({ reading });
});

export const destroy = asyncHandler(async (req, res) => {
  await deleteReading(req.user.id, req.params.id);
  res.status(204).send();
});

import asyncHandler from '../../utils/asyncHandler.js';
import { getReport } from './reports.service.js';

export const show = asyncHandler(async (req, res) => {
  const report = await getReport({
    userId: req.user.id,
    type: req.query.type,
    date: req.query.date,
  });
  res.json({ report });
});

import asyncHandler from '../../utils/asyncHandler.js';
import { assignPatient, getPatientReport, listPatients } from './doctor.service.js';

export const indexPatients = asyncHandler(async (req, res) => {
  const patients = await listPatients(req.user.id);
  res.json({ patients });
});

export const createAssignment = asyncHandler(async (req, res) => {
  const patient = await assignPatient(req.user.id, req.body?.email);
  res.status(201).json({ patient });
});

export const showPatientReport = asyncHandler(async (req, res) => {
  const result = await getPatientReport(req.user.id, req.params.patientId, {
    type: req.query.type,
    date: req.query.date,
  });
  res.json(result);
});

import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { createAssignment, indexPatients, showPatientReport } from './doctor.controller.js';

const router = Router();

router.use(requireAuth, requireRole('doctor'));

router.get('/patients', indexPatients);
router.post('/patients', createAssignment);
router.get('/patients/:patientId/reports', showPatientReport);

export default router;

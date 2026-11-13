import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { show } from './reports.controller.js';

const router = Router();

router.get('/', requireAuth, show);

export default router;

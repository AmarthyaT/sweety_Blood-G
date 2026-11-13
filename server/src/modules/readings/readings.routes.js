import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { create, destroy, index, update } from './readings.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', index);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', destroy);

export default router;

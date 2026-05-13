import {Router} from 'express'
import {create, getAll, getOne} from '../controllers/tournamentController.js'
import {authenticate} from '../middleware/auth.middleware.js'

const router=Router();

router.post('/', authenticate, create);
router.get('/', getAll);
router.get('/:id', getOne);       // :id becomes req.params.id

export default router;

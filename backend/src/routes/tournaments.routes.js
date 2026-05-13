import {Router} from 'express'
import {create,getAll} from '../controllers/tournamentController.js'
import {authenticate} from '../middleware/auth.middleware.js'

const router=Router();

router.post('/',authenticate,create);
router.get('/',getAll)

export default router;

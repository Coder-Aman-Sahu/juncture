import { Router } from "express"; // <--- This line was missing
import { 
    addToHistory, 
    getUserHistory, 
    login, 
    register, 
    generateTurnCredentials 
} from "../controllers/user.controller.js";

const router = Router();   

router.route("/login").post(login);
router.route("/register").post(register);
router.route("/add_to_activity").post(addToHistory);
router.route("/get_all_activity").get(getUserHistory);
router.route("/get_turn_credentials").get(generateTurnCredentials);

export default router;
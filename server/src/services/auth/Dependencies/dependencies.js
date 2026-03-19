import { authController } from "../controller/authContoller.js";
import { AuthService } from "../service/AuthService.js";
import MongoUserRepository  from "../repository/UserRepository.js"

class Container{
    static init() {
        // Initialize repositories
        const repositories = {
            userRepository: MongoUserRepository
        };

        // Initialize services with their respective repositories
        const services = {
            authService: new AuthService(repositories.userRepository)
        };

        // Initialize controllers with their respective services
        const controller = {
            authController: new authController(services.authService)
        }

        return {
            repositories, services, controller
        }
    }
}

const initialized = Container.init();
export { Container };
export default initialized

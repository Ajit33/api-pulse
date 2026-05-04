import ClientRespository from "../../client/repository/ClientRespository.js"
import processorContainer from "../../processor/Dependency/dependencies.js";
import authContainer from "../../auth/Dependencies/dependencies.js";


import {AnalyticsService} from "../services/analyticServices.js";
import { AnalyticsController } from "../controller/analyticsController.js";

class Container {
    static init(){
        const repositories ={
             ClientRespository,
             metricsRepository: processorContainer.repositories.MetricsRepository
        };
        const analyticsService = new AnalyticsService(repositories.metricsRepository);
        

        const services={
            analyticsService,
            authService: authContainer.services && authContainer.services.authService,
        };
        const analyticsController = new AnalyticsController({
            analyticsService: services.analyticsService,
            authService: services.authService,
            clientRepository: repositories.ClientRespository,
        });

        const controllers = {
            analyticsController,
        };

        return { repositories, services, controllers };
    }
}

const initialized = Container.init();
export { Container };
export default initialized;
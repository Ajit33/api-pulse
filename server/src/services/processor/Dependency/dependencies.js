import ApiHit from "../../../shared/models/apihits.js";
import { ApiHitRepository } from "../Repository/ApiHitRepository.js";
import { MetricsRepository } from "../Repository/MetricsRepository.js";
import { ProcesserService } from "../Service/ProcesserService.js";
import logger from "../../../shared/config/logger.js";
import postgres from "../../../shared/config/postgres.js";

class Container {
    static init(){
        const repositories= {
            ApiHitRepository: new ApiHitRepository({model:ApiHit , logger}),
            MetricsRepository: new MetricsRepository({logger, postgres})
        };
      const services={
        processorService : new ProcesserService(repositories)
      }  
      return {repositories,services}
    }
}

const initialized= Container.init();
export {Container};

export default initialized;
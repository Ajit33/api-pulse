import { ApiHitRepository } from "../Repository/ApiHitRepository";
import { MetricsRepository } from "../Repository/MetricsRepository";
import { ProcesserService } from "../Service/ProcesserService";


class Container {
    static init(){
        const repositories= {
            apiHitRepository: new ApiHitRepository({model: ApiHitRepository, logger}),
            metricsRepository: new MetricsRepository({logger, postgres})
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
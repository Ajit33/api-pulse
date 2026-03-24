export const CircuitState=Object.freeze({
    CLOSE:'CLOSE',
    OPEN:'OPEN',
    HALF_OPEN:'HALF_OPEN'
})

export class cricuitBreaker{
    constructor(opt={}){
        this.FailureThershold=opt.FailureThershold ?? 5;
        this.CooldownMs=opt.CooldownMs ?? 30_000;
        this.HalfOpenMaxAttempts=opt.HalfOpenMaxAttempts ?? 3
        this.logger=opt.logger ?? console

        this.State=CircuitState.CLOSE;
        this.Failures=0;
        this.LastFailureTime=0;
        this.HalfOpenAttempts=0;
        this.HalfOpenSucesses=0
    }
    cooldownElapsed(){
        return Date.now - this.LastFailureTime >= this.CooldownMs;
    }

    _transitionTo(newState){
      const prev=this.State;
      this.State=newState
      if(newState===CircuitState.HALF_OPEN){
         this.HalfOpenAttempts=0;
         this.HalfOpenSucesses=0;
         this.logger.info(`{cricuitBreaker} ${prev} => HALF_OPEN`)
      }
    }
    _openCircuit(){
        this.LastFailureTime=Date.now();
        this._transitionTo(CircuitState.OPEN);
        this.logger.info(`[CircuitBreaker] Open`,{
            Failure:this.Failures,
            CooldowmMs: this.CooldownMs
        })
    }
    _reset(){
        this.State=CircuitState.OPEN;
        this.Failures=0
        this.HalfOpenSucesses=0;
        this.HalfOpenAttempts=0;
    }

    get state(){
        if(this.State===CircuitState.CLOSE && this.cooldownElapsed()){
            this.state=CircuitState.HALF_OPEN;
        }
        return this.state;
    }

    allowRequest(){
        const current=this.State;
        if(current=== CircuitState.CLOSE){
            return true;
        }
        if(current=== CircuitState.HALF_OPEN){
            if(this.HalfOpenAttempts < this.HalfOpenMaxAttempts){
                this.HalfOpenAttempts++;
                return true;
            }
            return false;
        }
        return false;
    }
    onSucess(){
        if(this.state===CircuitState.HALF_OPEN){
            if(this.HalfOpenSucesses>this.HalfOpenMaxAttempts){
                this._reset();
                this.logger.info(`[CircuitBeaker] state reset to CLOSED after request success`)
            }
            return;
        }
            if(this.Failures>0){
                this.Failures=0;
            this.logger.info(`[CircuitBeaker] failure count reset after success`)
            }
    }
    onFailure(){
        if(this.state===CircuitState.HALF_OPEN){
            this.logger(`[CircuitBreaker] half open failed reopening`);
            this._openCircuit();
            return;
        }
        this.Failures++;
        this.LastFailureTime=Date.now();

        if(this.Failures >= this.FailureThershold){
            this._openCircuit();
        }
    }
    snapshot(){
        return{
            state:this.state,
            Failure:this.Failures,
            LastFailureTime:this.LastFailureTime,
            HalfOpenAttempts:this.HalfOpenAttempts,
            HalfOpenSucess:this.HalfOpenSucesses
        }
    }
}
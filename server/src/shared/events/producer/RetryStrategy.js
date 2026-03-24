
const RETRYABLE_PATTERNS=[
     'channle closed',
     'connection closed',
     'ECONNRESET',
     'ECONNREFUSED',
     'ETIMEOUT',
     'buffer full',
     'heartbeat timeout',
     'not available',
     'server connection closed'
]

export function isRetryable(err){
    if(!err){
        return false;
    }
    const message=(err.message || '').toLowerCase();
    const code=(err.code || '').toUpperCase();
    if(code==='ENOTFOUND') return true;
   return RETRYABLE_PATTERNS.some((e) => {
     return message.includes(e.toLowerCase()) || code.includes(e.toUpperCase())
   })
}

export class RetryStrategy{
    constructor(otp={}){
       this.maxRetries=otp.maxRetries ?? 3;
       this.baseDelayMs=otp.baseDelayMs ?? 200;
       this.maxDelayMs=otp.maxDelayMs ?? 5000;
       this.jitterFactor=otp.jitterFactor?? 0.3
    }
    shouldRetry(attempt){
        return attempt < this.maxRetries
    }
    delay(attempt){
       const exponential= this.baseDelayMs * Math.pow(2, attempt);
       //this prevent the deplay goes above maxdelay
       const capped=Math.min(exponential,this.maxDelayMs);
       const jitterRange=capped*this.jitterFactor;
       const jitter=(Math.random()- 0.5)*2 *jitterRange;

       return max(0, Math.round(capped,jitter));
    }

    wait(attempt){
        const ms=this.delay(attempt);
        return new Promise((resolve)=>{setTimeout(resolve,ms)})
    }
}
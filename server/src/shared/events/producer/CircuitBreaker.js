export const CircuitState=Object.freeze({
    CLOSE:'CLOSE',
    OPEN:'OPEN',
    HALF_OPEN:'HALF_OPEN'
})

export class CircuitBreaker {
    constructor({ failureThreshold = 5, cooldownMs = 10000, halfOpenMaxAttempts = 2, logger }) {
        this.failureThreshold = failureThreshold;
        this.cooldownMs = cooldownMs;
        this.halfOpenMaxAttempts = halfOpenMaxAttempts;
        this.logger = logger ?? console;

        this._state = "CLOSED";   // CLOSED | OPEN | HALF_OPEN
        this._failures = 0;
        this._lastFailureTime = null;
        this._halfOpenAttempts = 0;
    }

    allowRequest() {
        if (this._state === "OPEN") {
            if (this.cooldownElapsed()) {
                this._state = "HALF_OPEN";
                this._halfOpenAttempts = 0;
                return true;
            }
            return false;
        }

        if (this._state === "HALF_OPEN") {
            return this._halfOpenAttempts < this.halfOpenMaxAttempts;
        }

        return true;
    }

    onSuccess() {
        this._failures = 0;

        if (this._state === "HALF_OPEN") {
            this._state = "CLOSED";
        }
    }

    onFailure() {
        this._failures++;
        this._lastFailureTime = Date.now();

        if (this._state === "HALF_OPEN") {
            this._state = "OPEN";
            return;
        }

        if (this._failures >= this.failureThreshold) {
            this._state = "OPEN";
        }
    }

    cooldownElapsed() {
        if (!this._lastFailureTime) return true;
        return Date.now() - this._lastFailureTime > this.cooldownMs;
    }

    get state() {
        // ❗ IMPORTANT: NEVER use this.state inside here
        if (this._state === "OPEN" && this.cooldownElapsed()) {
            this._state = "HALF_OPEN";
        }
        return this._state;
    }

    snapshot() {
        return {
            state: this._state,
            failures: this._failures,
        };
    }
}
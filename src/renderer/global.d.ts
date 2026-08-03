import type { PulseCastBridge } from "../shared/contracts";

declare global {
  interface Window {
    pulsecast?: PulseCastBridge;
  }
}

export {};

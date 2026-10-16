import type { DeviceInfo, SessionState } from "../Shapes/common.js";
import { randomDevice } from "../../Pinth/devices.js";
import type { DeviceProfile } from "../../Pinth/devices.js";

export function deviceOf(state: SessionState): DeviceInfo {
  if (state.device === undefined) {
    const fresh: DeviceProfile = randomDevice();
    state.device = {
      agent: fresh.agent,
      acceptLanguage: fresh.acceptLanguage,
      secChUa: fresh.secChUa,
      secChUaMobile: fresh.secChUaMobile,
      secChUaPlatform: fresh.secChUaPlatform,
    };
  }
  return state.device;
}

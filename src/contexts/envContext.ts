import type { Env } from "@app/lib/types/env";
import { createContext } from "react";

export interface EnvContextType {
    env: Env;
}

const EnvContext = createContext<EnvContextType | undefined>(undefined);

export default EnvContext;

import { GetRemoteExitNodeResponse } from "#private/routers/remoteExitNode";
import { createContext } from "react";

type RemoteExitNodeContextType = {
    remoteExitNode: GetRemoteExitNodeResponse;
    updateRemoteExitNode: (updatedRemoteExitNode: Partial<GetRemoteExitNodeResponse>) => void;
};

const RemoteExitNodeContext = createContext<RemoteExitNodeContextType | undefined>(undefined);

export default RemoteExitNodeContext;

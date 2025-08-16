import { GetResourceAuthInfoResponse } from "@server/routers/resource";
import { GetResourceResponse } from "@server/routers/resource/getResource";
import { createContext } from "react";

interface ResourceContextType {
    resource: GetResourceResponse;
    authInfo: GetResourceAuthInfoResponse;
    updateResource: (updatedResource: Partial<GetResourceResponse>) => void;
    updateAuthInfo: (
        updatedAuthInfo: Partial<GetResourceAuthInfoResponse>
    ) => void;
}

const ResourceContext = createContext<ResourceContextType | undefined>(
    undefined
);

export default ResourceContext;

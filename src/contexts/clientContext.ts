import { GetClientResponse } from "@server/routers/client/getClient";
import { createContext } from "react";

interface ClientContextType {
    client: GetClientResponse;
    updateClient: (updatedClient: Partial<GetClientResponse>) => void;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export default ClientContext;

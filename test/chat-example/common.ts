import {
    ServerDefinition,
    SimpleNamespace,
    ServerNamespace,
    RootServer,
    ClientSideSocket,
} from "../..";

type ChatMessage = {
    sender: string;
    message: string;
    channel: "en" | "ru";
};
export interface MyServerDefinition extends ServerDefinition {
    namespaces: {
        "/chat": SimpleNamespace<{
            // messages the server may send to the clients
            ServerMessages: {
                chatMessage: ChatMessage;
                history: ChatMessage[];
            };
            // messages clients can send to the server, with a typed response
            ClientRPCs: {
                postMessage: {
                    request: { message: string; channel: "en" | "ru" };
                    response: "ok";
                    error: string;
                };
            };
            // messages clients can send to the server (without a response)
            ClientMessages: {};
        }>;
        // ...
    };
}

export type TypedServer = RootServer<MyServerDefinition>;
export type TypedChatClient = ClientSideSocket<MyServerDefinition, "/chat">;

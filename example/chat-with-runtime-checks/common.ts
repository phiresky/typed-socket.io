/**
 * common code that can be imported from server code and client code
 */
import { NeededInfoFor, ToCompiletime } from "../../TypedServer";
import { ChatMessage } from "../basic-chat/common";
import {
    ServerSideClientSocket,
    RootServer,
    ServerDefinition,
    SimpleNamespace,
} from "../../typedSocket";
import * as t from "io-ts";
export { ChatMessage };
const unchecked = <T>() => t.any as t.Type<T>;

export const runtimeSchema = {
    // messages the server may send to the clients
    // since we generally trust the server, these are unchecked
    ServerMessages: {
        chatMessage: unchecked<ChatMessage>(),
        history: unchecked<ChatMessage[]>(),
    },
    // messages clients can send to the server, with a typed response
    // these are checked at runtime
    ClientRPCs: {
        postMessage: {
            request: t.strict({
                message: t.string,
                channel: t.union([t.literal("en"), t.literal("ru")]),
            }),
            response: unchecked<"ok">(),
        },
    },
    // messages clients can send to the server (without a response)
    ClientMessages: {},
};

export type ChatNamespace = SimpleNamespace<
    ToCompiletime<typeof runtimeSchema>
>;

// a socket.io server may contain multiple namespaces, but we only have one here (/chat)
export interface MyServerDefinition extends ServerDefinition {
    namespaces: {
        "/chat": ChatNamespace;
    };
}

export type ChatServerInfo = NeededInfoFor<MyServerDefinition, "/chat">;
export type ChatSocket = ServerSideClientSocket<MyServerDefinition, "/chat">;

export type RPCs = ChatServerInfo["NamespaceSchema"]["ClientRPCs"];
export type Req<K extends keyof RPCs> = RPCs[K]["request"];
export type Res<K extends keyof RPCs> = RPCs[K]["response"];
export type MyRootServer = RootServer<ServerDefinition>;

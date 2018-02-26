/**
 * common code that can be imported from server code and client code
 */
import { NeededInfoFor, ToCompiletime } from "../../TypedServer";
import { ChatMessage } from "../chat-example/common";
import { ServerSideClientSocket, RootServer } from "../../typedSocket";
import * as t from "io-ts";
import { ServerDefinition, SimpleNamespace } from "../..";
export { ChatMessage };
const unchecked = <T>() => t.any as t.Type<T>;

export const runtimeSchema = {
    // messages the server can emit:
    ServerMessages: {
        chatMessage: unchecked<ChatMessage>(),
        history: unchecked<ChatMessage[]>(),
    },
    // messages clients can send to the server, with a typed response
    ClientRPCs: {
        postMessage: {
            request: t.strict({
                message: t.string,
                channel: t.union([t.literal("en"), t.literal("ru")]),
            }),
            response: unchecked<"ok">(),
        },
    },
    ClientMessages: {},
};

export type ChatNamespace = SimpleNamespace<
    ToCompiletime<typeof runtimeSchema>
>;

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

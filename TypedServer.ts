/**
 * typed socket.io server (runtime component)
 */

import * as t from "io-ts";
import * as ts from "./typedSocket";
import { PathReporter } from "io-ts/lib/PathReporter";
import { ServerDefinition } from "./typedSocket";

/** use this for calls with no arguments */
export const empty = t.union([t.undefined, t.null]);
export type empty = undefined | null;

/** things that you probably don't need to directly use */
export namespace internal {
    export interface RuntimeClientRPCStructure {
        [name: string]: {
            request: t.Type<any>;
            response: t.Type<any>;
        };
    }
    export interface RuntimeClientMessagesStructure {
        [name: string]: t.Type<any>;
    }
    export interface RuntimeServerMessagesStructure {
        [name: string]: t.Type<any>;
    }
    export type ClientMessagesHandler<S extends ts.NamespaceSchema> = {
        [k in keyof S["ClientMessages"]]: (
            message: S["ClientMessages"][k],
        ) => void
    };

    export type ClientRPCsHandler<S extends ts.NamespaceSchema> = {
        [k in keyof S["ClientRPCs"]]: (
            message: S["ClientRPCs"][k]["request"],
        ) => Promise<S["ClientRPCs"][k]["response"]>
    };
    export type RuntimeNamespaceSchema = {
        ServerMessages: RuntimeServerMessagesStructure;
        ClientMessages: RuntimeClientMessagesStructure;
        ClientRPCs: RuntimeClientRPCStructure;
    };
}

/**
 * a wrapper around all the info needed to create a typed Server and
 * ClientSocketHandler, so we only need to pass one generic parameter to those classes
 */
export type NeededInfo<
    S extends ServerDefinition = ServerDefinition,
    MyNamespaceSchema extends ts.FullNamespaceSchema = ts.FullNamespaceSchema
> = {
    ServerDefinition: S;
    NamespaceSchema: MyNamespaceSchema;
    RuntimeSchema: FromCompiletime<MyNamespaceSchema>;
};

export type NeededInfoFor<
    S extends ServerDefinition,
    K extends ts.NamespaceNames<S>
> = NeededInfo<S, ts.Namespace<S, K>>;

export type ToCompiletime<S extends internal.RuntimeNamespaceSchema> = {
    ServerMessages: {
        [k in keyof S["ServerMessages"]]: t.TypeOf<S["ServerMessages"][k]>
    };
    ClientMessages: {
        [k in keyof S["ClientMessages"]]: t.TypeOf<S["ClientMessages"][k]>
    };
    ClientRPCs: {
        [k in keyof S["ClientRPCs"]]: {
            request: t.TypeOf<S["ClientRPCs"][k]["request"]>;
            response: t.TypeOf<S["ClientRPCs"][k]["response"]>;
            error: t.mixed;
        }
    };
};

export type FromCompiletime<S extends ts.NamespaceSchema> = {
    ServerMessages: {
        [k in keyof S["ServerMessages"]]: t.Type<S["ServerMessages"][k]>
    };
    ClientMessages: {
        [k in keyof S["ClientMessages"]]: t.Type<S["ClientMessages"][k]>
    };
    ClientRPCs: {
        [k in keyof S["ClientRPCs"]]: {
            request: t.Type<S["ClientRPCs"][k]["request"]>;
            response: t.Type<S["ClientRPCs"][k]["response"]>;
            // error: t.Type<any, any>;
        }
    };
};
export type ToRuntime<S extends ts.NamespaceSchema> = FromCompiletime<S>;

export type IClientSocketHandler<N extends NeededInfo> = {
    socket: ts.ServerSideClientSocketNS<
        N["ServerDefinition"],
        N["NamespaceSchema"]
    >;
} & internal.ClientMessagesHandler<N["NamespaceSchema"]> &
    internal.ClientRPCsHandler<N["NamespaceSchema"]>;

export type IPartialClientSocketHandler<N extends NeededInfo> = {
    socket: ts.ServerSideClientSocketNS<
        N["ServerDefinition"],
        N["NamespaceSchema"]
    >;
} & Partial<IClientSocketHandler<N>>;

/**
 * Usage: MyClass extends ClientSocketHandler<X> implements IClientSocketHandler<X> {...}
 */
export class ClientSocketHandler<N extends NeededInfo> {
    // this is so you can do
    // `async some_rpc(info: typeof this._types.some_rpc.request): Promise<typeof this._types.some_rpc.response>`
    // but `typeof this` isn't supported in typescript yet
    _types: {
        [k in keyof N["NamespaceSchema"]["ClientRPCs"]]: N["NamespaceSchema"]["ClientRPCs"][k]
    } = undefined!;

    constructor(
        readonly socket: ts.ServerSideClientSocketNS<
            N["ServerDefinition"],
            N["NamespaceSchema"]
        >,
    ) {}
}

/**
 * Get the type of the request for a specific client RPC.
 *
 * Example usage:
 *
 * class ChatClient extends ClientSocketHandler<ChatServerInfo>
 *   implements IClientSocketHandler<ChatServerInfo> {
 *   async postMessage(
 *       message: Req<this, "postMessage">,
 *   ): Res<this, "postMessage"> {
 *       ...
 *   }
 * }
 *
 * Sadly somewhat broken due to https://github.com/Microsoft/TypeScript/issues/10727
 */
export type Req<
    C extends ClientSocketHandler<any>,
    t extends string
> = C["_types"][t]["request"];

/**
 * Get the type of the response the server will send for a given client RPC.
 */
export type Res<C extends ClientSocketHandler<any>, t extends string> = Promise<
    C["_types"][t]["response"]
>;
// https://github.com/Microsoft/TypeScript/issues/12776
export const Res = Promise;

export interface ServerConfig {
    /** allow the client socket handler to ignore some client messages */
    allowMissingHandlers: boolean;
    /** for RPCs, we usually send type errors back as the first callback argument. When the callback is missing, this logs the error instead */
    logUnsendableErrors: boolean;
}
const defaultServerConfig: ServerConfig = {
    allowMissingHandlers: false,
    logUnsendableErrors: true,
};
/**
 * extend this class to create a typed socket.io server
 */
export abstract class Server<N extends NeededInfo> {
    private readonly __config: ServerConfig;
    constructor(
        readonly schema: N["RuntimeSchema"],
        config: Partial<ServerConfig> = {},
    ) {
        this.__config = Object.assign({}, defaultServerConfig, config);
    }
    listen(
        io: ts.ServerNamespaceNS<N["ServerDefinition"], N["NamespaceSchema"]>,
    ) {
        const schema = this.schema;
        // todo: socket here was correctly inferred in typescript 2.6, but it is implicitly any in typescript 2.7+
        io.on("connection", (socket: any) => {
            const handler = this.onConnection(socket);
            if (!handler) {
                socket.disconnect();
                return;
            }
            for (const clientMessage in schema.ClientMessages) {
                if (typeof handler[clientMessage] !== "function") {
                    if (!this.__config.allowMissingHandlers)
                        console.warn("No handler for " + clientMessage);
                    continue;
                }
                socket.on(clientMessage, (...args: any[]) =>
                    this.safeHandleClientMessage(
                        handler,
                        clientMessage,
                        args,
                        schema.ClientMessages[clientMessage],
                    ),
                );
            }
            for (const clientRPC in schema.ClientRPCs) {
                if (typeof handler[clientRPC] !== "function") {
                    if (!this.__config.allowMissingHandlers)
                        console.warn("No handler for " + clientRPC);
                    continue;
                }
                socket.on(clientRPC, (...args: any[]) =>
                    this.safeHandleClientRPC(
                        handler,
                        clientRPC,
                        args,
                        schema.ClientRPCs[clientRPC]["request"],
                    ),
                );
            }
        });
    }

    /**
     * handle an incoming connection. return null to drop the connection or a socket handler object to keep it
     */
    abstract onConnection(
        clientSocket: ts.ServerSideClientSocketNS<
            N["ServerDefinition"],
            N["NamespaceSchema"]
        >,
    ): IPartialClientSocketHandler<N> | null;

    /**
     * called when a client sends a message that has a type error
     */
    onClientMessageTypeError(
        socket: ts.ServerSideClientSocketNS<
            N["ServerDefinition"],
            N["NamespaceSchema"]
        >,
        message: string,
        error: string,
    ): void {
        console.error(socket.id + ": " + message + ": " + error);
    }
    /**
     * return what should be sent as the callback error. override this to customize. By default, the error message will be returned
     *
     * if the callback is missing, onClientMessageTypeError will be called instead
     */
    onClientRPCTypeError(
        _socket: ts.ServerSideClientSocketNS<
            N["ServerDefinition"],
            N["NamespaceSchema"]
        >,
        message: string,
        error: string,
    ): any {
        return message + ": " + error;
    }
    /**
     * override this method to map server-side Promise rejections / throws to a friendly client message
     */
    onClientRPCRejection(
        _socket: ts.ServerSideClientSocketNS<
            N["ServerDefinition"],
            N["NamespaceSchema"]
        >,
        _message: string,
        error: any,
    ) {
        return error;
    }

    private safeHandleClientMessage<
        K extends keyof N["NamespaceSchema"]["ClientMessages"]
    >(
        handler: IPartialClientSocketHandler<N>,
        message: K,
        args: any[],
        schema: t.Type<t.mixed>,
    ) {
        if (args.length !== 1) {
            this.onClientMessageTypeError(
                handler.socket,
                message,
                `Invalid argument: passed ${args.length}, expected 1`,
            );
            return;
        }
        const arg = args[0];
        const validation = schema.decode(arg);
        if (validation.isLeft()) {
            const error = PathReporter.report(validation).join("\n");
            this.onClientMessageTypeError(
                handler.socket,
                message,
                "Type Error: " + error,
            );
            return;
        }
        const safeArg = validation.value;
        try {
            (handler[message] as any)(safeArg);
            return;
        } catch (e) {
            console.log(handler.socket.id, message, e);
        }
    }
    private async safeHandleClientRPC(
        handler: IPartialClientSocketHandler<N>,
        message: keyof N["NamespaceSchema"]["ClientRPCs"],
        args: any[],
        schema: t.Type<t.mixed>,
    ) {
        if (args.length !== 2) {
            await this.onClientMessageTypeError(
                handler.socket,
                message,
                `Invalid arguments: passed ${
                    args.length
                }, expected (argument, callback)`,
            );
            return;
        }
        const [arg, cb] = args;
        if (typeof cb !== "function") {
            await this.onClientMessageTypeError(
                handler.socket,
                message,
                "No callback",
            );
            return;
        }
        const validation = schema.decode(arg);
        if (validation.isLeft()) {
            const error = PathReporter.report(validation).join("\n");
            cb(
                await this.onClientRPCTypeError(
                    handler.socket,
                    message,
                    "Type Error: " + error,
                ),
            );
            return;
        }
        const safeArg = validation.value;
        try {
            cb(null, await (handler[message] as any)(safeArg));
        } catch (e) {
            cb(await this.onClientRPCRejection(handler.socket, message, e));
        }
    }
}

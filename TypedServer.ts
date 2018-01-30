/**
 * typed socket.io server (runtime component)
 */

import * as t from "io-ts";
import * as ts from "./typedSocket";
import { isLeft } from "fp-ts/lib/Either";
import { PathReporter } from "io-ts/lib/PathReporter";
import { ServerDefinition } from "./typedSocket";

/** use this for calls with no arguments */
export const empty = t.union([t.undefined, t.null]);
export type empty = undefined | null;

export interface RuntimeClientRPCStructure {
    [name: string]: {
        request: t.Type<any, any>;
        response: t.Type<any, any>;
    };
}
export interface RuntimeClientMessagesStructure {
    [name: string]: t.Type<any, any>;
}
export interface RuntimeServerMessagesStructure {
    [name: string]: t.Type<any, any>;
}
export type RuntimeNamespaceSchema = {
    ServerMessages: RuntimeServerMessagesStructure;
    ClientMessages: RuntimeClientMessagesStructure;
    ClientRPCs: RuntimeClientRPCStructure;
};

export type NeededInfo<
    S extends ServerDefinition = ServerDefinition,
    MyNamespaceSchema extends ts.NamespaceSchema = ts.NamespaceSchema
> = {
    ServerDefinition: S;
    NamespaceSchema: MyNamespaceSchema;
    RuntimeSchema: FromCompiletime<MyNamespaceSchema>;
};

export type ToCompiletime<S extends RuntimeNamespaceSchema> = {
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
            error: any;
        }
    };
};

export type FromCompiletime<S extends ts.NamespaceSchema> = {
    ServerMessages: {
        [k in keyof S["ServerMessages"]]: t.Type<any, S["ServerMessages"][k]>
    };
    ClientMessages: {
        [k in keyof S["ClientMessages"]]: t.Type<any, S["ClientMessages"][k]>
    };
    ClientRPCs: {
        [k in keyof S["ClientRPCs"]]: {
            request: t.Type<any, S["ClientRPCs"][k]["request"]>;
            response: t.Type<any, S["ClientRPCs"][k]["response"]>;
            // error: t.Type<any, any>;
        }
    };
};

export namespace internal {
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
}

export type IClientSocketHandler<N extends NeededInfo> = {
    io: ts.ServerNamespaceNS<N["ServerDefinition"], N["NamespaceSchema"]>;
    socket: ts.ServerSideClientSocketNS<
        N["ServerDefinition"],
        N["NamespaceSchema"]
    >;
} & internal.ClientMessagesHandler<N["NamespaceSchema"]> &
    internal.ClientRPCsHandler<N["NamespaceSchema"]>;

export type IPartialClientSocketHandler<N extends NeededInfo> = {
    io: ts.ServerNamespaceNS<N["ServerDefinition"], N["NamespaceSchema"]>;
    socket: ts.ServerSideClientSocketNS<
        N["ServerDefinition"],
        N["NamespaceSchema"]
    >;
} & Partial<internal.ClientMessagesHandler<N["NamespaceSchema"]>> &
    Partial<internal.ClientRPCsHandler<N["NamespaceSchema"]>>;
/**
 * Usage: MyClass extends ClientSocketHandler<X> implements IClientSocketHandler<X> {...}
 */
export class ClientSocketHandler<N extends NeededInfo> {
    constructor(
        readonly io: ts.ServerNamespaceNS<
            N["ServerDefinition"],
            N["NamespaceSchema"]
        >,
        readonly socket: ts.ServerSideClientSocketNS<
            N["ServerDefinition"],
            N["NamespaceSchema"]
        >,
    ) {}
}

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
        io.on("connection", socket => {
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
    /** return what should be sent as the callback error. override this to customize. By default, the error message will be returned */
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

    private safeHandleClientMessage<
        K extends keyof N["NamespaceSchema"]["ClientMessages"]
    >(
        handler: IPartialClientSocketHandler<N>,
        message: K,
        args: any[],
        schema: t.Type<any, any>,
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
        const validation = t.validate(arg, schema);
        if (isLeft(validation)) {
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
        schema: t.Type<any, any>,
    ) {
        if (args.length !== 2) {
            const msg = this.onClientRPCTypeError(
                handler.socket,
                message,
                `Invalid arguments: passed ${
                    args.length
                }, expected (argument, callback)`,
            );
            if (this.__config.logUnsendableErrors) console.error(msg);
            return;
        }
        const [arg, cb] = args;
        if (typeof cb !== "function") {
            const msg = this.onClientRPCTypeError(
                handler.socket,
                message,
                "No callback",
            );
            if (this.__config.logUnsendableErrors) console.error(msg);
            return;
        }
        const validation = t.validate(arg, schema);
        if (isLeft(validation)) {
            const error = PathReporter.report(validation).join("\n");
            cb(
                this.onClientRPCTypeError(
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
            cb(e);
        }
    }
}

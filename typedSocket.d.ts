/** stuff you probably won't need to import directly */
export namespace internal {
    export interface ClientRPCStructure {
        [name: string]: {
            request: any;
            response: any;
            error?: any;
        };
    }
    /**
     * messages that any client can receive "from the server" (see https://github.com/socketio/socket.io-client/blob/master/docs/API.md)
     */
    export interface GeneralServerMessages {
        /** socket.io emits this as soon as the client is connected */
        connect: void;
        /** socket.io emits this as when the client is disconnected, the string is the reason */
        disconnect: string;
        /** Fired when a socket.io error occurs. */
        error: any;
        /** Fired upon a connection error. */
        connect_error: any;
        /** Fired upon a connection timeout. */
        /*connect_timeout: any;
        reconnect: number;
        reconnect_attempt: number;*/
    }

    /**
     * messages that the server can receive from any client
     */
    export interface GeneralClientMessages {
        disconnect: void;
    }

    interface ClientSideSocketI<
        ServerMessages,
        ClientMessages,
        ClientRPCs extends internal.ClientRPCStructure
    > {
        on<K extends keyof ServerMessages>(
            type: K,
            listener: (info: ServerMessages[K]) => void,
        ): this;
        off<K extends keyof ServerMessages>(
            type: K,
            listener: (info: ServerMessages[K]) => void,
        ): this;
        once<K extends keyof ServerMessages>(
            type: K,
            listener: (info: ServerMessages[K]) => void,
        ): this;
        removeListener<K extends keyof ServerMessages>(
            type: K,
            listener: (info: ServerMessages[K]) => void,
        ): this;

        emit<K extends keyof ClientMessages>(
            type: K,
            info: ClientMessages[K],
        ): this;

        emit<K extends keyof ClientRPCs>(
            type: K,
            info: ClientRPCs[K]["request"],
            callback: (
                error?: ClientRPCs[K]["error"],
                data?: ClientRPCs[K]["response"],
            ) => void,
        ): this;

        emitAsync<K extends keyof ClientRPCs>(
            type: K,
            info: ClientRPCs[K]["request"],
        ): Promise<ClientRPCs[K]["response"]>;

        connected: boolean;
        connect(): any;
        disconnect(): any;
        removeAllListeners(): void;
    }

    interface ServerSideClientSocketI<
        ServerMessages,
        ClientMessages,
        ClientRPCs extends ClientRPCStructure
    > {
        disconnect(close?: boolean): void;
        id: string;
        on<K extends keyof ClientMessages>(
            type: K,
            listener: (info: ClientMessages[K]) => void,
        ): this;

        on<K extends keyof ClientRPCs>(
            type: K,
            listener: (
                info: ClientRPCs[K]["request"],
                callback: (
                    error: ClientRPCs[K]["error"] | null,
                    data?: ClientRPCs[K]["response"],
                ) => void,
            ) => void,
        ): this;

        onAsync<K extends keyof ClientRPCs>(
            type: K,
            listener: (
                info: ClientRPCs[K]["request"],
            ) => Promise<ClientRPCs[K]["response"]>,
        ): this;

        emit<K extends keyof ServerMessages>(
            type: K,
            info: ServerMessages[K],
        ): this;
    }

    /**
     * The interface of require("socket.io")(port).of("/test"), defined by the namespace schema N for "/test".
     *
     * Still needs the complete definition D of the server because you can access the root server from any namespace via .server
     */
    interface ServerNamespaceNSI<
        D extends ServerDefinition,
        N extends FullNamespaceSchema
    > {
        on(
            type: "connection",
            listener: (info: ServerSideClientSocketNS<D, N>) => void,
        ): this;
        emit<K2 extends keyof N["ServerMessages"]>(
            type: K2,
            info: N["ServerMessages"][K2],
        ): this;

        in(roomName: string): this;
        to(roomName: string): this;
        close(): void;

        server: RootServer<D>;
        use(
            fn: (
                socket: ServerSideClientSocketNS<D, N>,
                fn: (err?: any) => void,
            ) => void,
        ): this;

        sockets: { [id: string]: ServerSideClientSocketNS<D, N> | undefined };
    }
}

/** Namespace schema without custom interface additions */
export interface NamespaceSchema {
    ClientMessages: { [name: string]: any };
    ServerMessages: { [name: string]: any };
    ClientRPCs: internal.ClientRPCStructure;
}

/**
 * Create a namespace without any custom additions
 */
export interface SimpleNamespace<O extends NamespaceSchema>
    extends FullNamespaceSchema {
    ClientMessages: O["ClientMessages"];
    ServerMessages: O["ServerMessages"];
    ClientRPCs: O["ClientRPCs"];
    CustomServerNamespaceInterface: {};
    CustomServerClientInterface: {};
}
export interface FullNamespaceSchema extends NamespaceSchema {
    /**
     * This will be added to the type of the server namespace instance
     *
     */
    CustomServerNamespaceInterface: any;
    /**
     * This will be added to all server side client socket instances
     *
     */
    CustomServerClientInterface: any;
}

/**
 * extend this interface to completely define your server-client communication
 */
export interface ServerDefinition {
    namespaces: { [name: string]: FullNamespaceSchema };
}
/**
 * get the names of all the namespaces for a given ServerDefinition
 */
export type NamespaceNames<D extends ServerDefinition> = keyof D["namespaces"];

/**
 * gets the NamespaceSchema from a ServerDefinition D and a socket.io namespace name
 */
export type Namespace<
    D extends ServerDefinition,
    K extends NamespaceNames<D>
> = D["namespaces"][K];

/**
 * A typed version of require('socket.io-client')('http://.../namespace') where K is /namespace
 */
export type ClientSideSocket<
    D extends ServerDefinition,
    K extends NamespaceNames<D>
> = internal.ClientSideSocketI<
    Namespace<D, K>["ServerMessages"] & internal.GeneralServerMessages,
    Namespace<D, K>["ClientMessages"],
    Namespace<D, K>["ClientRPCs"]
>;

/**
 * The interface of require("socket.io")(port).of("/test"), defined by the complete server definition D and the string path of the namespace K (from NamespaceNames<D>)
 *
 */
export type ServerNamespace<
    D extends ServerDefinition,
    K extends NamespaceNames<D>
> = internal.ServerNamespaceNSI<D, Namespace<D, K>> &
    Namespace<D, K>["CustomServerNamespaceInterface"];

/**
 * The interface of require("socket.io")(port).of("/test"), defined by the namespace schema N for "/test".
 *
 * Use this when you don't known what your own NamespaceName is.
 *
 * Still needs the complete definition D of the server because you can access the root server from any namespace via .server
 */
export type ServerNamespaceNS<
    D extends ServerDefinition,
    N extends FullNamespaceSchema
> = internal.ServerNamespaceNSI<D, N> & N["CustomServerNamespaceInterface"];

export type ClientSideSocketNS<
    N extends NamespaceSchema
> = internal.ClientSideSocketI<
    N["ServerMessages"],
    N["ClientMessages"],
    N["ClientRPCs"]
>;

export type ServerSideClientSocket<
    D extends ServerDefinition,
    K extends NamespaceNames<D>
> = ServerSideClientSocketNS<D, Namespace<D, K>>;

export type ServerSideClientSocketNS<
    D extends ServerDefinition,
    NS extends FullNamespaceSchema
> = internal.ServerSideClientSocketI<
    NS["ServerMessages"],
    NS["ClientMessages"] & internal.GeneralClientMessages,
    NS["ClientRPCs"]
> &
    NS["CustomServerClientInterface"] & {
        server: RootServer<D>;
        nsp: ServerNamespaceNS<D, NS>;
    };

export interface RootServer<D extends ServerDefinition> {
    of<K extends NamespaceNames<D>>(ns: K): ServerNamespace<D, K>;
    adapter(v: any): this;
}

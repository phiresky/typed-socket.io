export interface ClientRPCStructure {
    [name: string]: {
        request: any;
        response: any;
        error?: any;
    };
}

/** Namespace schema without custom interface additions */
export interface NamespaceSchemaRaw {
    ClientMessages: { [name: string]: any };
    ServerMessages: { [name: string]: any };
    ClientRPCs: ClientRPCStructure;
}

/**
 * a namespace without any custom additions
 */
export interface SimpleNamespace<O extends NamespaceSchemaRaw>
    extends NamespaceSchema {
    ClientMessages: O["ClientMessages"];
    ServerMessages: O["ServerMessages"];
    ClientRPCs: O["ClientRPCs"];
    CustomServerNamespaceInterface: {};
    CustomServerClientInterface: {};
}
export interface NamespaceSchema extends NamespaceSchemaRaw {
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

export type NamespaceMap = {
    [name: string]: NamespaceSchema;
};

/**
 * extend this interface to completely define your server-client communication
 */
export interface ServerDefinition {
    namespaces: NamespaceMap;
}
export type NamespaceNames<D extends ServerDefinition> = keyof D["namespaces"];

/**
 * gets the NamespaceSchema from a ServerDefinition D and a socket.io namespace name
 */
export type Namespace<
    D extends ServerDefinition,
    K extends NamespaceNames<D>
> = D["namespaces"][K];

/**
 * messages that any client can receive "from the server" (see https://socket.io/docs/client-api/)
 */
export interface GeneralServerMessages {
    /** socket.io emits this as soon as the client is connected */
    connect: void;
    /** socket.io emits this as when the client is disconnected, the string is the reason */
    disconnect: string;
    /** Fired when a socket.io error occurs. */
    error: any;
}

/**
 * messages that the server can receive from any client
 */
export interface GeneralClientMessages {
    disconnect: void;
}

/**
 * A typed version of require('socket.io-client')('http://.../namespace') where K is /namespace
 */
export type ClientSideSocket<
    D extends ServerDefinition,
    K extends NamespaceNames<D>
> = ClientSideSocketI<
    Namespace<D, K>["ServerMessages"] & GeneralServerMessages,
    Namespace<D, K>["ClientMessages"],
    Namespace<D, K>["ClientRPCs"]
>;

interface ClientSideSocketI<
    ServerMessages,
    ClientMessages,
    ClientRPCs extends ClientRPCStructure
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

/**
 * The interface of require("socket.io")(port).of("/test"), defined by the complete server definition D and the string path of the namespace K (from NamespaceNames<D>)
 *
 */
export type ServerNamespace<
    D extends ServerDefinition,
    K extends NamespaceNames<D>
> = ServerNamespaceNSI<D, Namespace<D, K>> &
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
    N extends NamespaceSchema
> = ServerNamespaceNSI<D, N> & N["CustomServerNamespaceInterface"];

/**
 * The interface of require("socket.io")(port).of("/test"), defined by the namespace schema N for "/test".
 *
 * Still needs the complete definition D of the server because you can access the root server from any namespace via .server
 */
interface ServerNamespaceNSI<
    D extends ServerDefinition,
    N extends NamespaceSchema
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

export type ClientSideSocketNS<N extends NamespaceSchema> = ClientSideSocketI<
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
    NS extends NamespaceSchema
> = ServerSideClientSocketI<
    NS["ServerMessages"],
    NS["ClientMessages"] & GeneralClientMessages,
    NS["ClientRPCs"]
> &
    NS["CustomServerClientInterface"] & {
        server: RootServer<D>;
        nsp: ServerNamespaceNS<D, NS>;
    };

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

export interface RootServer<D extends ServerDefinition> {
    of<K extends NamespaceNames<D>>(ns: K): ServerNamespace<D, K>;
    adapter(v: any): this;
}

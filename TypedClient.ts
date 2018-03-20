/**
 * This file is for client-side use.
 */

import { ClientSideSocketNS, internal, NamespaceSchema } from "./typedSocket";
import { promisifySocket, autoReconnect, mixed } from "./util";

import * as io from "socket.io-client";

function getKeys(obj: any) {
    const keys: string[] = [];
    while (obj && obj !== Object.prototype) {
        const properties = Object.getOwnPropertyNames(obj);
        for (const prop of properties) {
            if (keys.indexOf(prop) === -1) keys.push(prop);
        }
        obj = Object.getPrototypeOf(obj);
    }
    return keys;
}

/**
 * an interface that ensures that all possible server messages are listened to
 *
 * needed because typescript does not support handling index signature as interface
 */
export type ITypedClient<S extends NamespaceSchema> = {
    [k in keyof (S["ServerMessages"] & internal.GeneralServerMessages)]: (
        message: (S["ServerMessages"] & internal.GeneralServerMessages)[k],
    ) => void
};

/**
 * the same as ITypedClient but listening to events is optional
 */
export type ITypedPartialClient<S extends NamespaceSchema> = {
    [k in keyof (S["ServerMessages"] & internal.GeneralServerMessages)]?: (
        message: (S["ServerMessages"] & internal.GeneralServerMessages)[k],
    ) => void
};

/**
 * a class that listens to all the events we declare a method for
 *
 * usage: class MyClass extends TypedClient<S> implements ITypedClient<S>
 */
export abstract class TypedClient<S extends NamespaceSchema> {
    public readonly socket: ClientSideSocketNS<S>;
    constructor(
        connectPath: string,
        config: { forceWebsockets?: boolean } = { forceWebsockets: false },
    ) {
        const opts = { autoConnect: false };
        if (config.forceWebsockets)
            Object.assign(opts, { transports: ["websocket"], upgrade: false });
        this.socket = io(connectPath, opts) as any;
        promisifySocket(this.socket);

        if (!this.socket.connected) this.socket.connect();
        autoReconnect(this.socket);

        const messages = getKeys(Object.getPrototypeOf(this));
        for (const msg of messages) {
            if (msg === "constructor" || msg === "destructor") continue;
            const fn = (this as any)[msg] as mixed;
            if (typeof fn !== "function")
                throw Error("invalid listener for message " + msg);
            this.socket.on(msg, fn.bind(this));
        }
    }
    destructor() {
        this.socket.removeAllListeners();
        this.socket.disconnect();
    }

    connect() {}

    connect_error(err: Error) {
        console.log("socket connect error", err);
    }

    error(msg: string) {
        console.error("socket error", msg);
    }

    disconnect(reason: string) {
        console.log("disconnected, reason:", reason);
    }
}

import { ClientSideSocket, ServerSideClientSocket } from "./typedSocket";

/**
 * promisify the emit function for RPC calls
 */
export function promisifySocket(
    socket: ClientSideSocket<any, any> | ServerSideClientSocket<any, any>,
    options?: { mapErrors?: (e: any) => any },
) {
    socket.emitAsync = function (type: string, ...args: any[]) {
        return new Promise((resolve, reject) => {
            (socket as any).emit(type, ...args, (err: any, res: any) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
    };
    socket.rpc = new Proxy(
        {},
        {
            get(obj, method) {
                if (method in obj) return (obj as any)[method];
                return (...args: any[]) => socket.emitAsync(method, ...args);
            },
        },
    );

    socket.onAsync = function (
        event: string,
        callback: (...args: any[]) => Promise<any>,
    ) {
        this.on(event, (...args: any[]) => {
            if (
                args.length === 0 ||
                typeof args[args.length - 1] !== "function"
            ) {
                console.error(
                    `invalid callback: ${socket.id} called`,
                    event,
                    "with args",
                    args,
                );
            } else {
                const clientCallback = args[args.length - 1];
                callback(...args.slice(0, args.length - 1))
                    .then((result) => clientCallback(null, result))
                    .catch((e) =>
                        clientCallback(
                            options && options.mapErrors
                                ? options.mapErrors(e)
                                : e,
                        ),
                    );
            }
        });
    };
}

/**
 * automatically reconnect a socket when the backend disconnects
 */
export function autoReconnect(
    socket: ClientSideSocket<any, any>,
    minDelay_ms = 2000,
    maxDelay_ms = 5000,
) {
    socket.on("disconnect", (reason: string) => {
        if (reason !== "io server disconnect") {
            // reason == "transport close" or "io client disconnect".
            // "transport close" means the transport layer is down (and thus all socket.io namespaces disconnected), socketio manager will handle auto reconnect
            // "io client disconnect" means *our backend* disconnected
            return;
        }
        // backend is down, try reconnecting periodically.
        // the disconnect event will be received each time because the distributor will accept the connection and then immediately disconnect it
        const delay = minDelay_ms + Math.random() * (maxDelay_ms - minDelay_ms);
        console.log(
            "disconnected from backend, reconnecting in",
            Math.round(delay),
            "ms",
        );
        setTimeout(() => {
            if (!socket.connected) socket.connect();
        }, delay);
    });
}

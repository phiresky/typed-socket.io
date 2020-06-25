import {
    Server,
    ClientSocketHandler,
    IClientSocketHandler,
} from "../../TypedServer";
import * as io from "socket.io";
import {
    ChatServerInfo,
    MyRootServer,
    ChatSocket,
    Req,
    Res,
    runtimeSchema,
} from "./common";

class ChatServer extends Server<ChatServerInfo> {
    constructor(ioServer: MyRootServer) {
        super(runtimeSchema);
        this.listen(ioServer.of("/chat"));
    }

    onConnection(socket: ChatSocket) {
        // to reject connection, return null
        return new ChatClientHandler(socket);
    }
}

/**
 * one of these will be created for every socket connection
 */
class ChatClientHandler extends ClientSocketHandler<ChatServerInfo>
    implements IClientSocketHandler<ChatServerInfo> {
    async postMessage(
        message: Req<"postMessage">,
    ): Promise<Res<"postMessage">> {
        this.socket.nsp.emit("chatMessage", {
            ...message,
            sender: this.socket.id,
            // foo: "bar" // Object literal may only specify known properties, and 'foo' does not exist in type 'ChatMessage'.
        });
        return "ok";
        // return "ook" // [ts] Type '"ook"' is not assignable to type '"ok"'.
    }
}

new ChatServer(io(8001) as MyRootServer);

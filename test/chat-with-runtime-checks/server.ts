import {
    NeededInfoFor,
    Server,
    FromCompiletime,
    ClientSocketHandler,
    IClientSocketHandler,
} from "../../TypedServer";
import {
    MyServerDefinition,
    ChatMessage,
    MyRootServer,
} from "../chat-example/common";
import {
    Namespace,
    ServerSideClientSocket,
    ServerNamespace,
} from "../../typedSocket";
import * as t from "io-ts";
import * as io from "socket.io";
const unchecked = <T>() => t.any as t.Type<t.mixed, T>;

type ChatServerInfo = NeededInfoFor<MyServerDefinition, "/chat">;
type ChatNamespace = ServerNamespace<MyServerDefinition, "/chat">;
type ChatSocket = ServerSideClientSocket<MyServerDefinition, "/chat">;

const runtimeSchema: FromCompiletime<Namespace<MyServerDefinition, "/chat">> = {
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
class ChatServer extends Server<ChatServerInfo> {
    io: ChatNamespace;
    constructor(ioServer: MyRootServer) {
        super(runtimeSchema);
        this.io = ioServer.of("/chat");
    }

    onConnection(socket: ChatSocket) {
        if (false) {
            // reject connection
            return null;
        }
        return new ChatClient(socket);
    }
}

type RPCs = Namespace<MyServerDefinition, "/chat">["ClientRPCs"];
type Req<K extends keyof RPCs> = RPCs[K]["request"];
type Res<K extends keyof RPCs> = Promise<RPCs[K]["response"]>;

class ChatClient extends ClientSocketHandler<ChatServerInfo>
    implements IClientSocketHandler<ChatServerInfo> {
    async postMessage(message: Req<"postMessage">): Res<"postMessage"> {
        this.socket.nsp.emit("chatMessage", {
            ...message,
            sender: this.socket.id,
        });
        return "ok";
    }
}

new ChatServer(io(8000) as MyRootServer);

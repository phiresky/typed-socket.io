import { TypedClient, ITypedClient } from "../../TypedClient";
import { ChatNamespace, ChatMessage } from "./common";

const host = process.argv[2] || "http://localhost:8000";
const ns = "/chat";

const channelNames = { en: "English", ru: "Russian" };

class ChatClientListener extends TypedClient<ChatNamespace>
    implements ITypedClient<ChatNamespace> {
    chatMessage({ sender, message, channel }: ChatMessage) {
        console.log(`${channelNames[channel]}: ${sender}: ${message}`);
    }
    history(msgs: ChatMessage[]) {
        for (const msg of msgs) this.chatMessage(msg);
    }
}

async function run() {
    const listener = new ChatClientListener(host + ns);
    const res = await listener.socket.emitAsync("postMessage", {
        message: "Hello World",
        channel: "en",
    });
    console.assert(res === "ok");
}

run();

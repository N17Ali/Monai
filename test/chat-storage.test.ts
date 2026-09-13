import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import { createD1ChatStorage } from "../src/features/chat/chat.d1";
import { createMemoryChatStorage } from "../src/features/chat/chat.memory";
import type { ChatStorage } from "../src/features/chat/chat.storage";
import { createDb } from "../src/infrastructure/db/client";
import { createFakeD1 } from "./helpers/fake-d1";

const WINDOW = 50;

function message(id: string, text = id): UIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

// The same suite runs against both adapters. It asserts the interface, so a
// change to either adapter that breaks the shared contract fails here.
const adapters: Array<[string, () => ChatStorage]> = [
  ["memory", () => createMemoryChatStorage("u1")],
  ["d1", () => createD1ChatStorage(createDb(createFakeD1().binding), "u1")],
];

for (const [name, create] of adapters) {
  describe(`chat storage conformance: ${name}`, () => {
    it("lists saved messages in order", async () => {
      const storage = create();
      await storage.saveMessages("conversation-1", [message("m1"), message("m2")], WINDOW);
      expect((await storage.listMessages("conversation-1")).map((item) => item.id)).toEqual(["m1", "m2"]);
    });

    it("stores exactly the most recent window", async () => {
      const storage = create();
      const first = Array.from({ length: 40 }, (_, index) => message(`a${index}`));
      await storage.saveMessages("conversation-1", first, WINDOW);
      await storage.saveMessages("conversation-1", [...first, ...Array.from({ length: 20 }, (_, index) => message(`b${index}`))], WINDOW);
      const ids = (await storage.listMessages("conversation-1")).map((item) => item.id);
      expect(ids).toHaveLength(50);
      expect(ids[0]).toBe("a10");
      expect(ids.at(-1)).toBe("b19");
    });

    it("never rewrites a stored message", async () => {
      const storage = create();
      await storage.saveMessages("conversation-1", [message("m1", "first")], WINDOW);
      await storage.saveMessages("conversation-1", [message("m1", "changed"), message("m2", "second")], WINDOW);
      const listed = await storage.listMessages("conversation-1");
      expect(listed.map((item) => item.id)).toEqual(["m1", "m2"]);
      expect(listed[0]?.parts).toEqual([{ type: "text", text: "first" }]);
    });

    it("isolates conversations", async () => {
      const storage = create();
      await storage.saveMessages("conversation-1", [message("m1")], WINDOW);
      await storage.saveMessages("conversation-2", [message("m2")], WINDOW);
      expect((await storage.listMessages("conversation-1")).map((item) => item.id)).toEqual(["m1"]);
      expect((await storage.listMessages("conversation-2")).map((item) => item.id)).toEqual(["m2"]);
    });

    it("numbers conversations and recreates the default", async () => {
      const storage = create();
      expect(await storage.listConversations()).toEqual([{ id: "conversation-1", number: 1 }]);
      const second = await storage.createConversation();
      expect(second.number).toBe(2);
      expect((await storage.listConversations()).map((item) => item.number)).toEqual([1, 2]);
      await storage.removeConversation(second.id);
      expect((await storage.listConversations()).map((item) => item.number)).toEqual([1]);
      await storage.removeConversation("conversation-1");
      expect(await storage.listConversations()).toEqual([{ id: "conversation-1", number: 1 }]);
    });

    it("drops a conversation's messages when it is removed", async () => {
      const storage = create();
      await storage.saveMessages("conversation-1", [message("m1")], WINDOW);
      await storage.removeConversation("conversation-1");
      expect(await storage.listMessages("conversation-1")).toEqual([]);
    });
  });
}

describe("D1 chat storage mechanics", () => {
  it("keeps every insert statement within D1's 100 bound-parameter limit", async () => {
    const fake = createFakeD1();
    const storage = createD1ChatStorage(createDb(fake.binding), "u1");
    await storage.saveMessages("conversation-1", Array.from({ length: 20 }, (_, index) => message(`m${index}`)), WINDOW);
    const inserts = fake.statements.filter((statement) => /^\s*insert/i.test(statement.sql));
    expect(inserts.length).toBeGreaterThan(0);
    for (const insert of inserts) expect(insert.params.length).toBeLessThanOrEqual(100);
  });

  it("writes only messages that are not stored yet", async () => {
    const fake = createFakeD1();
    const storage = createD1ChatStorage(createDb(fake.binding), "u1");
    const existing = Array.from({ length: 10 }, (_, index) => message(`m${index}`));
    await storage.saveMessages("conversation-1", existing, WINDOW);
    fake.statements.length = 0;
    await storage.saveMessages("conversation-1", [...existing, message("new-1"), message("new-2")], WINDOW);
    const insertedIds = fake.statements
      .filter((statement) => /^\s*insert/i.test(statement.sql))
      .flatMap((statement) => {
        const ids: string[] = [];
        for (let start = 0; start < statement.params.length; start += 6) ids.push(String(statement.params[start]));
        return ids;
      });
    expect(insertedIds).toEqual(["new-1", "new-2"]);
  });

  it("supports history windows beyond the D1 per-statement limits", async () => {
    const fake = createFakeD1();
    const storage = createD1ChatStorage(createDb(fake.binding), "u1");
    const first = Array.from({ length: 150 }, (_, index) => message(`m${index}`));
    await storage.saveMessages("conversation-1", first, 150);
    for (const statement of fake.statements) expect(statement.params.length).toBeLessThanOrEqual(100);
    expect(fake.tables.chat_messages).toHaveLength(150);
    fake.statements.length = 0;
    await storage.saveMessages("conversation-1", [...first, ...Array.from({ length: 10 }, (_, index) => message(`x${index}`))], 150);
    expect(fake.tables.chat_messages.map((row) => row.id)).toHaveLength(150);
    expect(fake.tables.chat_messages[0]?.id).toBe("m10");
  });
});

import { demoUuid } from "@mf/contracts";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app";

const app = createApp();
const password = "Demo1234!";

async function login(email: string) {
  const agent = request.agent(app);
  const csrf = await agent.get("/api/v1/auth/csrf");
  const token = csrf.body.data.csrfToken as string;
  const response = await agent.post("/api/v1/auth/login").set("x-csrf-token", token).send({ email, password });
  return { agent, token: response.body.data?.csrfToken ?? token, response };
}

describe("API 基本隔離", () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL) throw new Error("需要 DATABASE_URL");
  });

  it("業者可以登入並看到自己的案件，不能讀取他案", async () => {
    const { agent, token, response } = await login("applicant01@example.test");
    expect(response.status).toBe(200);
    const list = await agent.get("/api/v1/applications").set("x-csrf-token", token);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThan(0);
    const foreign = await agent.get(`/api/v1/applications/${demoUuid(0x1002)}`);
    expect(foreign.status).toBe(404);
  });

  it("草稿可以只存部分資料", async () => {
    const { agent, token } = await login("applicant01@example.test");
    const categories = await agent.get("/api/v1/application-categories");
    const categoryId = categories.body.data[0].id as string;
    const created = await agent.post("/api/v1/applications").set("x-csrf-token", token).send({ categoryId });
    expect(created.status).toBe(200);
    const saved = await agent.patch(`/api/v1/applications/${created.body.data.id}`).set("x-csrf-token", token).send({
      expectedVersion: created.body.data.version,
      siteName: "部分草稿場所",
    });
    expect(saved.status).toBe(200);
    const again = await agent.get(`/api/v1/applications/${created.body.data.id}`);
    expect(again.body.data.siteName).toBe("部分草稿場所");
    const submit = await agent.post(`/api/v1/applications/${created.body.data.id}/submit`).set("x-csrf-token", token).send({
      expectedVersion: saved.body.data.version,
      requestId: crypto.randomUUID(),
    });
    expect(submit.status).toBe(400);
  });
});

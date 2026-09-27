import type { Services } from "./types";

export async function createServices(): Promise<Services> {
  if (import.meta.env.VITE_DATA_MODE === "mock") {
    if (import.meta.env.PROD) {
      throw new Error("正式建置不可使用展示模式");
    }
    const module = await import("../mocks/mock-services");
    return module.createMockServices();
  }
  const module = await import("./http-services");
  return module.createHttpServices();
}

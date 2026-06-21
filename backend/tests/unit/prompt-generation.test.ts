import { describe, it, expect } from "vitest";
import {
  cleanPrompt,
  generateDailyPromptPool,
  type AIBinding,
} from "../../src/services/prompt-generation.service";

describe("cleanPrompt (Qwen 출력 검증)", () => {
  it("keeps a well-formed Korean prompt", () => {
    expect(cleanPrompt("오늘 마음에 남은 한 장면은?")).toBe(
      "오늘 마음에 남은 한 장면은?",
    );
  });

  it("strips wrapping quotes", () => {
    expect(cleanPrompt('"오늘 처음 떠오른 생각은?"')).toBe(
      "오늘 처음 떠오른 생각은?",
    );
  });

  it("rejects strings containing Chinese hanzi (language drift)", () => {
    expect(cleanPrompt("오늘 心境을 적어보자")).toBeNull();
  });

  it("rejects strings containing SentencePiece artifacts", () => {
    expect(cleanPrompt("오늘\u2581마음에 남은 장면")).toBeNull();
  });

  it("rejects zero-width characters", () => {
    expect(cleanPrompt("오늘 처음\u200B떠오른 생각")).toBeNull();
  });

  it("rejects strings without any Hangul (pure ASCII / punctuation leak)", () => {
    expect(cleanPrompt("hello world, what a day?")).toBeNull();
  });

  it("rejects too-short and too-long strings", () => {
    expect(cleanPrompt("오늘")).toBeNull();
    expect(cleanPrompt("오".repeat(70))).toBeNull();
  });
});

class StubAI implements AIBinding {
  constructor(private readonly responses: string[]) {}
  private call = 0;
  async run(): Promise<{ response: string }> {
    const r = this.responses[this.call % this.responses.length];
    this.call += 1;
    return { response: r };
  }
}

describe("generateDailyPromptPool", () => {
  it("filters out language-drift entries while keeping valid ones", async () => {
    const payload = JSON.stringify({
      prompts: [
        "오늘 처음 떠오른 생각은?",
        "오늘 心境을 적어보자", // hanzi → rejected
        "오늘 마음에 남은 한 장면.",
        "▁weird tokenizer prefix",
        "오늘 누군가에게 못 한 말.",
      ],
    });
    const ai = new StubAI(Array(7).fill(payload));
    const pool = await generateDailyPromptPool(ai);
    // 3 valid × 7 topics = 21 (or close — dedupe in caller, not here)
    expect(pool.length).toBeGreaterThan(0);
    for (const p of pool) {
      expect(cleanPrompt(p.text)).toBe(p.text);
    }
  });

  it("survives a fenced code block", async () => {
    const fenced = "```json\n" + JSON.stringify({ prompts: ["오늘 마음에 남은 한 가지."] }) + "\n```";
    const ai = new StubAI(Array(7).fill(fenced));
    const pool = await generateDailyPromptPool(ai);
    expect(pool.length).toBeGreaterThanOrEqual(7);
  });

  it("returns empty pool when model returns gibberish JSON", async () => {
    const ai = new StubAI(Array(14).fill("not json at all"));
    const pool = await generateDailyPromptPool(ai);
    expect(pool).toEqual([]);
  });
});

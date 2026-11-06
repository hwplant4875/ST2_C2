import type { Actor, Beat, Caption, Concept, Deck, Quiz, Scene } from "./schema";
import { normalizeScene } from "./normalize";

/* Compact builders so hand-written scenes stay readable. */
export function A(id: string, type: Actor["type"], x: number, y: number, opts: Partial<Actor> = {}): Actor {
  return {
    id,
    type,
    emoji: "",
    label: "",
    x,
    y,
    w: 0,
    h: 0,
    size: "m",
    color: type === "pill" ? "navy" : "white",
    value: 0,
    hidden: false,
    ...opts,
  };
}

export function B(t: number, action: Beat["do"], a: string, opts: Partial<Beat> = {}): Beat {
  return { t, do: action, a, b: "", x: 0, y: 0, text: "", emoji: "", value: 0, style: "", d: 0, id: "", ...opts };
}

const C = (t: number, text: string): Caption => ({ t, text });

/* ------------------------------------------------------------------ */

const apiScene: Scene = {
  hook: "날씨 앱은 날씨를 어떻게 알까?",
  term: "API",
  definition: "프로그램끼리 대화하는 약속된 통로",
  highlight: "약속된 통로",
  palette: "blue",
  actors: [
    A("app", "card", 16, 46, { emoji: "📱", label: "날씨 앱" }),
    A("server", "card", 84, 46, { emoji: "🖥️", label: "기상청 서버" }),
    A("api", "pill", 50, 46, { label: "API", hidden: true }),
  ],
  beats: [
    B(0.2, "link", "app", { b: "server", style: "flow", id: "pipe", d: 0.6 }),
    B(0.7, "enter", "api", { style: "pop" }),
    B(1.4, "send", "app", { b: "server", style: "bubble", text: "날씨 알려줘!", d: 1.1 }),
    B(2.8, "send", "server", { b: "app", style: "answer", text: "맑음, 18도!", d: 1.1 }),
    B(3.9, "swap", "app", { emoji: "☀️", text: "맑음 18°" }),
    B(4.3, "glow", "api", { d: 1.6 }),
  ],
  captions: [
    C(0.2, "앱과 서버 사이엔 정해진 통로가 있어요"),
    C(1.4, "앱이 약속된 형식으로 요청하면"),
    C(2.8, "서버도 약속된 형식으로 답해요"),
    C(4.2, "이 약속이 바로 API!"),
  ],
  quiz: {
    question: "소프트웨어끼리 데이터를 주고받기 위해 정해 둔 약속된 통로는?",
    options: ["API", "SDK", "MCP", "GPU"],
    answer: 0,
    explanation: "API는 앱과 서버처럼 서로 다른 프로그램이 정해진 형식으로 요청하고 응답하는 통로예요.",
  },
};

const photosynthesisScene: Scene = {
  hook: "식물은 밥을 어떻게 먹을까?",
  term: "광합성",
  definition: "빛 에너지로 양분을 만드는 과정",
  highlight: "양분을 만드는",
  palette: "green",
  actors: [
    A("sun", "emoji", 14, 12, { emoji: "☀️", label: "빛", size: "s" }),
    A("water", "card", 14, 50, { emoji: "💧", label: "물", size: "s", color: "blue" }),
    A("co2", "card", 14, 86, { emoji: "💨", label: "이산화탄소", size: "s" }),
    A("leaf", "card", 50, 46, { emoji: "🌿", label: "엽록체", size: "l", color: "green" }),
    A("sugar", "card", 86, 26, { emoji: "🍬", label: "포도당", size: "s", color: "yellow", hidden: true }),
    A("o2", "card", 86, 74, { emoji: "🫧", label: "산소", size: "s", hidden: true }),
  ],
  beats: [
    B(0.3, "send", "sun", { b: "leaf", style: "token", emoji: "✨", d: 0.9 }),
    B(1.0, "send", "water", { b: "leaf", style: "token", emoji: "💧", d: 0.9 }),
    B(1.7, "send", "co2", { b: "leaf", style: "token", emoji: "💨", d: 0.9 }),
    B(2.7, "glow", "leaf", { d: 1.2 }),
    B(2.8, "shake", "leaf"),
    B(3.4, "enter", "sugar", { b: "leaf" }),
    B(3.7, "enter", "o2", { b: "leaf" }),
    B(4.3, "burst", "sugar"),
  ],
  captions: [
    C(0.2, "빛, 물, 이산화탄소가 잎으로 모여요"),
    C(2.6, "엽록체가 빛 에너지로 합성!"),
    C(3.6, "양분(포도당)과 산소가 만들어져요"),
  ],
  quiz: {
    question: "광합성의 결과로 만들어지는 물질 2가지는?",
    options: ["포도당과 산소", "물과 이산화탄소", "산소와 질소", "포도당과 물"],
    answer: 0,
    explanation: "엽록체는 빛 에너지로 물과 이산화탄소를 이용해 포도당을 만들고, 산소를 내보내요.",
  },
};

const fobScene: Scene = {
  hook: "배에 실은 물건이 깨지면 누구 책임?",
  term: "FOB",
  definition: "본선에 실리는 순간 위험이 수입자에게",
  highlight: "위험이 수입자에게",
  palette: "teal",
  actors: [
    A("seller", "card", 15, 24, { emoji: "🏭", label: "수출자" }),
    A("ship", "emoji", 50, 24, { emoji: "🚢", label: "본선", size: "l" }),
    A("buyer", "card", 85, 24, { emoji: "🏢", label: "수입자" }),
    A("risk", "pill", 15, 80, { emoji: "⚠️", label: "위험 부담", color: "yellow" }),
  ],
  beats: [
    B(0.3, "send", "seller", { b: "ship", style: "token", emoji: "📦", text: "물품", d: 1.3 }),
    B(1.8, "mark", "ship", { style: "check" }),
    B(2.2, "move", "risk", { x: 85, y: 80, d: 1.0 }),
    B(3.3, "pulse", "buyer"),
    B(3.4, "glow", "risk", { d: 1.4 }),
  ],
  captions: [
    C(0.2, "수출자가 물품을 배까지 옮겨요"),
    C(1.8, "물품이 배에 실리는 순간!"),
    C(2.9, "위험 부담이 수입자에게 넘어가요"),
  ],
  quiz: {
    question: "FOB 조건에서 물품의 위험이 수입자에게 넘어가는 시점은?",
    options: ["물품이 본선에 적재될 때", "수입항에 도착할 때", "수출자 공장에서 출고될 때", "수입자 창고에 입고될 때"],
    answer: 0,
    explanation: "FOB(본선인도)는 물품이 지정 선적항에서 본선에 적재되는 순간 위험이 수입자에게 넘어가요.",
  },
};

const demandScene: Scene = {
  hook: "치킨값이 오르면 왜 덜 사 먹을까?",
  term: "수요 법칙",
  definition: "가격이 오르면 수요량은 줄어든다",
  highlight: "수요량은 줄어든다",
  palette: "orange",
  actors: [
    A("chicken", "emoji", 24, 14, { emoji: "🍗", size: "s" }),
    A("price", "number", 24, 48, { emoji: "🏷️", label: "원", value: 18000, size: "s" }),
    A("demand", "bar", 74, 92, { label: "주문량", value: 80, h: 60, color: "yellow" }),
    A("people", "emoji", 74, 10, { emoji: "🙋", label: "사려는 사람", size: "s" }),
  ],
  beats: [
    B(0.5, "count", "price", { value: 25000, d: 1.3 }),
    B(0.5, "pulse", "chicken"),
    B(1.9, "grow", "demand", { value: 35, d: 1.2 }),
    B(1.9, "swap", "people", { emoji: "🙅", text: "안 살래" }),
    B(3.3, "glow", "demand", { d: 1.2 }),
  ],
  captions: [
    C(0.4, "가격이 오르면"),
    C(1.9, "사려는 양은 줄어들어요"),
    C(3.2, "가격과 수요량은 반대로 움직여요"),
  ],
  quiz: {
    question: "다른 조건이 같을 때, 가격이 오르면 수요량은 어떻게 될까?",
    options: ["줄어든다", "늘어난다", "변하지 않는다", "공급량과 같아진다"],
    answer: 0,
    explanation: "수요 법칙: 다른 조건이 일정하면 가격과 수요량은 반대 방향으로 움직여요.",
  },
};

const concepts: Record<string, Concept> = {
  API: {
    term: "API",
    definition: "프로그램끼리 대화하는 약속된 통로",
    explanation: "서로 다른 프로그램이 정해진 형식으로 요청을 보내고 응답을 받는 규칙이에요. 날씨 앱은 기상청 서버의 API로 날씨 데이터를 받아 와요.",
    keyPoints: ["요청(Request)과 응답(Response) 구조", "정해진 형식(규격)을 지켜야 통신 가능", "AI 모델도 API로 호출해 앱에 붙인다"],
    example: "날씨 앱이 기상청 서버에 '서울 날씨'를 요청하면 '맑음, 18도'를 돌려받아요.",
    visual: "앱과 서버 사이 통로로 요청·응답 말풍선이 오간다",
    pages: "예시",
  },
  광합성: {
    term: "광합성",
    definition: "빛 에너지로 양분을 만드는 과정",
    explanation: "식물의 엽록체가 빛 에너지를 이용해 물과 이산화탄소로 포도당을 만들고 산소를 내보내는 과정이에요.",
    keyPoints: ["장소: 엽록체", "재료: 물 + 이산화탄소 (+빛 에너지)", "결과: 포도당 + 산소"],
    example: "햇빛을 많이 받는 잎일수록 광합성이 활발해요.",
    visual: "빛·물·CO₂가 잎으로 모이고 포도당과 산소가 나온다",
    pages: "예시",
  },
  FOB: {
    term: "FOB",
    definition: "본선에 실리는 순간 위험이 수입자에게",
    explanation: "FOB(Free On Board, 본선인도)는 수출자가 물품을 지정 선적항의 본선에 적재하면 인도가 끝나고, 그 이후 위험과 비용은 수입자가 부담하는 인코텀즈 조건이에요.",
    keyPoints: ["위험 이전: 본선 적재 시점", "해상운임·보험료는 수입자 부담", "해상·내수로 운송에만 사용"],
    example: "부산항에서 배에 실린 뒤 폭풍으로 파손되면 손해는 수입자 몫이에요.",
    visual: "물품이 배에 실리는 순간 '위험 부담' 표지가 수입자 쪽으로 이동",
    pages: "예시",
  },
  "수요 법칙": {
    term: "수요 법칙",
    definition: "가격이 오르면 수요량은 줄어든다",
    explanation: "다른 조건이 일정할 때 어떤 상품의 가격이 오르면 사려는 양(수요량)은 줄고, 가격이 내리면 늘어나는 관계예요.",
    keyPoints: ["가격과 수요량은 반비례 관계", "수요곡선은 우하향", "'다른 조건이 일정할 때'라는 전제"],
    example: "치킨값이 18,000원에서 25,000원으로 오르면 주문이 줄어요.",
    visual: "가격 숫자가 오르는 동안 주문량 막대가 줄어든다",
    pages: "예시",
  },
};

const raw: [string, Scene][] = [
  ["API", apiScene],
  ["광합성", photosynthesisScene],
  ["FOB", fobScene],
  ["수요 법칙", demandScene],
];

export const SAMPLE_SCENES: Record<string, Scene> = Object.fromEntries(raw.map(([k, s]) => [k, normalizeScene(s, k)]));
/** Unnormalized originals (answer index kept) – used as few-shot examples. */
export const EXAMPLE_SCENES = { api: apiScene, photosynthesis: photosynthesisScene, fob: fobScene };

export const SAMPLE_DECK: Deck = {
  id: "sample-mix",
  title: "맛보기 · 4과목 개념",
  subject: "예시",
  source: "예시 자료",
  createdAt: Date.UTC(2026, 10, 6),
  sample: true,
  cards: raw.map(([k]) => ({
    id: `sample-${k}`,
    concept: concepts[k],
    scene: SAMPLE_SCENES[k],
    status: "ready" as const,
  })),
};

export type { Quiz };

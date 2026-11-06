# StudyTok

강의자료(PDF·사진)를 올리면 개념마다 **내용에 맞게 설계된 모션그래픽 숏폼 카드**와 퀴즈로 바꿔 주는 웹앱 데모.

## 어떻게 동작하나

1. **브라우저**: PDF는 pdf.js로 쪽별 텍스트를 뽑고, 글자가 거의 없는 쪽(스캔·도표)은 이미지로 렌더링. 사진은 축소해서 함께 전송.
2. **`/api/outline`**: Claude가 자료에서 시험에 중요한 핵심 개념 N개를 학습 순서대로 고르고, 개념마다 "어떤 움직임으로 보여줄지" 아이디어까지 작성.
3. **`/api/scene`** (개념마다 3개씩 동시에): Claude가 그 개념만을 위한 장면 설계도(JSON)를 작성. 등장 요소(카드·말풍선·막대·숫자·구역 등), 움직임(이동·전송·연결·교체·카운트·성장 등), 자막, 퀴즈까지.
4. **피드**: 설계도를 Remotion Player가 폰에서 실시간 모션으로 재생하고, 장면 타이밍에 맞춰 효과음을 합성.
5. 덱은 브라우저(localStorage)에 저장되어 "내 모션 보관함"에서 다시 볼 수 있음.

고정 템플릿이 아니라 개념마다 장면을 새로 설계하는 구조라서, 경제·과학·무역·IT 어떤 자료든 그 내용에 맞는 그림이 나온다.

## Vercel 배포

1. vercel.com/new 에서 이 GitHub 저장소를 Import (Framework는 Next.js 자동 인식)
2. **Environment Variables**에 추가
   - `ANTHROPIC_API_KEY` = console.anthropic.com 에서 만든 키 (필수)
3. Deploy

선택 환경변수

| 이름 | 기본값 | 설명 |
|---|---|---|
| `CLAUDE_MODEL` | `claude-opus-5-5` | 비용을 줄이려면 `claude-sonnet-5-5` |
| `CLAUDE_EFFORT_OUTLINE` | `low` | 개념 추출 단계의 사고량 |
| `CLAUDE_EFFORT_SCENE` | `medium` | 장면 설계 단계의 사고량 (`high`면 더 정교하지만 느림) |
| `NEXT_PUBLIC_MAX_CHARS` | `30000` | 한 번에 보낼 최대 글자 수 (넘으면 쪽 범위 선택 화면) |

API 라우트는 최대 300초까지 실행되도록 설정되어 있다(`maxDuration`).

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # ANTHROPIC_API_KEY 입력
npm run dev                  # http://localhost:3000
```

키 없이 화면만 확인하려면 `.env.local`에 `MOCK_AI=1` (예시 장면으로 흐름 재생).
`/lab` 페이지는 예시 장면을 정지 화면으로 한눈에 보는 개발용 페이지.

## 구조

```
src/app/api/{outline,scene,health}   Claude 호출 (NDJSON 스트리밍)
src/lib/prompts.ts                   분석가·연출가 프롬프트 + 예시 장면 3개
src/lib/schema.ts / normalize.ts     장면 설계도 스키마와 보정기
src/motion/                          설계도 → 프레임 타임라인 → 렌더러
src/components/                      홈 · 로딩 · 피드 · 퀴즈 · 보관함
```

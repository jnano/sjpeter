import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "성 베드로",
  description: "세종성베드로성당의 주보성인 성 베드로 사도의 생애",
};

const panels = [
  {
    num: 1,
    icon: "🎣",
    place: "갈릴래아 호숫가",
    year: "기원전 1세기 말",
    title: "어부 시몬",
    caption: "갈릴래아 벳사이다 출신의 어부 시몬. 형제 안드레아와 함께 그물을 던지며 하루하루를 살아갑니다.",
    bubbles: [
      { who: "시몬", text: "형, 오늘도 그물이 비었어요…" },
      { who: "안드레아", text: "괜찮아. 내일은 다르겠지." },
    ],
    color: "#1a365d",
    bgColor: "#e8f0ff",
    note: null,
  },
  {
    num: 2,
    icon: "✨",
    place: "갈릴래아 호숫가",
    year: "기원후 약 28년",
    title: "첫 만남",
    caption: "예수님이 호숫가를 걸으시다 그물을 던지는 시몬과 안드레아를 보십니다.",
    bubbles: [
      { who: "예수님 ✝", text: "나를 따라오너라. 내가 너희를 사람 낚는 어부가 되게 하겠다." },
      { who: "시몬", text: "(그물을 내려놓으며) …" },
    ],
    color: "#744210",
    bgColor: "#fffbeb",
    note: "마태오 4,18-20",
  },
  {
    num: 3,
    icon: "🪨",
    place: "필리피 카이사리아",
    year: "공생활 중반",
    title: "반석이라는 이름",
    caption: "예수님이 제자들에게 물으십니다. “너희는 나를 누구라고 하느냐?”",
    bubbles: [
      { who: "시몬", text: "스승님은 살아 계신 하느님의 아드님 그리스도이십니다." },
      { who: "예수님 ✝", text: "너는 베드로(반석)이다. 나는 이 반석 위에 내 교회를 세우겠다. 하늘 나라의 열쇠를 너에게 주겠다." },
    ],
    color: "#276749",
    bgColor: "#f0fff4",
    note: "마태오 16,15-19",
  },
  {
    num: 4,
    icon: "🌊",
    place: "갈릴래아 호수 위",
    year: "공생활 중반",
    title: "물 위를 걷다",
    caption: "밤바다를 걸어오시는 예수님을 본 베드로가 배에서 내려 물 위를 걷기 시작합니다.",
    bubbles: [
      { who: "베드로", text: "주님이시라면 저를 물 위로 오라고 명령해 주십시오!" },
      { who: "예수님 ✝", text: "오너라." },
      { who: "베드로", text: "(파도를 보자 겁이 나며) 주님, 살려주십시오!" },
    ],
    color: "#2b6cb0",
    bgColor: "#ebf8ff",
    note: "마태오 14,28-31",
  },
  {
    num: 5,
    icon: "🐓",
    place: "대사제의 뜰",
    year: "기원후 약 30년",
    title: "세 번의 부인",
    caption: "예수님이 잡히시던 밤, 베드로는 뜰에서 불을 쬐고 있었습니다.",
    bubbles: [
      { who: "하인", text: "당신도 그 사람과 함께 있었지요?" },
      { who: "베드로", text: "나는 그 사람을 모르오." },
      { who: "서술", text: "닭이 울었다. 베드로는 밖으로 나가 통곡하였다." },
    ],
    color: "#742a2a",
    bgColor: "#fff5f5",
    note: "루카 22,54-62",
  },
  {
    num: 6,
    icon: "💛",
    place: "티베리아스 호숫가",
    year: "부활 후",
    title: "사랑하느냐?",
    caption: "부활하신 예수님이 호숫가에서 불을 피워 생선을 구워주십니다. 그리고 세 번 물으십니다.",
    bubbles: [
      { who: "예수님 ✝", text: "요한의 아들 시몬아, 네가 나를 사랑하느냐?" },
      { who: "베드로", text: "주님, 주님께서는 모든 것을 아십니다. 제가 주님을 사랑한다는 것을 주님께서 알고 계십니다." },
      { who: "예수님 ✝", text: "내 양들을 돌보아라." },
    ],
    color: "#553c9a",
    bgColor: "#faf5ff",
    note: "요한 21,15-17",
  },
  {
    num: 7,
    icon: "🕊️",
    place: "예루살렘",
    year: "오순절 — 기원후 약 30년",
    title: "성령 강림",
    caption: "오순절에 성령이 강림하자 베드로가 군중 앞에 나서 담대하게 선포합니다.",
    bubbles: [
      { who: "베드로", text: "여러분이 십자가에 못 박은 이 예수님을 하느님께서 주님과 그리스도로 삼으셨습니다!" },
      { who: "군중", text: "그러면 우리는 어떻게 해야 합니까?" },
      { who: "베드로", text: "회개하고 세례를 받으십시오." },
    ],
    color: "#744210",
    bgColor: "#fffbeb",
    note: "사도 2,14-41 — 그날 세례 받은 이 약 3천 명",
  },
  {
    num: 8,
    icon: "✝️",
    place: "로마",
    year: "기원후 64-68년경",
    title: "거꾸로 매달린 십자가",
    caption: "네로 황제의 박해 속에서 베드로는 십자가형을 선고받습니다. 그는 예수님과 같은 방식으로 죽을 수 없다며 거꾸로 매달리기를 청합니다.",
    bubbles: [
      { who: "베드로", text: "저는 스승님과 같은 방식으로 죽을 자격이 없습니다. 거꾸로 매달아 주십시오." },
      { who: "서술", text: "그렇게 베드로는 순교하였고, 그 자리에 지금의 성 베드로 대성당이 세워졌다." },
    ],
    color: "#1a365d",
    bgColor: "#f0f4ff",
    note: "축일: 6월 29일",
  },
];

function SpeechBubble({ who, text, isNarration }: { who: string; text: string; isNarration?: boolean }) {
  if (isNarration || who === "서술") {
    return (
      <div className="my-2 px-3 py-2 bg-gray-800/90 text-white text-xs leading-relaxed rounded italic">
        {text}
      </div>
    );
  }
  const isJesus = who.includes("예수님");
  return (
    <div className={`my-2 rounded-2xl px-3 py-2 text-xs leading-relaxed relative ${
      isJesus
        ? "bg-amber-50 border-2 border-amber-400 text-amber-900"
        : "bg-white border border-gray-300 text-gray-800"
    }`}>
      <span className={`block text-[10px] font-bold mb-0.5 ${isJesus ? "text-amber-600" : "text-[var(--color-primary)]"}`}>
        {who}
      </span>
      {text}
    </div>
  );
}

export default function SaintPage() {
  return (
    <>
      <PageHeader group="성당 소개" title="성 베드로" subtitle="세종성베드로성당의 주보성인 — 만화로 보는 일대기" />

      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* 도입부 */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-3 bg-[var(--color-primary)] text-white px-6 py-3 rounded-full text-sm font-serif">
            <span className="text-xl">🔑</span>
            <span>어부에서 교회의 반석으로 — 시몬 베드로의 이야기</span>
            <span className="text-xl">🔑</span>
          </div>
        </div>

        {/* 만화 패널 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-2 border-gray-800 rounded-xl overflow-hidden shadow-2xl">
          {panels.map((panel, i) => (
            <div
              key={panel.num}
              className={`border-gray-800
                ${i % 2 === 0 ? "md:border-r-2" : ""}
                ${i < panels.length - 1 ? "border-b-2" : ""}
                ${i >= panels.length - 2 ? "md:border-b-0" : ""}
              `}
              style={{ backgroundColor: panel.bgColor }}
            >
              {/* 패널 헤더 */}
              <div
                className="flex items-center justify-between px-4 py-2 text-white text-xs font-bold"
                style={{ backgroundColor: panel.color }}
              >
                <span className="opacity-60">#{panel.num}</span>
                <span className="tracking-wide uppercase text-[10px]">{panel.place}</span>
                <span className="opacity-60 text-[10px]">{panel.year}</span>
              </div>

              {/* 패널 본문 */}
              <div className="p-4">
                {/* 씬 제목 + 아이콘 */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-3xl">{panel.icon}</span>
                  <h3
                    className="font-serif font-bold text-base leading-tight"
                    style={{ color: panel.color }}
                  >
                    {panel.title}
                  </h3>
                </div>

                {/* 서술 캡션 */}
                <p className="text-xs text-gray-600 leading-relaxed mb-3 bg-white/60 rounded-lg px-3 py-2 border-l-4" style={{ borderColor: panel.color }}>
                  {panel.caption}
                </p>

                {/* 말풍선들 */}
                <div className="space-y-1">
                  {panel.bubbles.map((b, j) => (
                    <SpeechBubble key={j} who={b.who} text={b.text} />
                  ))}
                </div>

                {/* 성경 출처 */}
                {panel.note && (
                  <p className="mt-3 text-[10px] text-right italic" style={{ color: panel.color }}>
                    — {panel.note}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 마무리 인용 */}
        <div className="mt-10 bg-[var(--color-primary)] text-white rounded-xl p-8 text-center">
          <p className="text-3xl mb-4">✝</p>
          <blockquote className="font-serif text-lg leading-loose mb-3">
            &ldquo;너는 베드로이다. 나는 이 반석 위에 내 교회를 세우겠다.&rdquo;
          </blockquote>
          <p className="text-white/60 text-sm">마태오 16,18</p>
          <div className="mt-6 pt-6 border-t border-white/20 text-white/70 text-sm leading-loose">
            <p>성 베드로 사도 축일 <span className="text-white font-medium">6월 29일</span></p>
            <p className="text-xs mt-1 text-white/50">성 바오로 사도 축일과 함께 지냅니다</p>
          </div>
        </div>

      </div>
    </>
  );
}

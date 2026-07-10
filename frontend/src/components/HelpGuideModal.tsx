import { useEffect, useRef, useState } from 'react';
import { X, GripHorizontal } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  onClose: () => void;
}

interface Section {
  id: string;
  emoji: string;
  title: string;
  body: React.ReactNode;
}

function Ex({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3">
      <p className="mb-1 text-[11px] font-semibold text-primary">예시</p>
      <div className="text-xs leading-relaxed text-foreground">{children}</div>
    </div>
  );
}

function Theory({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-2 rounded-lg border border-sky-400/30 bg-sky-400/5 p-3">
      <p className="mb-1 text-[11px] font-semibold text-sky-500">이론 — 왜 이런 게 필요할까요</p>
      <div className="text-xs leading-relaxed text-foreground">{children}</div>
    </div>
  );
}

function Field({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 rounded-md border border-border/70 pl-2.5">
      <p className="border-l-2 border-primary/50 py-1 pl-2 text-[12px] font-semibold text-foreground">{name}</p>
      <div className="px-2 pb-1.5 text-xs leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground">{children}</code>;
}

const SECTIONS: Section[] = [
  {
    id: 'intro',
    emoji: '👋',
    title: '처음 오셨나요',
    body: (
      <div className="space-y-3 text-sm leading-relaxed">
        <p>
          이 프로그램(<b>QA-Server</b>)은 <b>사이트나 앱의 API가 잘 동작하는지 자동으로 확인해주는 도구</b>예요.
        </p>
        <Theory>
          <p>
            <b>API</b>란 "화면 뒤에서 서버에 요청을 보내고 응답을 받는 통로"예요. 예를 들어 로그인 버튼을 누르면
            화면 뒤에서 서버에 <Code>POST /api/auth/login</Code> 같은 요청이 날아가고, 서버는{' '}
            <Code>{'{ "success": true, "token": "abc123" }'}</Code> 같은 응답을 돌려줘요.
            사람이 매번 버튼을 눌러서 눈으로 확인하는 대신, 이 프로그램이 그 요청/응답을 대신 보내고 "정상인지"를 자동으로 판단해줘요.
          </p>
        </Theory>
        <p>왼쪽 <b>사이드바</b>에서 프로젝트(=확인하려는 서비스 하나)를 고르고, 그 안의 메뉴를 눌러가며 사용해요. 순서대로 따라 하면 됩니다:</p>
        <ol className="ml-4 list-decimal space-y-1">
          <li>사이드바에서 프로젝트를 만들거나 선택한다</li>
          <li>"케이스 관리"에서 확인하고 싶은 API 호출을 하나씩 등록한다</li>
          <li>"자동 실행"에서 등록한 케이스를 실제로 돌려본다</li>
          <li>"실행 히스토리"에서 결과를 확인한다</li>
        </ol>
        <p className="text-xs text-muted-foreground">
          이 창은 QA 화면을 가리지 않는 <b>플로팅 창</b>이에요. 상단 바를 마우스로 눌러 끌면 원하는 위치로 옮길 수 있고,
          이 창을 열어둔 채로 뒤에 있는 실제 화면을 그대로 클릭하고 조작할 수 있어요.
        </p>
      </div>
    ),
  },
  {
    id: 'network',
    emoji: '🌐',
    title: 'API 통신, 하나도 몰라도 되게 풀어보기',
    body: (
      <div className="space-y-3 text-sm leading-relaxed">
        <p>
          이 페이지는 용어를 최대한 안 쓰고, 실제 우리가 아는 것에 빗대서 "요청/응답이 뭔지"부터 차근차근 설명해요.
          이 프로그램의 모든 화면·설정값은 결국 이 원리 하나를 반복해서 쓰는 것뿐이에요.
        </p>

        <h4 className="text-sm font-bold text-foreground">1. 요청과 응답 = 편지 보내고 답장 받기</h4>
        <p>
          우리가 앱에서 버튼을 누르면, 화면 뒤에서 <b>"편지 한 통"</b>이 서버로 날아가고, 서버는 그 편지를 읽고{' '}
          <b>"답장 한 통"</b>을 돌려보내요. 이 편지 왕복 한 번이 API 호출 하나예요.
        </p>
        <Ex>
          로그인 버튼을 누르면: 나 → 서버 "이 아이디/비밀번호로 로그인해줘" (편지) → 서버 → 나 "확인했어, 여기 출입증 줄게" (답장).
          이 편지/답장 내용을 사람이 매번 눈으로 확인하는 대신, 이 프로그램이 대신 보내고 "답장이 정상인지"를 자동으로 판단해줘요.
        </Ex>

        <h4 className="text-sm font-bold text-foreground">2. 주소 = 어디로 보낼 편지인지</h4>
        <p>
          편지를 보내려면 받는 사람 주소가 필요하듯, 서버에도 주소가 있어요. 이 프로그램에서{' '}
          <b>서버 주소</b>(예: <Code>http://localhost:8090</Code>)와 <b>엔드포인트 경로</b>(예: <Code>/api/payments</Code>)를
          붙이면 <Code>http://localhost:8090/api/payments</Code>라는 전체 주소가 완성돼요. 이게 편지를 보낼 최종 주소예요.
        </p>

        <h4 className="text-sm font-bold text-foreground">3. 메서드 = 이 편지로 뭘 해달라는 건지</h4>
        <p>
          같은 주소로 편지를 보내도 "이거 좀 보여줘" 인지 "이거 새로 만들어줘"인지에 따라 서버가 다르게 행동해야겠죠.
          그 "무엇을 해달라"를 나타내는 게 메서드예요.
        </p>
        <ul className="ml-4 list-disc space-y-1">
          <li><Code>GET</Code> — "그냥 보여줘" (조회, 서버에 아무것도 안 바뀜)</li>
          <li><Code>POST</Code> — "이거 새로 만들어줘" (예: 회원가입, 주문 생성)</li>
          <li><Code>PUT</Code> — "이거 통째로 바꿔줘" (기존 걸 전부 새 내용으로 덮어씀)</li>
          <li><Code>PATCH</Code> — "이 부분만 바꿔줘" (일부 필드만 수정)</li>
          <li><Code>DELETE</Code> — "이거 지워줘"</li>
        </ul>

        <h4 className="text-sm font-bold text-foreground">4. 헤더 vs 바디 = 편지 봉투 겉면 vs 편지 내용물</h4>
        <p>
          편지에는 <b>봉투 겉면에 적는 정보</b>(보내는 사람, 편지 종류)와 <b>봉투 안 내용물</b>이 따로 있죠. API도 똑같아요.
        </p>
        <ul className="ml-4 list-disc space-y-1">
          <li><b>헤더</b>: 이 요청이 누구 것인지, 어떤 형식인지 같은 부가정보. 예: <Code>Authorization = Bearer abc123</Code> ("나는 이 출입증을 가진 사람이야")</li>
          <li><b>바디</b>: 진짜 전달하려는 내용물. 예: 회원가입이면 <Code>{'{ "id": "user1", "password": "1234" }'}</Code></li>
          <li><b>URL 파라미터</b>: 주소 뒤에 <Code>?</Code>를 붙여 옵션을 다는 것. 예: <Code>/api/products?page=1</Code> ("1페이지만 보여줘")</li>
        </ul>

        <h4 className="text-sm font-bold text-foreground">5. 인증 헤더 (Authorization) = 출입증 보여주기</h4>
        <p>
          로그인에 성공하면 서버가 <b>토큰</b>이라는 "임시 출입증"을 줘요. 이후에는 요청마다 이 출입증을 헤더에 넣어서
          "나 로그인한 사람이야"라고 매번 보여줘야 해요. 보통 <Code>Authorization = Bearer (토큰값)</Code> 형태로 넣는데,{' '}
          <b>Bearer</b>는 그냥 "이 토큰을 들고 있는 사람은 그냥 통과시켜줘"라는 뜻의 약속된 표시예요 (별다른 의미는 없어요).
        </p>

        <h4 className="text-sm font-bold text-foreground">6. 상태코드 = 답장 봉투에 찍힌 도장</h4>
        <p>답장이 오면 그 결과를 세 자리 숫자로 요약해서 알려줘요. 앞자리만 봐도 대략 감이 와요:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li><Code>2xx</Code> (예: 200, 201, 204) — "성공했어"</li>
          <li><Code>4xx</Code> (예: 400, 401, 403, 404) — "네가 보낸 요청이 잘못됐어" (잘못된 값, 로그인 안 함, 없는 주소 등)</li>
          <li><Code>5xx</Code> (예: 500) — "서버 쪽에서 문제가 생겼어" (내 요청은 문제 없었는데 서버가 처리 중 에러남)</li>
        </ul>

        <h4 className="text-sm font-bold text-foreground">7. JSON = 답장 내용물을 정리하는 규칙</h4>
        <p>
          답장 내용물은 보통 <b>JSON</b>이라는 형식으로 와요. 그냥 "이름: 값" 짝을 중괄호로 묶어놓은 표기법이에요.
        </p>
        <Ex>
          <Code>{'{ "success": true, "data": { "status": "APPROVED" } }'}</Code><br />
          → "success라는 이름의 값은 true", "data라는 이름 안에 또 status라는 이름의 값은 APPROVED" 라는 뜻.
          이렇게 값 안에 값이 또 들어있는(중첩된) 구조를 자유롭게 만들 수 있어요.
          이 프로그램에서 "판정 조건"의 경로(<Code>data.status</Code>)는 이 중첩 구조를 점(.)으로 따라 들어가는 표기예요.
        </Ex>

        <h4 className="text-sm font-bold text-foreground">8. 이 모든 게 왜 "판정 조건"으로 이어질까요</h4>
        <p>
          결국 이 프로그램이 하는 일은: 편지(요청)를 만들어 보내고 → 답장(응답)을 받아서 → 그 답장의 도장(상태코드)이나
          내용물(JSON) 안의 특정 값이 우리가 기대한 값과 같은지 자동으로 대조하는 것뿐이에요. 그 "대조 규칙"이 바로
          왼쪽 목록의 "판정 조건"이에요.
        </p>
      </div>
    ),
  },
  {
    id: 'project',
    emoji: '📁',
    title: '프로젝트',
    body: (
      <div className="space-y-3 text-sm leading-relaxed">
        <p>
          <b>프로젝트</b>는 "내가 테스트하고 싶은 서비스 하나"예요. 프로젝트마다 케이스·카테고리·저장된 값·암호화 설정이
          전부 따로 관리돼서 서로 섞이지 않아요.
        </p>
        <Field name="사이드바 상단 [+ 신규 프로젝트] 버튼">
          누르면 이름 입력칸이 나타남 → 이름 입력 후 <Code>추가</Code> 버튼 또는 Enter → 새 프로젝트가 만들어지고 바로 선택된 상태가 됨
        </Field>
        <Field name="사이드바 프로젝트 목록의 폴더 아이콘(📁) 줄">
          클릭하면 그 프로젝트가 "현재 작업 중인 프로젝트"로 전환됨 (오른쪽 위 헤더에 프로젝트 이름이 표시됨). 왼쪽의 <Code>›</Code> 화살표를 누르면 하위 메뉴가 펼쳐짐/접힘
        </Field>
        <Ex>
          "쇼핑몰 서비스"와 "사내 관리자 페이지"를 둘 다 테스트하고 싶다면, 프로젝트를 2개 만들어서 각각 따로 케이스를 등록하면 됩니다.
          한 프로젝트의 저장된 값(헤더 토큰 등)이 다른 프로젝트에 섞여 들어가는 일은 없어요.
        </Ex>
      </div>
    ),
  },
  {
    id: 'mgr',
    emoji: '📋',
    title: '케이스 관리',
    body: (
      <div className="space-y-2 text-sm leading-relaxed">
        <p>
          <b>케이스</b>는 "이 API를 이렇게 호출하면, 이런 응답이 와야 정상이다"라는 테스트 항목 하나예요.
          왼쪽 메뉴 <b>케이스 관리</b> 화면 우측 상단의 <Code>+ 케이스 추가</Code> 버튼을 누르면 등록 창이 열려요.
        </p>
        <p className="text-xs font-semibold text-foreground">등록 창 맨 위 — 시작 방식 선택</p>
        <Field name="[카테고리로 선택하기] / [직접입력] 탭">
          <b>카테고리로 선택하기</b>: 아래에 카테고리 드롭다운이 나타나고, 카테고리를 고르면 그 카테고리에 미리 등록해둔
          헤더·파라미터·서버주소·바디값이 <b>자동으로 채워짐</b> (저장된 값 관리에서 카테고리 지정해둔 것들).<br />
          <b>직접입력</b>: 자동 채움 없이 아래 항목을 전부 손으로 채움. 두 탭을 왔다갔다 해도 각 모드에서 입력한 값은 유지돼요.
        </Field>
        <p className="text-xs font-semibold text-foreground">기본 정보</p>
        <Field name="케이스 ID">자동으로 <Code>TC-001</Code>, <Code>TC-002</Code>처럼 다음 번호가 채워짐. 새로 만들 때만 수정 가능, 기존 케이스 수정 중엔 변경 불가</Field>
        <Field name="유형 (Positive / Negative)">
          <b>Positive</b> = 정상적인 값으로 호출해서 "성공"이 나오는지 확인하는 케이스.<br />
          <b>Negative</b> = 일부러 잘못된 값(빈 비밀번호, 없는 상품ID 등)을 넣어서 "정상적으로 실패(400/401 등 에러)"가 나오는지 확인하는 케이스
        </Field>
        <Field name="테스트 이름">이 케이스가 뭘 확인하는지 사람이 알아볼 수 있게 적는 설명. 예: <Code>로그인 성공 - 정상 아이디/비밀번호</Code></Field>
        <p className="text-xs font-semibold text-foreground">API 요청 설정</p>
        <Field name="서버 주소 (baseUrl)">
          비워두면 프로젝트 전역 설정을 사용. 입력창을 클릭하면 "저장된 값 관리"에 등록해둔 서버 URL 목록이 자동완성으로 뜸.<br />
          예: <Code>http://localhost:8090</Code>
        </Field>
        <Field name="메서드 드롭다운">GET(조회) / POST(생성) / PUT(전체수정) / PATCH(일부수정) / DELETE(삭제) 중 선택</Field>
        <Field name="엔드포인트 경로">API 주소 뒷부분. 예: <Code>{'/api/users/{id}'}</Code> — 여기도 "저장된 값 관리"의 경로 목록이 자동완성으로 뜸</Field>
        <Field name="성공 상태코드">정상일 때 기대하는 HTTP 상태코드. 보통 <Code>200</Code>(성공), <Code>201</Code>(생성됨), <Code>204</Code>(성공+응답없음), 에러 테스트면 <Code>400</Code>/<Code>401</Code>/<Code>404</Code> 등</Field>
        <p className="text-xs font-semibold text-foreground">
          [요청 세부 설정 — 헤더 · 파라미터 · 전송 데이터 · 성공 조건] 버튼을 누르면 펼쳐지는 부분
        </p>
        <Field name="요청 헤더 KVEditor">
          <Code>+ 추가</Code> 누르면 key/value 입력칸 한 줄이 생김. 오른쪽 <Code>✕</Code>로 그 줄 삭제.
          위쪽 "저장된 값에서 추가" 드롭다운으로 미리 등록해둔 헤더를 바로 가져올 수도 있음.<br />
          예: key <Code>Authorization</Code>, value <Code>Bearer abc123</Code>
        </Field>
        <Field name="URL 파라미터 KVEditor">주소 뒤에 <Code>?key=value</Code>로 붙는 값. 헤더와 입력 방식 동일</Field>
        <Field name="요청 바디 — 카테고리 모드 vs 직접입력">
          위에서 "카테고리로 선택하기"를 골랐다면 KV(키/값) 편집기로 필드를 하나씩 추가.
          "직접입력"이면 JSON 텍스트를 통째로 입력하는 칸이 나타남 (예: <Code>{'{ "userId": "u1", "amount": 10000 }'}</Code>). 숫자처럼 보이는 값은 JSON 숫자로 자동 저장돼요.
        </Field>
        <Field name="암호화 호출 체크박스">
          켜면 이 케이스가 암호화된 API를 부르게 됨. 자세한 내용은 왼쪽 목록의 "암호화 설정" 항목 참고
        </Field>
        <Field name="성공 판정 조건 (AssertionEditor)">
          <Code>+ 추가</Code>로 조건 한 줄 추가. 대상(상태코드/바디JSON/바디텍스트/헤더) → (필요시) 경로 → 연산자 → (필요시) 기대값 순서로 채움.
          자세한 설명은 왼쪽 목록의 "판정 조건" 항목 참고
        </Field>
        <p className="text-xs font-semibold text-foreground">나머지 항목</p>
        <Field name="기대 결과">사람이 읽는 설명용 텍스트. 실제 판정에는 쓰이지 않고 문서화 용도</Field>
        <Field name="카테고리 드롭다운">이 케이스를 어느 카테고리(폴더)에 넣을지. 케이스 관리 화면 좌측 하단 "📁 카테고리 관리"에서 카테고리 자체를 추가/이름변경/삭제할 수 있음</Field>
        <Field name="하단 [추가] 버튼 → 확인 화면 → [추가 확정]">
          <Code>추가</Code>를 누르면 바로 저장되지 않고, 실제로 호출될 최종 요청 내용(JSON)을 미리 보여주는 확인 화면이 떠요.
          내용을 확인하고 <Code>추가 확정</Code>을 눌러야 진짜 저장돼요. 잘못됐으면 <Code>수정으로 돌아가기</Code>로 다시 고칠 수 있어요.
        </Field>
      </div>
    ),
  },
  {
    id: 'assertion',
    emoji: '✅',
    title: '판정 조건',
    body: (
      <div className="space-y-2 text-sm leading-relaxed">
        <Theory>
          서버가 응답을 보내줘도, 그 안의 <b>어떤 값이 어떤 조건을 만족해야 "성공"으로 칠지</b>는 우리가 직접 정해야 해요.
          아무 조건도 안 넣으면 상태코드(200 등)만 맞으면 통과로 처리돼요.
        </Theory>
        <Field name="대상 (target) 드롭다운">
          <b>상태코드</b>: 응답 코드 자체 (=, &gt;, &lt;만 선택 가능).<br />
          <b>바디 JSON</b>: 응답 JSON 안의 특정 값 하나. 경로 입력칸이 추가로 나타남 (모든 연산자 가능).<br />
          <b>바디 텍스트</b>: 응답 전체를 그냥 글자로 봤을 때 특정 단어가 있는지 (=, 포함, 미포함만 가능 — "존재하는지"는 항상 참이라 의미가 없어서 뺐어요).<br />
          <b>헤더</b>: 응답 헤더에 특정 값이 있는지. 경로 칸에 헤더 이름을 입력 (모든 연산자 가능)
        </Field>
        <Field name="경로 (path) 입력칸 — 바디 JSON / 헤더일 때만 나타남">
          바디 JSON이면 점(.)으로 중첩된 값을 찾아 들어감. 배열은 <Code>[번호]</Code>로 접근.<br />
          예: 응답이 <Code>{'{ "data": { "cards": [{ "cardId": "c1" }] } }'}</Code> 라면 경로는 <Code>data.cards[0].cardId</Code>.
          자주 쓰는 경로는 "저장된 값 관리"의 "판정조건 경로"에 등록해두면 자동완성으로 떠요
        </Field>
        <Field name="연산자 드롭다운">
          <Code>=</Code> 완전히 같음 · <Code>포함</Code> 그 글자가 들어있음 · <Code>미포함</Code> 안 들어있음 ·{' '}
          <Code>존재</Code> 값이 null/빈값이 아님 · <Code>미존재</Code> 값이 없거나 null · <Code>&gt;</Code>/<Code>&lt;</Code> 숫자 크기 비교
        </Field>
        <Field name="기대값 입력칸">= , &gt;, &lt;, 포함, 미포함일 때만 나타남. 존재/미존재는 값 비교가 필요 없어서 안 나타남</Field>
        <Ex>
          결제 응답이 <Code>{'{ "success": true, "data": { "status": "APPROVED" } }'}</Code> 라면:<br />
          대상 <Code>바디 JSON</Code> → 경로 <Code>data.status</Code> → 연산자 <Code>=</Code> → 기대값 <Code>APPROVED</Code>.<br />
          조건을 여러 개 추가하면 <b>전부 다 만족</b>해야 통과예요 (하나라도 틀리면 실패).
        </Ex>
      </div>
    ),
  },
  {
    id: 'presets',
    emoji: '🔑',
    title: '저장된 값 관리',
    body: (
      <div className="space-y-2 text-sm leading-relaxed">
        <p>케이스를 여러 개 만들다 보면 같은 헤더·주소·값을 계속 반복 입력하게 돼요. 여기 한 번 등록해두면 골라 쓰기만 하면 됩니다.</p>
        <Field name="화면 상단 카테고리 필터 탭 (전체 / 카테고리 공통 / 회원인증 / 결제 ...)">누르면 그 카테고리에 속한 값만 아래 목록에 보임</Field>
        <Field name="[+ 추가] 버튼">누르면 등록 폼이 펼쳐짐</Field>
        <Field name="종류 선택 버튼 6개 (헤더 / 파라미터 / 서버 URL / 엔드포인트 경로 / 바디 필드 / 판정조건 경로)">
          <b>헤더</b> 예: key <Code>Authorization</Code>, value <Code>Bearer {'{{authToken}}'}</Code><br />
          <b>파라미터</b> 예: key <Code>page</Code>, value <Code>1</Code><br />
          <b>서버 URL</b> 예: <Code>http://localhost:8090</Code><br />
          <b>엔드포인트 경로</b> 예: <Code>/api/payments</Code><br />
          <b>바디 필드</b> 예: key <Code>deviceId</Code>, value <Code>web-app-01</Code><br />
          <b>판정조건 경로</b> 예: <Code>data.status</Code> (판정 조건 입력 시 자동완성 후보로 등장)
        </Field>
        <Field name="이름 (식별용) / 적용 카테고리 / 키(있으면) / 값 입력칸">
          <b>적용 카테고리</b>를 지정하면, 케이스 등록 시 "카테고리로 선택하기" 탭에서 그 카테고리를 고르는 순간 이 값이 자동으로 채워져요.
          "카테고리 공통"으로 두면 자동 적용은 안 되고, 언제나 수동으로 골라서 써야 해요.
          드롭다운 맨 아래 <Code>+ 새 카테고리 만들기</Code>로 그 자리에서 카테고리를 새로 만들 수도 있어요
        </Field>
        <Field name="목록 각 항목의 연필(✎) / 휴지통(🗑) 아이콘">연필은 수정 모드로 전환, 휴지통은 바로 삭제 (참조하던 케이스에는 영향 없음)</Field>
        <Field name="종류별 섹션 헤더 (아코디언)">헤더 부분을 클릭하면 그 종류의 카드 목록이 접히거나 펼쳐짐. 접은 상태는 저장되어 다음에 열어도 유지됨</Field>
        <Ex>
          "결제" 카테고리에 헤더 <Code>Authorization = Bearer {'{{authToken}}'}</Code>를 저장해두면,
          결제 카테고리로 케이스를 새로 만들 때마다 이 헤더가 자동으로 들어가서 매번 다시 입력할 필요가 없어요.
        </Ex>
      </div>
    ),
  },
  {
    id: 'auto',
    emoji: '🚀',
    title: '자동 실행',
    body: (
      <div className="space-y-2 text-sm leading-relaxed">
        <p>만들어둔 케이스를 실제로 호출해서 결과를 확인하는 화면. 두 가지 실행 방식이 있어요.</p>
        <Field name="개별 케이스 목록의 체크박스">체크한 케이스들을 각자 따로, 서로 영향 없이 동시에(병렬로) 실행</Field>
        <Field name="플로우 — 여러 케이스를 순서대로 이어 실행">
          <Theory>
            로그인 → 상품조회 → 결제처럼 <b>앞 단계 결과가 뒤 단계에 필요한 경우</b>가 있어요. 개별 실행은 순서를 보장하지 않고
            값도 못 넘기기 때문에, 이런 시나리오는 "플로우"로 묶어야 해요.
          </Theory>
          [+ 새 플로우] 버튼으로 만들기 시작
        </Field>
        <p className="text-xs font-semibold text-foreground">플로우 만들기 창</p>
        <Field name="플로우 이름 입력칸">예: <Code>결제 메인 플로우</Code></Field>
        <Field name="왼쪽 [케이스 선택] 목록">케이스를 클릭하면 체크(■)되면서 오른쪽 실행 순서 목록에 추가됨. 다시 클릭하면 제외</Field>
        <Field name="오른쪽 [실행 순서] 목록의 ▲▼ 버튼">클릭한 케이스가 추가된 순서대로 나열됨. ▲▼로 순서를 바꿀 수 있음 (맨 위/아래는 반대쪽 화살표 비활성화)</Field>
        <Field name="각 스텝 아래 [추출 JSON path] / [변수명] 입력칸 (마지막 스텝 제외 전부에 있음)">
          이 스텝의 응답에서 값을 하나 뽑아, 이후 스텝의 엔드포인트/헤더/바디 안에 <Code>{'{{변수명}}'}</Code> 형태로 쓸 수 있게 해줘요.<br />
          예: 추출 JSON path에 <Code>data.token</Code>, 변수명에 <Code>authToken</Code> 입력 → 이후 스텝 헤더에{' '}
          <Code>Authorization = Bearer {'{{authToken}}'}</Code> 라고 적어두면 실행 시 자동으로 실제 토큰값으로 바뀜
        </Field>
        <Field name="[취소] / [저장] 버튼">이름과 스텝이 1개 이상 있어야 저장 가능</Field>
        <Ex>
          "약관동의 → 인증 → 조회 → 결제" 플로우: 1단계(인증) 응답이{' '}
          <Code>{'{ "data": { "token": "tok_9f2" } }'}</Code> 라면, 1단계에 추출 경로 <Code>data.token</Code> · 변수명{' '}
          <Code>authToken</Code>을 지정. 2단계(조회) 헤더에 <Code>Authorization = Bearer {'{{authToken}}'}</Code>라고 써두면
          실행할 때 자동으로 <Code>Bearer tok_9f2</Code>로 채워져서 인증이 이어져요.
        </Ex>
        <p className="text-xs text-muted-foreground">실행은 사람이 버튼을 눌러야 시작돼요 — 예약/자동 스케줄링 기능은 없어요.</p>
      </div>
    ),
  },
  {
    id: 'encryption',
    emoji: '🔒',
    title: '암호화 설정',
    body: (
      <div className="space-y-2 text-sm leading-relaxed">
        <Theory>
          <p className="mb-2">
            결제 정보처럼 민감한 데이터는 중간에서 누가 훔쳐봐도 못 알아보게 <b>암호화</b>해서 주고받아요.
            개념을 하나씩 풀어보면:
          </p>
          <ul className="ml-4 list-disc space-y-1.5">
            <li>
              <b>비밀 키</b>: 자물쇠를 잠그고 여는 데 쓰는 "열쇠"예요. 이 프로그램은 같은 열쇠로 잠그고 열 수 있는 방식(대칭키
              암호화)을 써요 — 그래서 서버와 이 프로그램 둘 다 <b>완전히 똑같은 키 값</b>을 갖고 있어야만 서로 암호화/복호화가 성공해요.
              한쪽만 키를 알면 안 되고, 미리 양쪽에 같은 값을 심어둬야 해요 (이 프로그램에서는 "암호화 설정" 메뉴에 등록한 키를
              대상 서버 쪽 설정과 동일하게 맞춰야 해요).
            </li>
            <li>
              <b>AES-256</b>: 그 "열쇠로 잠그는 방식(알고리즘)"의 이름이에요. 256은 열쇠 길이가 256비트(=32바이트)라는
              뜻인데, 길이가 길수록 남이 무작위로 추측해서 열 가능성이 사실상 0에 가까워져요.
            </li>
            <li>
              <b>GCM</b>: 잠그는 방식(모드)이면서 동시에 <b>"누가 중간에 몰래 내용을 바꿔치기했는지 감지하는 기능"</b>까지
              포함해요. 잠글 때 끝에 "인증 태그"라는 16바이트 확인용 값이 붙는데, 복호화할 때 이 값이 안 맞으면
              (중간에 위변조됐다는 뜻이므로) 그냥 복호화 자체를 실패시켜요. 그냥 암호화가 아니라 "암호화 + 위변조 감지"인 거예요.
            </li>
            <li>
              <b>IV</b>(초기화 벡터): 같은 내용을 같은 키로 암호화해도 <b>매번 다른 암호문이 나오게</b> 섞어주는 임의의 값(12바이트)이에요.
              IV가 없으면 "같은 내용은 항상 같은 암호문"이 되어버려서, 암호문만 보고도 "어, 이거 지난번이랑 같은 요청이네"
              하고 패턴을 추측당할 수 있어요. 그래서 매 호출마다 새로 무작위로 만들고, 열쇠처럼 비밀로 숨기지 않고 그냥
              암호문과 같이 보내도 돼요 (이 프로그램은 이 과정을 전부 자동으로 처리하므로 직접 만들거나 입력할 필요는 없어요).
            </li>
            <li>
              <b>Base64</b>: 암호화된 결과물은 사람이 못 읽는 이상한 이진 데이터라서, 그걸 JSON 텍스트 안에 안전하게 담을 수
              있는 글자(영문/숫자 조합)로 바꿔주는 표기법이에요. 암호를 한 번 더 거는 게 아니라 그냥 "전송하기 좋은 글자로
              변환"하는 것뿐이라, Base64 문자열 자체를 봐도 원래 값을 바로 알 수는 없지만 "암호화"라고 부르진 않아요.
            </li>
          </ul>
        </Theory>
        <Field name="암호화 설정 메뉴의 [+ 추가] 버튼">누르면 이름을 입력받고, AES-256용 32바이트 키를 Base64 문자열로 자동 생성해줌 (직접 만들 필요 없음)</Field>
        <Field name="케이스 등록 창의 [암호화 호출] 체크박스">체크하면 아래에 세부 설정이 나타남</Field>
        <Field name="암호화 설정 선택 드롭다운">위에서 만들어둔 키 중 이 케이스에 쓸 키를 고름</Field>
        <Field name="암호화 범위 — [바디 전체] / [파라미터 단위] 버튼">
          <b>바디 전체</b>: 요청 바디를 통째로 암호화해서 <Code>{'{ "encData": "..." }'}</Code> 형태로 보냄.<br />
          <b>파라미터 단위</b>: 아래 체크박스로 고른 필드만 <Code>{'{ "cardNumber_enc": "...", "userId": "u1" }'}</Code> 처럼 개별 암호화하고 나머지는 평문 그대로 보냄
        </Field>
        <Field name="암호화할 필드 선택 체크박스 (파라미터 단위일 때만)">요청 바디에 등록된 필드 목록이 나타나고, 체크한 것만 암호화됨</Field>
        <Ex>
          평문 주소가 <Code>/api/payments</Code>라면 암호화 버전은 <Code>/secure/api/payments</Code>로 따로 있어요.
          암호화 케이스로 등록하면 자동으로 이 <Code>/secure</Code> 주소로 호출되고 응답도 자동 복호화돼서 판정 조건에 사용돼요.
          반대로 평문 그대로 이 주소를 호출하면 "암호화 필요" 에러가 나는 것까지 테스트할 수 있어요 (일부러 그렇게 나눠놨어요).
        </Ex>
      </div>
    ),
  },
  {
    id: 'suites',
    emoji: '🗂️',
    title: 'Test Suite',
    body: (
      <div className="space-y-2 text-sm leading-relaxed">
        <p>케이스·플로우가 많아지면 "이번엔 결제 관련된 것만 돌리자" 같은 상황이 생겨요. 원하는 것들을 묶어 이름 붙여 저장하는 화면이에요.</p>
        <Field name="[+ Suite 추가] 버튼">이름/설명 입력 후 포함할 케이스·플로우를 체크해서 저장</Field>
        <Ex>
          "결제 정기점검 세트"라는 이름으로 결제 관련 케이스 10개 + 플로우 1개를 묶어두면, 다음 점검 때 이 세트만 골라 한 번에 실행할 수 있어요.
        </Ex>
      </div>
    ),
  },
  {
    id: 'history',
    emoji: '🕓',
    title: '히스토리 / 분석 / 변경이력',
    body: (
      <div className="space-y-2 text-sm leading-relaxed">
        <Field name="실행 히스토리">실행할 때마다 하나씩 기록이 쌓임. 항목을 열면 실제로 보낸 요청(헤더/바디)과 받은 응답이 전부 남아 있어서, 실패했을 때 무엇 때문인지 그대로 추적 가능</Field>
        <Field name="실행 분석">성공률·실패 추이 등을 그래프/통계로 보여줌</Field>
        <Field name="변경 이력">케이스를 누가 언제 추가/수정/삭제했는지 기록. "이 케이스가 언제부터 이렇게 바뀌었지?" 확인할 때 사용</Field>
      </div>
    ),
  },
  {
    id: 'notifications',
    emoji: '🔔',
    title: '알림 설정',
    body: (
      <div className="space-y-2 text-sm leading-relaxed">
        <p>테스트 실행이 끝났을 때 Discord/Slack으로 결과를 자동으로 알려주는 기능이에요.</p>
        <Field name="[+ 추가] 버튼">이름, 타입(Discord/Slack), 웹훅 URL 입력. 예: <Code>https://discord.com/api/webhooks/....</Code></Field>
        <Field name="알림 이벤트 선택">실행 완료 / 실행 실패 등 어떤 상황에 알림 받을지 선택</Field>
        <Field name="Excel 첨부 여부 (Discord)">켜면 실행 결과를 엑셀 파일로 같이 첨부해서 보내줌</Field>
      </div>
    ),
  },
  {
    id: 'etc',
    emoji: '🧰',
    title: '엑셀 임포트 / AI 분석',
    body: (
      <div className="space-y-2 text-sm leading-relaxed">
        <Field name="사이드바 하단 [📥 엑셀 임포트]">이미 정리된 연동규격서 엑셀 파일이 있으면 업로드해서 케이스를 한 번에 생성. 열 이름(엔드포인트, 메서드, 기대값 등)을 화면에서 매핑해줌</Field>
        <Field name="사이드바 하단 [🤖 AI 분석]">실행 결과나 배포 이력을 바탕으로 AI에게 질문. 상단에서 분석 종류(테스트결과/배포/비즈니스로직)와 로컬(Ollama)·Claude API 중 사용할 모델을 선택</Field>
      </div>
    ),
  },
];

const PANEL_WIDTH = 720;
const PANEL_HEIGHT_VH = 82;

export default function HelpGuideModal({ onClose }: Props) {
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const active = SECTIONS.find((s) => s.id === activeId) ?? SECTIONS[0];

  const [pos, setPos] = useState(() => ({
    x: Math.max(16, window.innerWidth - PANEL_WIDTH - 32),
    y: 64,
  }));
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setPos({ x: d.origX + (e.clientX - d.startX), y: d.origY + (e.clientY - d.startY) });
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
  };

  return (
    <div
      className="fixed z-50 flex flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/10"
      style={{ left: pos.x, top: pos.y, width: PANEL_WIDTH, height: `${PANEL_HEIGHT_VH}vh` }}
    >
      <div
        onMouseDown={startDrag}
        className="flex shrink-0 cursor-grab items-center gap-2 border-b border-border bg-card px-3 py-2 active:cursor-grabbing"
      >
        <GripHorizontal className="size-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">📖 사용 설명서</h2>
          <p className="truncate text-[11px] text-muted-foreground">상단 바를 끌어서 옮길 수 있어요 — 뒤 화면은 그대로 조작 가능합니다</p>
        </div>
        <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="닫기">
          <X className="size-4" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
        <nav className="w-44 shrink-0 overflow-y-auto border-r border-border p-2">
          <ul className="flex flex-col gap-0.5">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => setActiveId(s.id)}
                  className={cn(
                    'flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs font-medium transition-colors',
                    activeId === s.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                  )}
                >
                  <span>{s.emoji}</span>
                  <span className="truncate">{s.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 flex-1 overflow-y-auto p-4">
          <h3 className="mb-2.5 text-base font-bold">{active.emoji} {active.title}</h3>
          {active.body}
        </div>
      </div>
    </div>
  );
}

# Tapwire - 개발 중입니다.

로컬 네트워크의 모든 기기에서 발생하는 HTTP/HTTPS 트래픽을 캡처, 인터셉트, 재전송할 수 있는 MITM 프록시 도구입니다. 모던 웹 UI를 통해 실시간으로 트래픽을 분석하실 수 있습니다.

![Dark UI](https://img.shields.io/badge/UI-다크_우선-111317?style=flat-square)
![Node](https://img.shields.io/badge/Node.js-22+-339933?style=flat-square&logo=node.js)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite)
![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?style=flat-square)

---

## 이 프로젝트를 만든 이유

스크래핑 개발자로서 평소에 늘 써왔던 프록시 툴(Charles, Proxyman, mitmproxy 등)을 직접 만들어보면서, **"AI 바이브코딩이 나에게 실제로 얼마나 유용한가"** 를 실험해보고 싶었습니다.

백엔드 로직(MITM 프록시, TLS 인터셉트, SQLite 저장, WebSocket 브로드캐스트)은 도메인 지식이 필요한 영역이라 AI의 도움이 어느 정도인지, 그리고 프론트엔드 UI처럼 반복적이고 구조적인 작업에서는 얼마나 가속이 되는지 직접 체감해보는 것이 목적이었습니다.

**실험 결론:**
- 측정 중입니다...

> 스크래핑 개발자에게 이 정도 툴 스택(Node.js MITM + React 대시보드)은 바이브코딩으로 충분히 프로토타입까지 갈 수 있습니다. 프로덕션 레벨은 결국 도메인 이해가 필요합니다.

**아키텍처 결정 메모:**
처음에는 React Router v7 SSR 프레임워크 모드(`@react-router/express`)로 시작했으나, 실제로 SSR이 필요한 곳이 `node:os`를 호출하는 loader 2개뿐이었습니다. 나머지 95%는 순수 클라이언트 SPA였기 때문에, 이후 **Express + Vite SPA** 구조로 전환했습니다. API 로직은 `server.ts` Express 라우터에 인라인으로 통합되었으며, 빌드 시간은 551ms, 번들 크기는 249KB(gzip 77KB)입니다.

현재 클라이언트 라우팅은 `react-router`를 **라이브러리 모드**(`<BrowserRouter>`)로만 사용합니다. SSR, 파일 기반 라우팅, `@react-router/express` 등 프레임워크 기능은 일절 사용하지 않습니다.

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **실시간 캡처** | WebSocket 기반 실시간 패킷 스트림. HTTP 메서드, 상태 코드, 호스트, URL로 필터링 가능합니다. |
| **HTTPS 복호화** | 로컬 CA를 통한 MITM 방식. 호스트별 인증서를 자동 생성하여 TLS 트래픽을 투명하게 인터셉트합니다. |
| **인터셉트 & 편집** | 진행 중인 요청을 일시 정지하고 헤더/바디/URL/쿼리 파라미터를 수정한 뒤 전달하거나 차단할 수 있습니다. |
| **편집 후 전송** | 이미 캡처된 패킷도 내용을 수정하여 다시 전송하실 수 있습니다. |
| **재전송(Replay)** | 여러 패킷을 순서대로 재전송하는 시퀀스를 구성할 수 있습니다. |
| **브레이크포인트** | URL 패턴 + HTTP 메서드 조합으로 규칙을 설정하면 해당 요청을 실시간으로 가로채 수정할 수 있습니다. 규칙은 서버에 저장됩니다. |
| **세션 내보내기** | 전체 패킷을 `.wspy` (gzip 압축 JSON) 파일로 저장하거나 불러올 수 있습니다. |
| **통계** | 실시간 요청 속도, 활성 연결 수, 상위 호스트 현황을 확인하실 수 있습니다. |
| **모바일 설정** | iOS/Android 기기에서 프록시 및 CA 인증서를 설정하는 가이드를 제공합니다. |
| **다크/라이트 테마** | `localStorage`에 선택한 테마가 저장됩니다. |
| **제외 규칙** | Glob 패턴으로 노이즈성 트래픽을 숨길 수 있습니다. (예: `*.png`, `analytics.example.com`) |

---

## 시스템 요구사항

- **Node.js** 22 이상
- **npm** 9 이상
- macOS, Linux, 또는 Windows (WSL2 권장)

---

## 빠른 시작

```bash
# 1. 저장소 클론
git clone https://github.com/yourname/tapwire.git
cd tapwire

# 2. 의존성 설치
npm install

# 3. 환경 설정 파일 복사
cp .env.example .env

# 4. 개발 서버 실행
npm run dev
```

브라우저에서 **http://localhost:8081** 을 열어주세요.

브라우저 또는 기기의 프록시 설정을 **localhost:8080** 으로 변경하시면 트래픽 캡처가 시작됩니다.

---

## 환경 변수

모든 설정은 `.env` 파일에서 관리합니다. **변경 후에는 서버를 재시작해야 적용됩니다.**

| 변수명 | 기본값 | 설명 |
|--------|--------|------|
| `PROXY_PORT` | `8080` | MITM 프록시가 수신 대기할 포트 |
| `UI_PORT` | `8081` | 웹 UI 및 WebSocket 서버 포트 |
| `CERTS_DIR` | `./certs` | CA 인증서/키 저장 디렉터리 |
| `DATA_DIR` | `./data` | SQLite 데이터베이스 저장 디렉터리 |
| `MAX_BODY_SIZE_MB` | `10` | 캡처할 요청/응답 바디 최대 크기 (MB) |
| `PROXY_SSL_INSECURE` | `false` | 업스트림 TLS 검증 비활성화 (자체 서명 인증서 테스트 시 사용) |
| `NODE_ENV` | `development` | 프로덕션 서버 실행 시 `production`으로 설정 |

---

## HTTPS 설정 (CA 인증서)

Tapwire는 최초 실행 시 로컬 CA 인증서(`certs/ca.cert.pem`)를 자동으로 생성합니다. 해당 인증서를 한 번만 설치하시면 모든 HTTPS 트래픽을 확인하실 수 있습니다.

### macOS

```bash
# Keychain Access를 열고 certs/ca.cert.pem을 시스템 키체인으로 드래그하세요.
# 더블 클릭 → 신뢰 → 항상 신뢰로 변경
```

터미널에서 바로 설치하시려면 아래 명령어를 사용해주세요.

```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ./certs/ca.cert.pem
```

### Windows

```
certlm.msc → 신뢰할 수 있는 루트 인증 기관 → 가져오기 → certs/ca.cert.pem 선택
```

### Firefox

설정 → 개인 정보 및 보안 → 인증서 → 인증서 보기 → 기관 → 가져오기

### iOS / Android

Tapwire UI의 **설정 → 모바일 설정** 페이지에서 단계별 안내를 확인하실 수 있습니다.

---

## 프로덕션 빌드

```bash
npm run build
npm run start
```

정적 자산은 `immutable` 캐싱으로 제공되며, `compression` 미들웨어를 통해 gzip 압축이 적용됩니다.

---

## 프로젝트 구조

```
tapwire/
├── index.html             # SPA 진입점 (폰트 로드, #root 마운트)
├── server.ts              # 진입점 — Express API + WebSocket + ProxyServer + Vite 미들웨어
├── core/
│   ├── proxy/
│   │   ├── proxyServer.ts # HTTP CONNECT 핸들러, TLS MITM
│   │   ├── ca.ts          # CA 인증서 생성 (node-forge)
│   │   ├── cert.ts        # 호스트별 인증서 서명
│   │   ├── certCache.ts   # 인메모리 인증서 캐시
│   │   ├── decoder.ts     # gzip/deflate/br 바디 디코딩
│   │   ├── forwarder.ts   # 업스트림 요청 전달
│   │   └── interceptor.ts # InterceptorChain + PauseRegistry
│   ├── storage/
│   │   ├── db.ts          # SQLite 초기화 + 스키마 + PRAGMA 최적화
│   │   ├── repository.ts  # 패킷 CRUD (findAllSummary / findAll 분리)
│   │   ├── session.ts     # 세션 내보내기/불러오기
│   │   └── har.ts         # HAR 내보내기
│   ├── replay/
│   │   └── single.ts      # 패킷 편집 후 재전송
│   ├── ws/
│   │   └── broadcaster.ts # WebSocket 브로드캐스트
│   └── registry.ts        # globalThis 싱글턴 레지스트리
├── app/
│   ├── main.tsx           # React 앱 진입점 (createRoot)
│   ├── App.tsx            # BrowserRouter + Routes + 레이아웃
│   ├── routes/            # 페이지 컴포넌트 (순수 클라이언트 SPA)
│   │   ├── _index.tsx     # 실시간 캡처
│   │   ├── replay.tsx     # 재전송 시퀀서
│   │   ├── rules.tsx      # 브레이크포인트 규칙
│   │   ├── stats.tsx      # 실시간 통계
│   │   ├── settings.tsx   # 테마 + 제외 규칙
│   │   ├── setup.tsx      # 모바일 기기 설정 가이드
│   │   └── cert.tsx       # CA 인증서 다운로드
│   ├── components/
│   │   ├── capture/       # PacketList, PacketDetail, FilterChips
│   │   ├── intercept/     # InterceptModal + 편집기
│   │   ├── layout/        # Sidebar, Titlebar, NavItem
│   │   └── ui/            # MethodBadge, StatusPill
│   ├── hooks/
│   │   └── useWebSocket.ts # 지수 백오프 재연결 WebSocket 클라이언트
│   ├── store/index.ts     # Zustand 전역 스토어
│   └── types.ts           # 공유 TypeScript 타입
├── data/                  # SQLite DB (자동 생성)
├── certs/                 # CA 인증서 (최초 실행 시 자동 생성)
└── .env.example
```

---

## UI 페이지 설명

### 실시간 캡처 (`/`)

메인 화면입니다. 프록시를 통과하는 패킷이 실시간으로 표시됩니다.

- **필터 바** — HTTP 메서드(GET/POST/PUT/DELETE/PATCH)와 상태 코드 클래스(2xx/3xx/4xx/5xx)로 필터링하실 수 있습니다.
- **검색** — URL과 호스트 전체에서 텍스트 검색이 가능합니다.
- **호스트 필터** — 호스트명을 입력하여 특정 도메인 트래픽만 볼 수 있습니다.
- **패널 크기 조절** — 패킷 목록과 상세 패널 사이의 구분선을 드래그하여 크기를 조절하실 수 있습니다.
- **다중 선택** — `Shift+클릭`으로 범위 선택, `Ctrl/Cmd+클릭`으로 개별 선택 후 `Delete`/`Backspace` 키로 일괄 삭제하실 수 있습니다.
- **컨텍스트 메뉴** — 패킷을 우클릭하면 빠른 작업 메뉴가 표시됩니다.

**패킷 상세 패널:**

| 탭 | 내용 |
|----|------|
| 개요 | URL 구조 분석, 쿼리 파라미터, 요청 메타데이터 |
| 헤더 | 요청/응답 헤더 (변경 항목 하이라이트 포함) |
| 바디 | JSON 구문 강조 및 응답 바디 미리보기 |
| Raw | 원본 요청/응답 텍스트 |
| 타이밍 | TTFB, DNS, 연결 시간, 전체 소요 시간 시각화 |

**패킷별 액션:**
- **편집 후 전송** — InterceptModal을 열어 요청을 수정하고 재전송합니다.
- **재전송** — 원본 그대로 다시 전송합니다.
- **cURL** — `curl` 명령어로 클립보드에 복사합니다.
- **fetch** — `fetch()` 코드 스니펫으로 복사합니다.
- **노트** — 해당 패킷에 메모를 남길 수 있습니다.
- **삭제** — 목록과 데이터베이스에서 제거합니다.

### 재전송 (`/replay`)

캡처된 패킷을 선택하여 순서대로 재전송하는 시퀀스를 구성하실 수 있습니다. 실행 결과로 각 요청의 상태 코드와 소요 시간이 표시됩니다.

### 브레이크포인트 (`/rules`)

URL 패턴(부분 문자열 또는 `*`/`?` Glob)과 HTTP 메서드를 조합한 규칙을 추가하면 해당 패턴과 일치하는 요청이 전송 전에 일시 정지됩니다. 요청이 일시 정지되면 **InterceptModal**이 자동으로 열리며, 30초 카운트다운 후 원본 요청이 자동으로 전달됩니다.

규칙은 **서버에 저장**됩니다. 페이지를 새로고침해도 유지되며, 서버를 재시작하면 초기화됩니다.

패킷 목록에서 **우클릭 → 브레이크포인트 설정/해제**로 빠르게 규칙을 관리할 수 있습니다.

### 설정 (`/settings`)

- **테마** — 다크/라이트 선택 (`localStorage`에 저장됩니다.)

### 모바일 설정 (`/setup`)

로컬 IP, 프록시 포트, CA 인증서 다운로드 URL을 표시하고 iOS/Android 기기 설정 방법을 안내합니다.

### CA 인증서 (`/cert`)

CA 인증서 다운로드 및 macOS, Windows, Firefox, iOS, Android 설치 가이드를 제공합니다.

---

## 키보드 단축키

| 단축키 | 동작 |
|--------|------|
| `Delete` / `Backspace` | 선택한 패킷 삭제 |
| `Shift+클릭` | 범위 선택 |
| `Ctrl/Cmd+클릭` | 개별 패킷 선택 토글 |
| `Cmd/Ctrl+Enter` | InterceptModal에서 요청 전달 |
| `Escape` | InterceptModal 닫기 (라이브 인터셉트 시 원본 전달) |
| `Cmd/Ctrl+Backspace` | 인터셉트된 요청 차단(Drop) |

---

## API 레퍼런스

모든 API는 UI와 동일한 Express 서버에서 제공됩니다.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/packets` | 패킷 목록 조회 (`?limit=&offset=&host=&method=&search=&full=true`) |
| `GET` | `/api/packets/:id` | 단일 패킷 전체 데이터 조회 |
| `DELETE` | `/api/packets/:id` | 패킷 삭제 |
| `PATCH` | `/api/packets/:id` | 노트 수정 (`{ notes: string }`) |
| `DELETE` | `/api/packets` | 전체 패킷 삭제 |
| `GET` | `/api/stats` | 프록시 통계 조회 |
| `GET` | `/api/session` | 세션을 `.wspy` (gzip 압축 JSON)으로 내보내기 |
| `POST` | `/api/session` | `.wspy` 세션 불러오기 (gzip 또는 JSON) |
| `GET` | `/api/har` | 전체 패킷을 HAR 형식으로 내보내기 |
| `POST` | `/api/replay/:id` | 패킷 원본 재전송 |
| `PUT` | `/api/intercept/:id` | 인터셉트된 요청 전달 (수정 내용 포함 가능) |
| `DELETE` | `/api/intercept/:id` | 인터셉트된 요청 차단 |
| `GET` | `/api/breakpoints` | 브레이크포인트 규칙 목록 조회 |
| `POST` | `/api/breakpoints` | 브레이크포인트 규칙 추가 (`{ pattern, method?, enabled }`) |
| `PUT` | `/api/breakpoints/:id` | 브레이크포인트 규칙 수정 |
| `DELETE` | `/api/breakpoints/:id` | 브레이크포인트 규칙 삭제 |
| `GET` | `/api/ca` | CA 인증서 다운로드 |
| `GET` | `/api/setup` | 로컬 IP, 프록시 포트 조회 |
| `GET` | `/api/config` | 서버 환경 변수 읽기 전용 조회 |

---

## 성능

Apple Silicon (M 시리즈), 개발 모드, 패킷 약 120개가 저장된 SQLite DB 환경에서 측정한 결과입니다.

| 엔드포인트 | 동시 연결 | 초당 요청 수 | 평균 레이턴시 | 비고 |
|------------|-----------|-------------|--------------|------|
| `GET /api/packets` | 50 | **2,422** | 23ms | 요약 응답 기본 제공 (~22KB) |
| `GET /api/packets/:id` | 50 | **5,345** | 9ms | 단일 패킷 전체 데이터 |
| `GET /api/stats` | 50 | **4,883** | 10ms | DB 집계 쿼리 |
| `GET /` (UI) | 50 | 259 | 195ms | Vite SPA 서빙 (개발 모드) |

**성능에 영향을 주는 주요 설계 결정:**

- `GET /api/packets`는 기본적으로 요약 필드만 반환합니다(`id`, `method`, `url`, `host`, `path`, `statusCode` 등). `reqBody`/`resBody`는 포함되지 않으며, 전체 데이터가 필요한 경우 `?full=true`를 사용하세요. 이를 통해 응답 크기가 약 9MB에서 약 22KB로 400배 감소했습니다.
- SQLite는 WAL 모드로 동작하며, 64MB 페이지 캐시, 128MB mmap, `wal_autocheckpoint=500` 설정으로 WAL 파일 비대화를 방지합니다.
- 새 패킷은 WebSocket을 통해 UI로 즉시 전달되므로 UI에서 별도로 폴링하지 않습니다.
- 인메모리 패킷 스토어는 최대 5,000개로 제한되며, 필터 연산은 `useMemo`로 최적화되어 있습니다.

**알려진 성능 한계:**
- 실시간 캡처 목록에는 가상 스크롤링이 적용되어 있지 않습니다. 2,000개 이상의 패킷이 표시될 경우 API 성능과 무관하게 DOM 렌더링이 병목이 됩니다.

---

## 알려진 제한 사항

- **목록 가상화 미적용** — 실시간 캡처는 최대 5,000개의 패킷을 DOM에 직접 렌더링합니다. 약 2,000개 이상부터 성능 저하가 발생할 수 있습니다. 가상 스크롤러 적용이 예정되어 있습니다.
- **브레이크포인트 규칙 서버 재시작 시 초기화** — 규칙은 메모리에만 저장됩니다. 서버를 재시작하면 초기화됩니다. 페이지 새로고침에는 영향 없습니다.
- **재전송 페이지 패킷 수 제한** — 패킷 선택기에는 최근 100개만 표시됩니다.
- **HTTP/2 및 WebSocket 캡처 미지원** — HTTP/1.x 트래픽만 캡처됩니다. HTTP/2 연결은 HTTP/1.1로 다운그레이드됩니다.
- **프록시 설정은 환경 변수로만 변경 가능** — 포트, 바디 크기 제한, SSL 모드 변경 시 서버 재시작이 필요합니다.

---

## 개발

```bash
# 타입 체크
npm run typecheck

# 개발 서버 실행 (hot reload 지원)
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm run start
```

개발 서버는 Vite를 `spa` 모드 미들웨어로 실행합니다. API 요청은 Express가 먼저 처리하고, 나머지 모든 경로는 Vite가 SPA로 서빙합니다. 프록시 서버와 WebSocket 서버는 `NODE_ENV`와 무관하게 항상 함께 시작됩니다.

프로덕션 빌드 결과물은 `build/client/`에 생성되며, `/assets` 경로는 `immutable` 캐싱이 적용됩니다.

---

## 기술 스택

| 레이어 | 라이브러리 |
|--------|-----------|
| 런타임 | Node.js 22+, TypeScript 5 |
| 웹 프레임워크 | Express 4 (API 서버) |
| 빌드 도구 | Vite 5 |
| 클라이언트 라우터 | react-router v7 — 라이브러리 모드 (`<BrowserRouter>`) |
| 프론트엔드 | React 18, Zustand 4 |
| 빌드 결과 | 249KB JS (gzip 77KB), 빌드 시간 551ms |
| 데이터베이스 | better-sqlite3 (SQLite WAL 모드) |
| TLS / CA | node-forge |
| WebSocket | ws |
| 프록시 | 커스텀 HTTP CONNECT MITM |

---

## 라이선스

MIT

# Tapwire Chunk Archive (TW3)

Tapwire의 기본 `.tpw` 저장 형식이다. HTTP 본문과 메타데이터의 반복을 제거하는 독자 컨테이너 위에 표준 Brotli 압축을 사용한다. HTTP 캡처에 이미 저장된 모든 필드를 무손실 복원한다. 캡처 단계의 `MAX_BODY_SIZE_MB` 제한으로 수집되지 않은 바이트나 예전 내보내기에서 삭제된 본문까지 복구하지는 않는다.

## 사용자 동작

- **Save**: DB의 전체 패킷을 브라우저 다운로드로 저장한다. 최근 5,000개 제한과 256KB 초과 본문 삭제를 제거했다. 다운로드 진행률과 취소는 브라우저에서 제공한다.
- **Load**: Tapwire 실행 PC의 OS 파일 선택 창을 연다. 선택한 `.tpw`, `.wspy`, 구버전 세션 JSON의 경로를 서버가 직접 읽는다. 브라우저는 본문 없는 제어 요청만 보내며 파일을 HTTP로 업로드하지 않는다. macOS는 `osascript`, Windows는 PowerShell의 기본 파일 선택 창, Linux는 `zenity` 또는 `kdialog`를 사용한다. 원격 브라우저로 접속한 경우에도 파일 선택 창은 Tapwire 실행 PC에 뜬다. 취소는 오류와 구분해 표시한다.
- 기존 TW2 Brotli, gzip `.wspy`, 원시 v1 JSON을 자동 판별한다. 새 TW3 파일을 예전 Tapwire 버전에서 읽을 수는 없다.
- 파일 끝까지 검증한 뒤 단일 트랜잭션으로 DB에 반영한다. 기존 ID는 덮어쓰지 않고 중복 건수를 알려준다. 파싱·압축 해제·체크섬·DB 오류가 나면 새 패킷이 일부만 반영되지 않는다.
- 가져오기 완료 알림은 WebSocket 메시지 한 번으로 전송하고 목록을 다시 조회한다. 캡처 일시정지 중에도 불러온 패킷을 표시한다. 화면의 최근 5,000개 제한과 파일에 저장되는 전체 패킷 수는 별개다.

## 압축 설계

1. 요청/응답 본문을 64KiB 고정 조각으로 나눈다. SHA-256로 동일 조각을 찾아 세션 전체에서 재사용한다. 큰 이미지가 멀리 떨어진 요청에 반복되어도 압축기의 탐색 창 크기에 묶이지 않는다.
2. 정규 base64 바이너리는 원래 바이트로 바꿔 저장한다. 비정규 base64 문자열은 문자열 그대로 보존한다. 텍스트는 UTF-8, 단독 surrogate가 있는 문자열은 UTF-16LE로 보존한다. `null`과 빈 문자열을 구분한다.
3. 패킷 메타데이터는 고정 순서 튜플로 저장한다. 문자열·헤더 객체·태그 배열을 블록별 사전으로 공유한다. 헤더 배열 순서, 공백, 대소문자, JSON 본문 표기, 메모를 바꾸지 않는다.
4. 약 4MiB의 새 데이터 또는 2,048개 메타데이터 행을 모아 독립 블록으로 압축한다. 본문만 들어간 블록도 허용한다. 큰 본문 하나가 여러 블록에 걸쳐도 복원된다.
5. Brotli quality 6을 비동기로 실행한다. 압축 결과가 원본보다 크면 해당 블록은 원본 바이트로 저장한다. quality 11을 무조건 적용하지 않아 저장 대기 시간을 줄인다.
6. 블록 SHA-256과 마지막 manifest의 전체 블록 순서 해시·개수로 손상, 누락, 순서 변경, 잘린 파일, 뒤에 붙은 데이터를 검사한다. 체크섬은 오류 검출용이며 암호화나 발신자 인증은 아니다.

압축률은 트래픽에 따라 다르다. 이미 압축된 서로 다른 사진·영상, 암호화된 데이터는 크게 줄지 않는다. 작은 세션이나 압축기가 이미 반복을 전부 찾는 세션은 프레임·사전 비용 때문에 구버전보다 약간 커질 수 있다. 고정 조각은 바이트 삽입으로 경계가 이동한 바이너리의 유사성까지 찾아내지는 않는다.

## 바이트 구조

모든 길이와 ID는 비음수 정수다. 다중 바이트 프레임 정수는 little-endian이다.

```text
54 57 03                          # "TW" + version 3
frame(kind=1)*                    # 데이터 블록
frame(kind=2)                     # 최종 manifest; 이후 바이트 불가

frame:
  kind        uint8              # 1 = data, 2 = manifest
  codec       uint8              # 0 = stored, 1 = Brotli
  storedSize  uint32le
  rawSize     uint32le
  sha256      32 bytes           # 압축 전 payload 해시
  payload     storedSize bytes

data payload:
  metadataSize uint32le
  metadata     UTF-8 JSON
  chunks       raw binary bytes  # metadata.chunks의 길이 순서

metadata:
  dictionary: JSON values[]
  rows: [values, reqBodyReference, resBodyReference][]
  chunks: number[]               # 이 블록에서 처음 저장하는 조각 길이

body reference:
  null
  OR ["utf8" | "utf16le" | "base64", byteLength, chunkIds[]]

manifest:
  { packets, chunks, exported, sha256 }
  # sha256 = 모든 kind=1 프레임의 헤더+저장 payload를 순서대로 해시
```

조각 ID는 세션의 데이터 블록에서 나타나는 순서대로 0부터 부여한다. 참조는 현재 또는 이전 블록의 조각만 가리킨다. 조각은 1–65,536바이트이며, 각 본문의 마지막 조각을 제외하고 65,536바이트다. 빈 본문은 길이 0, 빈 ID 배열로 나타낸다.

메타데이터 튜플의 필드 순서:

```text
id, timestamp, clientIp, method, url, host, path, httpVersion,
isHttps, reqHeaders, reqBodyType, statusCode, statusMessage, resHeaders,
resBodyType, duration, contentType, tags, intercepted, replayed, notes
```

문자열·객체·태그는 `[dictionaryIndex]`, 숫자·불리언·null은 직접 저장한다. 사전은 블록마다 초기화한다. 복원 시 사전 객체를 복사해 패킷 간 수정이 전파되지 않는다. 본문 조각 SHA 인덱스는 최대 262,144개 항목 후 초기화한다. 이후 동일 바이트가 새로운 ID로 다시 저장될 수 있지만 기존 참조와 복원 정확도는 유지된다.

## 메모리와 저장 공간

내보내기는 별도 읽기 연결의 SQLite 스냅샷에서 행을 순회하고 HTTP 응답에 backpressure를 적용한다. 서버와 브라우저가 전체 세션 JSON 또는 다운로드 Blob을 메모리에 만들지 않는다. 캡처 쓰기는 WAL로 계속할 수 있다. 느린 다운로드 동안 읽기 스냅샷이 유지되므로 WAL이 일시적으로 커질 수 있다.

불러오기는 제한된 블록만 압축 해제하고 조각과 검증된 패킷을 OS 임시 디렉터리의 SQLite DB에 보관한다. 임시 디렉터리는 사용자 전용 권한으로 생성되고 성공·오류 시 삭제한다. 전체 파일을 검증한 다음 라이브 DB에 원자적으로 넣는다. 마지막 DB 반영은 동기 트랜잭션이므로 매우 많은 패킷은 잠시 서버 처리를 지연시킬 수 있다. 임시 공간에는 고유 조각과 복원된 패킷 JSON을 함께 저장하므로 압축 파일 크기보다 넉넉한 디스크 공간이 필요하다. 프로세스를 강제 종료하면 OS 임시 파일이 남을 수 있다.

현 구현 제한은 `core/storage/archive.ts`의 `ARCHIVE_LIMITS`에 모여 있다:

| 항목 | 한도 |
|---|---:|
| 새 파일 입력 | 8GiB |
| 전체 블록 압축 해제 바이트 | 8GiB |
| 복원 패킷 JSON 총량 | 8GiB |
| 블록 원본/저장 크기 | 64MiB |
| 개별 요청/응답 본문 바이트 | 64MiB |
| 패킷 개수 | 1,000,000 |
| 구버전 파일 입력/압축 해제 JSON | 256MiB |

한도를 넘으면 명시적으로 실패한다. 본문이나 패킷을 조용히 버리지 않는다. 구버전 JSON만 전체 파싱이 필요하며 새 형식은 스트리밍 처리한다.

## SQLite 파일 비대화 수정

라이브 DB는 기존 패킷 스키마를 유지한다. 삭제한 패킷의 빈 페이지를 자동 회수하도록 `auto_vacuum=INCREMENTAL`을 활성화한다. 기존 DB는 다음 실행 때 한 번 `VACUUM`으로 전환한다. 이 최초 정리는 시작 시간을 늘릴 수 있으며 여유 디스크 공간이 필요하다. 실패하면 기존 데이터를 유지하고 다음 시작 때 재시도한다.

이후 1초마다 최대 1,024개 페이지를 회수하고 비차단 WAL checkpoint를 시도한다. WAL 재사용 시 크기 목표는 8MiB다. 활성 읽기 연결 때문에 WAL이 그보다 커질 수 있으므로 상한 보장은 아니다. 종료 시 DB 연결도 닫는다.

## 검증 결과

Node.js 22.21.1, 개발 워크스페이스의 로컬 측정. 압축 비교는 **모든 본문을 보존하는 TW2 quality 4**와 TW3를 비교했다. 본문을 삭제하는 구버전 기본 내보내기와 비교하지 않았다. 시간은 환경과 캐시에 따라 달라진다.

| 데이터 | 원시 JSON | TW2 | TW3 | TW2 대비 감소 |
|---|---:|---:|---:|---:|
| 실제 로컬 캡처 2,233개 | 4,376,808B | 149,773B | 137,490B | 8.20% |
| 합성 HTTP 200개: 16개 바이너리 자산 반복 + JSON | 21,789,102B | 13,144,058B | 4,201,353B | 68.04% |

실제 캡처는 TW2 압축 13.3ms, TW3 압축 51.2ms, TW3 검증·DB 불러오기 166.4ms였다. 합성 캡처는 각각 126.3ms, 153.9ms, 439.4ms였다. 두 경우 모두 모든 패킷 필드를 원본과 비교했다.

단일 바이너리만 반복하는 별도 합성 데이터에서는 TW2 264,934B, TW3 267,966B로 약 1.14% 증가했다. 모든 입력에서 구버전보다 작다는 보장은 하지 않는다.

기존 DB의 **복사본**으로 공간 회수를 검증했다: 346,451,968B → 4,513,792B, 98.70% 감소. 2,233개 패킷의 내용 해시 동일, `integrity_check=ok`. 작업 중 실제 사용자 DB는 읽기 전용으로 접근했다.

```bash
npm test
npm run typecheck
npx vite build
npm run benchmark:session
# 로컬 DB를 읽기 전용으로 측정; 출력에 캡처 내용은 포함하지 않음
npm run benchmark:session -- data/packets.db
# 격리된 테스트 서버에만 실행: 테스트 패킷을 불러옴
PLAYWRIGHT_CHANNEL=chrome npx tsx scripts/check-session-ui.ts http://localhost:18081
```

Chrome UI 자동 검증은 OS 선택 결과를 로컬 경로로 대체해 실제 서버의 파일 읽기, 다운로드, 256KB 초과 본문 일치, 중복 건수, 취소, 손상 파일 거절을 확인한다. Load 요청에 파일 본문이 없고 업로드 API를 호출하지 않는지도 검사한다. OS 창 자체의 사용자 클릭은 자동 검증 범위에 포함하지 않는다.

## 기반 문서

- [Node.js 22 zlib: Brotli와 maxOutputLength](https://nodejs.org/download/release/v22.4.0/docs/api/zlib.html)
- [SQLite PRAGMA: auto_vacuum, incremental_vacuum, journal_size_limit](https://www.sqlite.org/pragma.html)

로컬 선택 API: `POST /api/session/load-file`에 본문이 없으면 OS 선택 창을 열고, `{ "path": "..." }`를 보내면 해당 로컬 경로를 읽는다. 업로드 API `POST /api/session`은 기존 연동 호환용으로 유지하되 기본 Load에서는 사용하지 않는다.

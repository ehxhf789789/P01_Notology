<div align="center">
  <img src="icon/Black_logo_detail.png" alt="Notology" width="120" />
  <h1>Notology</h1>
  <p><strong>구조화되고, 연결되고, 휴대 가능한 지식 관리 시스템</strong></p>
  <p>Obsidian에서 영감을 받고, Rust로 구동됩니다. 노트는 로컬 드라이브, NAS, 외장 디스크 어디에나 저장할 수 있습니다.</p>

  <p>
    <a href="#다운로드">다운로드</a> &middot;
    <a href="README.md">English</a> &middot;
    <a href="#notology-vs-obsidian">vs Obsidian</a> &middot;
    <a href="#기능-상세">기능</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/version-1.0.4-blue" alt="Version" />
    <img src="https://img.shields.io/badge/platform-Windows-0078D6?logo=windows" alt="Windows" />
    <img src="https://img.shields.io/badge/built_with-Tauri_v2-FFC131?logo=tauri" alt="Tauri" />
    <img src="https://img.shields.io/badge/search-Tantivy-orange" alt="Tantivy" />
    <img src="https://img.shields.io/github/license/ehxhf789789/Notology" alt="License" />
  </p>
</div>

---

<!-- 히어로 GIF: 전체 앱 개요 (에디터 + 사이드바 + 호버 윈도우) -->
<!-- ![Notology 개요](docs/gifs/01-overview.gif) -->

## Notology란?

Notology는 구조화된 노트 템플릿, 위키링크 연결, 강력한 검색 엔진을 하나의 네이티브 앱에 결합한 **데스크톱 지식 관리 앱**입니다.

**핵심 원칙:**

- **플레인 마크다운 파일** &mdash; 독점 형식 없음, 종속성 없음
- **휴대 가능한 보관함** &mdash; 보관함은 그냥 폴더입니다. USB, NAS, 클라우드 동기화 폴더에 넣고 어디서든 사용하세요
- **타입이 있는 노트** &mdash; 12가지 템플릿 (회의, 논문, 연락처 등)으로 빈 페이지가 아닌 구조화된 노트 작성
- **네이티브 성능** &mdash; Rust 백엔드 (Tauri v2) + React 프론트엔드. Electron 오버헤드 없음
- **오프라인 우선** &mdash; 계정 없음, 구독 없음, 인터넷 불필요

---

## Notology vs Obsidian

Notology는 Obsidian의 보관함 기반 접근과 위키링크 철학에서 영감을 받았습니다. 차이점은 다음과 같습니다:

| | **Notology** | **Obsidian** |
|--|-------------|-------------|
| **엔진** | Tauri v2 (Rust + WebView) | Electron (Chromium) |
| **검색** | Tantivy 전문 검색 엔진 (Rust) | 내장 파일 검색 |
| **노트 타입** | 12개 구조화된 템플릿 + 자동 프론트매터 | 빈 마크다운 + 커뮤니티 템플릿 |
| **멀티 윈도우** | 내장 호버 윈도우 (드래그, 스냅, 리사이즈) | 팝아웃 윈도우 (별도 OS 창) |
| **캔버스** | 플로우차트 도형 (다이아몬드, 평행사변형, 원) + 화살표 | 카드와 연결선 |
| **코멘트** | 내장 노트별 코멘트/메모 시스템 | 플러그인 필요 |
| **그래프** | 물리 제어 + 타입별 컬러링 | 내장 그래프 |
| **휴대성** | 보관함 잠금 + 충돌 감지 (공유 드라이브 지원) | 유료 Sync 서비스 |
| **가격** | 무료 오픈소스 | 코어 무료, Sync/Publish 유료 |
| **코드** | 오픈소스 (MIT) | 비공개 |

---

## 기능 상세

### 1. 리치 텍스트 에디터

TipTap 기반 에디터로 마크다운을 실시간 리치 텍스트로 렌더링합니다.

<!-- GIF: 01-editor.gif -->
<!-- ![에디터](docs/gifs/01-editor.gif) -->

- **마크다운 + WYSIWYG 하이브리드** &mdash; `# `, `- `, `> ` 입력 시 즉시 렌더링
- **6종 콜아웃 블록** &mdash; 정보, 경고, 오류, 성공, 노트, 팁 (컬러 테두리)
- **테이블** &mdash; 색상 지원 셀 + 헤더 행
- **코드 블록** &mdash; 구문 강조 (highlight.js, 180+ 언어)
- **할일 목록** &mdash; 인터랙티브 체크박스
- **위첨자 / 아래첨자** &mdash; 과학 표기법 지원
- **접을 수 있는 툴바** &mdash; 전체 서식 바 또는 미니멀 모드
- **커스텀 키보드 단축키** &mdash; 모든 동작 재매핑 가능

### 2. 위키링크 & 백링크

지식 그래프의 근간입니다. `[[이중 괄호]]`로 노트를 자유롭게 연결하세요.

<!-- GIF: 02-wikilinks.gif -->
<!-- ![위키링크](docs/gifs/02-wikilinks.gif) -->

- **자동 완성** &mdash; `[[` 입력 시 보관함 내 전체 노트에서 실시간 추천
- **이미지 임베딩** &mdash; `![[photo.png]]`으로 인라인 이미지 렌더링
- **이름 변경 시 자동 업데이트** &mdash; 노트 이름을 바꾸면 모든 `[[링크]]`가 자동 갱신
- **백링크 추적** &mdash; 검색 상세 뷰에서 현재 노트를 참조하는 모든 노트 확인
- **폴더 간 링크** &mdash; 서로 다른 폴더의 노트도 자유롭게 연결

### 3. 12가지 구조화된 노트 템플릿

빈 페이지 노트 앱과 달리, Notology는 구조화된 프론트매터가 포함된 **타입이 있는 노트**를 제공합니다.

<!-- GIF: 03-templates.gif -->
<!-- ![템플릿](docs/gifs/03-templates.gif) -->

| 템플릿 | 용도 | 자동 생성 필드 |
|--------|------|----------------|
| **NOTE** | 일반 노트 | 제목, 태그, 생성일 |
| **SKETCH** | 시각적 다이어그램 | 제목, 캔버스 데이터 |
| **MTG** | 회의록 | 제목, 참석자, 안건, 날짜 |
| **SEM** | 세미나 노트 | 제목, 발표자, 주제 |
| **EVENT** | 이벤트 기록 | 제목, 날짜, 장소 |
| **OFA** | 공무 사항 | 제목, 카테고리, 상태 |
| **PAPER** | 연구 논문 | 제목, 저자, DOI, 초록 |
| **LIT** | 문헌 노트 | 제목, 출처, 핵심 논점 |
| **DATA** | 데이터 문서 | 제목, 출처, 방법론 |
| **THEO** | 이론 탐구 | 제목, 도메인, 전제 |
| **CONTACT** | 연락처 카드 | 이름, 소속, 이메일, 전화 |
| **SETUP** | 설정 노트 | 제목, 카테고리 |

**각 템플릿 제공 사항:**
- 날짜 접두사 자동 파일명 (예: `MTG_260208_주간 스탠드업.md`)
- 구조화된 YAML 프론트매터
- 4종 태그 카테고리: `domain`, `who`, `org`, `ctx`
- UI 전반의 커스텀 컬러 코딩
- 사전 구성된 본문 구조

### 4. 호버 윈도우 (멀티 윈도우 편집)

앱을 떠나지 않고 여러 노트를 플로팅 윈도우로 동시에 열 수 있습니다.

<!-- GIF: 04-hover-windows.gif -->
<!-- ![호버 윈도우](docs/gifs/04-hover-windows.gif) -->

- **드래그 & 드롭** 자유 배치
- **리사이즈** &mdash; 모서리/변 드래그로 크기 조절
- **스냅 존** &mdash; 화면 가장자리로 드래그하면 자동 정렬
- **최소화 / 복원** 애니메이션
- **4가지 크기 프리셋** &mdash; S, M, L, XL
- **줌** &mdash; Ctrl+스크롤로 창별 확대/축소
- **콘텐츠 캐싱** &mdash; 창 간 즉시 전환
- **5가지 콘텐츠 타입:**

| 타입 | 열리는 조건 |
|------|------------|
| **에디터** | `.md` 파일 &mdash; 툴바 포함 전체 편집 |
| **PDF** | `.pdf` 파일 &mdash; 내장 뷰어 |
| **이미지** | `.png`, `.jpg`, `.gif` 등 &mdash; 줌 가능 미리보기 |
| **코드** | `.js`, `.py`, `.rs` 등 &mdash; 구문 강조 읽기 전용 |
| **웹** | URL &mdash; 내장 웹 미리보기 |

### 5. 인터랙티브 그래프 뷰

전체 지식 네트워크를 힘-방향 그래프로 시각화합니다.

<!-- GIF: 05-graph.gif -->
<!-- ![그래프 뷰](docs/gifs/05-graph.gif) -->

- **힘-방향 레이아웃** &mdash; d3-force 기반
- **물리 설정** &mdash; 척력, 링크 거리, 중력, 중심력 슬라이더
- **노드 타입** &mdash; 노트 (템플릿별 컬러), 태그 (네임스페이스별), 첨부파일
- **폴더 노트** 별도 색상으로 강조
- **필터** &mdash; 노트 타입, 태그, 검색어로 필터링
- **클릭으로 열기** &mdash; 그래프에서 노트를 직접 열기
- **실시간 반영** &mdash; 노트 생성/편집 시 그래프 자동 업데이트

### 6. 캔버스 에디터

플로우차트, 마인드맵, 다이어그램을 만드는 공간적 사고 도구입니다.

<!-- GIF: 06-canvas.gif -->
<!-- ![캔버스](docs/gifs/06-canvas.gif) -->

- **무한 캔버스** &mdash; 팬 & 줌
- **4종 도형** &mdash; 직사각형, 다이아몬드 (분기), 원 (시작/종료), 평행사변형 (입출력)
- **연결 화살표** &mdash; 도형 간 화살표
- **노드 내 리치 텍스트** &mdash; 단순 텍스트가 아닌 서식 지원
- **프론트매터에 저장** &mdash; 캔버스 데이터를 노트로 저장

### 7. 전문 검색 (5가지 모드)

**Tantivy** (Apache Lucene의 Rust 버전) 기반으로, 수천 개의 노트에서도 즉각적인 검색 결과를 제공합니다.

<!-- GIF: 07-search.gif -->
<!-- ![검색](docs/gifs/07-search.gif) -->

| 모드 | 기능 | 예시 |
|------|------|------|
| **노트** | 제목, 태그, 노트 타입 검색 | `type:MTG tag:project-alpha` |
| **본문** | 전문 콘텐츠 검색 + 하이라이팅 | `"분기 리뷰"` |
| **첨부파일** | 파일명, 확장자, 크기로 검색 | `*.pdf` |
| **상세** | 메타데이터 브라우저 + 필터 (날짜, 타입, 태그, 메모) | 날짜 범위 + 타입 필터 |
| **그래프** | 검색 하이라이팅 포함 시각적 그래프 | 노드 클릭으로 이동 |

### 8. 캘린더 뷰

할일, 메모, 이벤트를 월간 캘린더에서 추적합니다.

<!-- GIF: 08-calendar.gif -->
<!-- ![캘린더](docs/gifs/08-calendar.gif) -->

- 일별 **할일 수 표시** 포함 월간 그리드
- 날짜 클릭으로 해당일의 모든 노트, 할일, 메모 확인
- 캘린더에서 **직접 노트 생성**
- 화살표 버튼으로 월 이동

### 9. 휴대 가능한 보관함 &mdash; 노트를 어디서든 사용

보관함은 그냥 폴더입니다. 데이터베이스도, 독점 형식도 없습니다:

- **NAS** &mdash; Synology, QNAP 등 NAS에 보관함을 두고 어떤 컴퓨터에서든 접근
- **외장 드라이브** &mdash; USB 드라이브나 외장 SSD에 넣고 휴대
- **클라우드 동기화** &mdash; Dropbox, Google Drive, OneDrive 등 아무 동기화 서비스와 호환

**공유 저장소를 위한 안전 장치:**

| 기능 | 설명 |
|------|------|
| **보관함 잠금** | 두 기기가 동시에 같은 보관함을 편집하는 것을 방지 |
| **충돌 감지** | 동기화 충돌을 감지하고 수동 해결을 안내 |
| **원자적 쓰기** | 임시 파일 + 이름 변경 패턴으로 동기화 중 파일 손상 방지 |
| **벌크 동기화 인식** | 대량 동기화 시 UI 업데이트를 일시 중지하여 깜빡임 방지 |

### 10. 코멘트 & 메모 시스템

노트 본문을 수정하지 않고 영구적인 주석을 추가할 수 있습니다.

- **인라인 코멘트** &mdash; 텍스트를 선택하고 코멘트 추가
- **메모** &mdash; 파일에 첨부된 독립 노트
- **할일 추적** &mdash; 코멘트에 체크박스 포함 가능
- **메모 수** &mdash; 검색 결과에 표시되어 빠른 개요 제공

### 11. 설정 & 커스터마이징

- **테마** &mdash; 다크, 라이트, 시스템 (자동 감지)
- **폰트** &mdash; 내장 옵션 + 커스텀 폰트 로딩
- **언어** &mdash; 한국어, English
- **키보드 단축키** &mdash; 완전 재매핑 가능, 모든 동작 커스터마이즈
- **템플릿 편집기** &mdash; 템플릿 활성화/비활성화, 필드 커스터마이즈
- **그래프 물리** &mdash; 보관함별 영구 설정
- **태그 색상** &mdash; 태그 네임스페이스별 10가지 컬러 스킴

---

## 다운로드

[Releases](../../releases/latest) 페이지에서 다운로드:

| 파일 | 설명 |
|------|------|
| `Notology_x.x.x_x64-setup.exe` | Windows 설치 파일 (권장) |
| `Notology_x.x.x_x64_en-US.msi` | MSI 설치 파일 |

**요구 사항:** Windows 10 (1803+) 또는 Windows 11, 64비트, 4GB+ RAM

---

## 빠른 시작

```
1. Releases에서 다운로드 & 설치
2. Notology 실행
3. "보관함 열기" 클릭 → 아무 폴더 선택
4. Ctrl+N → 템플릿 선택 → 작성 시작
5. [[ 입력하여 노트 연결
6. Ctrl+Shift+F → 그래프 탭으로 지식 네트워크 시각화
```

> **팁:** 보관함 폴더를 NAS나 외장 드라이브에 두면 여러 컴퓨터에서 사용할 수 있습니다.

---

## 키보드 단축키

| 분류 | 단축키 | 동작 |
|------|--------|------|
| **네비게이션** | `Ctrl+N` | 새 노트 |
| | `Ctrl+Shift+F` | 검색 |
| | `Ctrl+Shift+C` | 캘린더 |
| | `Ctrl+Left` | 사이드바 토글 |
| | `Ctrl+Right` | 호버 패널 토글 |
| **서식** | `Ctrl+B / I / U` | 굵게 / 기울임 / 밑줄 |
| | `Ctrl+Shift+X` | 취소선 |
| | `Ctrl+E` | 인라인 코드 |
| | `Ctrl+Shift+H` | 하이라이트 |
| | `Ctrl+1` ~ `6` | 제목 1~6 |
| **블록** | `Ctrl+Shift+8 / 7 / 9` | 글머리 / 번호 / 할일 목록 |
| | `Ctrl+Shift+B` | 인용문 |
| | `Ctrl+Shift+E` | 코드 블록 |
| **시스템** | `Ctrl+S` | 저장 |
| | `Ctrl+D` | 노트 삭제 |
| | `Ctrl+M` | 메모 토글 |
| | `Ctrl+Z / Shift+Z` | 실행 취소 / 다시 실행 |

모든 단축키는 **설정 > 단축키**에서 재매핑 가능합니다.

---

## 소스에서 빌드

```bash
# 사전 요구 사항: Node.js 18+, Rust 1.77+, Tauri v2 prerequisites
git clone https://github.com/ehxhf789789/Notology.git
cd Notology
npm install

# 개발 모드
npx tauri dev

# 프로덕션 빌드 (난독화, devtools 비활성화)
npx tauri build -- --no-default-features
```

---

## 기술 스택

| 계층 | 기술 |
|------|------|
| **프레임워크** | [Tauri v2](https://v2.tauri.app/) (Rust + WebView2) |
| **프론트엔드** | React 19, TypeScript, Vite 7 |
| **에디터** | [TipTap](https://tiptap.dev/) + 11개 커스텀 확장 |
| **상태 관리** | [Zustand](https://zustand.docs.pmnd.rs/) (10개 스토어) |
| **검색** | [Tantivy](https://github.com/quickwit-oss/tantivy) (Rust 전문 검색 엔진) |
| **그래프** | [force-graph](https://github.com/vasturiano/force-graph) (d3-force) |
| **파일 감시** | [notify](https://github.com/notify-rs/notify) (크로스 플랫폼) |

---

## 로드맵

- [ ] macOS / Linux 빌드
- [ ] 플러그인 시스템
- [ ] 모바일 앱
- [ ] AI 기반 추천
- [ ] PDF 주석
- [ ] 내보내기 (PDF / HTML / Docx)

---

## 기여하기

1. 리포지토리 Fork
2. 브랜치 생성 (`git checkout -b feature/your-feature`)
3. 커밋 & Push
4. Pull Request 생성

버그 보고 및 기능 요청: [GitHub Issues](../../issues)

---

## 라이선스

[MIT 라이선스](LICENSE) &mdash; 자유롭게 사용, 수정, 배포할 수 있습니다.

---

<div align="center">
  <sub>Tauri, React, Rust로 제작되었습니다</sub><br />
  <strong>Notology</strong> &mdash; 당신의 지식을, 구조화하고 연결합니다.
</div>

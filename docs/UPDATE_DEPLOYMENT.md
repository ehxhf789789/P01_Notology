# Notology 업데이트 배포 가이드

## 개요

Notology는 Tauri의 내장 업데이터 플러그인을 사용하여 자동 업데이트를 지원합니다.

### 업데이트 흐름
1. 앱 시작 시 업데이트 서버에서 `latest.json` 확인
2. 새 버전이 있으면 사용자에게 알림
3. 사용자가 "설치" 클릭 시 다운로드 및 설치
4. 앱 재시작으로 업데이트 완료

---

## 새 버전 배포 절차

### 1. 버전 번호 업데이트

다음 파일들에서 버전을 업데이트합니다:

```bash
# tauri.conf.json
"version": "1.0.1"

# Cargo.toml
version = "1.0.1"

# package.json (선택)
"version": "1.0.1"
```

### 2. 프로덕션 빌드

```bash
npx tauri build
```

빌드 결과물:
- `src-tauri/target/release/bundle/nsis/Notology_X.X.X_x64-setup.exe`
- `src-tauri/target/release/bundle/msi/Notology_X.X.X_x64_en-US.msi`

### 3. 서명 키 생성 (최초 1회)

```bash
npx tauri signer generate -w ~/.tauri/notology.key
```

**중요**: 생성된 키를 안전하게 보관하세요!
- 개인키: `~/.tauri/notology.key`
- 공개키: `~/.tauri/notology.key.pub`

공개키를 `tauri.conf.json`의 `plugins.updater.pubkey`에 설정합니다.

### 4. 인스톨러 서명

```bash
npx tauri signer sign "src-tauri/target/release/bundle/nsis/Notology_X.X.X_x64-setup.exe" -k ~/.tauri/notology.key
```

서명 파일이 생성됩니다: `Notology_X.X.X_x64-setup.exe.sig`

### 5. 업데이트 매니페스트 생성

```bash
node scripts/generate-update-manifest.js 1.0.1 "버그 수정 및 성능 개선"
```

생성된 `latest.json`을 수정하여 서명 추가:

```json
{
  "version": "1.0.1",
  "notes": "버그 수정 및 성능 개선",
  "pub_date": "2026-01-28T12:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<.sig 파일 내용>",
      "url": "https://github.com/your-repo/releases/download/v1.0.1/Notology_1.0.1_x64-setup.exe"
    }
  }
}
```

### 6. GitHub Release 생성

1. GitHub에서 새 Release 생성
2. Tag: `v1.0.1`
3. Release title: `Notology v1.0.1`
4. 파일 업로드:
   - `Notology_1.0.1_x64-setup.exe`
   - `Notology_1.0.1_x64_en-US.msi`
   - `latest.json`
5. Release 노트 작성

---

## 설정 파일

### tauri.conf.json

```json
{
  "plugins": {
    "updater": {
      "pubkey": "<공개키>",
      "endpoints": [
        "https://github.com/your-repo/releases/latest/download/latest.json"
      ],
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

### 설치 모드

- `passive`: 사용자 확인 후 설치 (권장)
- `basicUi`: 기본 UI로 설치
- `quiet`: 조용히 설치

---

## 사용자 경험

### 신규 설치 사용자
1. GitHub Releases에서 최신 인스톨러 다운로드
2. 설치 실행
3. 완료

### 기존 사용자 업데이트
1. 앱 시작 시 자동으로 업데이트 확인
2. 새 버전 알림 표시
3. "설치" 버튼 클릭
4. 다운로드 진행률 표시
5. 자동 재시작 및 업데이트 적용

---

## 문제 해결

### 업데이트가 감지되지 않는 경우
- `latest.json` URL이 올바른지 확인
- 버전 번호가 현재 버전보다 높은지 확인
- 네트워크 연결 확인

### 서명 검증 실패
- 공개키가 `tauri.conf.json`에 올바르게 설정되었는지 확인
- `.sig` 파일 내용이 `latest.json`에 정확히 복사되었는지 확인

### 설치 실패
- 관리자 권한으로 실행
- 앱이 완전히 종료되었는지 확인
- 안티바이러스 소프트웨어 확인

---

## 자동화 (GitHub Actions)

`.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Rust
        uses: dtolnay/rust-action@stable

      - name: Install dependencies
        run: npm install

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'Notology ${{ github.ref_name }}'
          releaseBody: 'See the changelog for details.'
          releaseDraft: true
          prerelease: false
          includeUpdaterJson: true
```

---

## 체크리스트

새 버전 배포 전 확인:

- [ ] 버전 번호 업데이트 (tauri.conf.json, Cargo.toml)
- [ ] 빌드 성공 확인
- [ ] 인스톨러 서명
- [ ] latest.json 생성 및 서명 추가
- [ ] GitHub Release 생성
- [ ] 파일 업로드 (인스톨러, latest.json)
- [ ] 업데이트 테스트

# 국가법령 검색기 (PWA)

법제처 OPEN API 기반의 국가법령 검색 + 산업안전 트렌드 PWA.

## 📦 포함 파일

| 파일 | 역할 |
|------|------|
| `index.html` | 단일 페이지 앱 본체 |
| `manifest.webmanifest` | PWA 매니페스트 |
| `sw.js` | Service Worker (오프라인 캐시) |
| `icon.svg` / `icon-maskable.svg` | PWA 아이콘 |
| `.github/workflows/deploy.yml` | GitHub Pages 자동 배포 |
| `.nojekyll` | Jekyll 비활성화 |
| `netlify.toml`, `proxy.js` | (선택) Netlify 배포용 — GitHub Pages 사용 시 무시됨 |

## 🚀 GitHub Pages 배포 절차

### 1. 새 리포지토리 만들기

GitHub에서 새 리포지토리 생성 (예: `lawsearch`). **Public** 으로 만들어야 무료 플랜에서 Pages가 동작합니다.

### 2. 로컬에서 푸시

이 폴더에서 PowerShell 실행:

```powershell
git init
git add .
git commit -m "Initial PWA"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/<REPO_NAME>.git
git push -u origin main
```

### 3. GitHub Pages 활성화

리포지토리 → **Settings** → **Pages**:

- **Source**: `GitHub Actions` 선택

푸시되면 `.github/workflows/deploy.yml` 워크플로가 자동 실행되어
`https://<YOUR_USERNAME>.github.io/<REPO_NAME>/` 주소로 배포됩니다.

### 4. PWA 설치

- **데스크톱(Chrome/Edge)**: 주소창 우측의 설치 아이콘 클릭
- **Android**: 메뉴 → "홈 화면에 추가"
- **iOS Safari**: 공유 → "홈 화면에 추가"

## ⚠️ GitHub Pages에서의 제약

GitHub Pages는 정적 호스팅이라 `proxy.js`(Netlify Function)가 동작하지 않습니다. 영향:

| 기능 | 동작 여부 |
|------|----------|
| 법제처 법령 검색 | ✅ (`api.allorigins.win` 폴백 내장) |
| Yahoo Finance 시세 | ⚠️ CORS 차단되면 미표시 |
| Google Trends / News RSS | ⚠️ 프록시 없으면 미표시 |
| KOSHA 공공API | ⚠️ 프록시 필요 |

**전체 기능을 쓰려면 Netlify 배포가 권장**됩니다. GitHub Pages 배포는 PWA 설치 가능한 법령 검색 핵심 기능 위주가 됩니다.

## 🛠 로컬 미리보기

서비스 워커는 `file://` 에서 동작하지 않습니다. 로컬에서 PWA로 테스트하려면 정적 서버를 띄우세요:

```powershell
# 권장: 정적 파일 + Netlify proxy 호환 로컬 서버
npm run dev

# npm이 설치되어 있지 않은 Windows 환경
.\run-local.bat
# 또는 PowerShell
.\run-local.ps1

# 포트를 바꾸고 싶을 때
$env:PORT=8090; npm run dev
```

`http://127.0.0.1:8080` 에서 열고 DevTools → Application 탭에서 Service Worker / Manifest 확인.

`dev-server.js`는 `/.netlify/functions/proxy?url=...` 경로를 로컬에서도 처리합니다. 일반 `python -m http.server`나 `npx serve`로도 화면은 열 수 있지만, 법제처·KOSHA·시세·트렌드처럼 CORS가 있는 API는 로컬에서 실패할 수 있습니다.

파싱 디버그 로그가 필요하면 주소 뒤에 `?debug=1`을 붙여 여세요.

## 🔁 캐시 갱신

배포 후 사용자 브라우저가 옛 버전을 캐시하면 `sw.js` 상단의 `VERSION` 값을 올려 재푸시하세요. 사용자 측에서 다음 방문 시 새 SW가 활성화됩니다.

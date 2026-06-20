
# WellNote-Service 명세서

## 개요
웹,모바일에서 메모기능을 지원하는 서비스
회원가입(소셜로그인 포함), 계정 로그인 기능 제공
문서는 마크다운문서 포멧이고 서버(CloundFlare R2)에 암호화되어 저장
유저는 하루가 지난 메모는 더이상 수정 할 수는 없고 읽기만 가능
지난 메모는 Github의 커밋활동표시 UI(바둑판) 처럼 일자별 메모 여부를 확인하고 검색할 수 있음 
사용자는 첫 가입시 크래딧 100을 제공 받음
하루가 지나서 메모가 Readonly 모드로 들어가면 크래딧 10 차감
2틀연속 글을 쓰게되면 (30자이상) 크래딧 20 추가
크래딧 0 이면 Readonly 글 읽기 금지

사용자 관리를 위한 admin 페이지 제공
사용자 목록, 크래딧관리 (부여, 제거)


## 지원플랫폼
웹
모바일 (안드로이드, 아이폰)


## UI/UX Style
화이트 계열의 심플 깔끔한 노트 트낌
블루색 엣지 
WellNote 심플한 로고 표현  


## 구현
서비스 운영을 위한 dev/stage/prod github CICD 구축, git@github.com:probees1492/wellnote-service.git
앱은 Flutter 기반, github에 CICD 구축, git@github.com:probees1492/wellnote-mobile.git

## 테스트
에이전트 기반 무인 테스트 완료 (에뮬레이터 활용) 



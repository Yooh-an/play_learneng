리팩토링 목표 및 전략
단일 데이터 소스 원칙: 자막 데이터는 오직 background 스크립트가 MPD로부터 확보한 VTT 파일만을 유일한 소스로 사용합니다.
역할의 명확한 분리:
background: 데이터 수집, 파싱, 가공 담당.
content: 데이터 수신 및 React 컴포넌트에 전달 담당.
PlayerController: 전달받은 데이터를 기반으로 시간 동기화 및 최종 렌더링 담당.
불필요한 코드 제거: SubtitleObserver와 관련된 모든 파일과 로직을 삭제하여 코드베이스를 정리하고 혼란의 여지를 없앱니다.
단계별 리팩토링 상세 계획
Step 1: 과감한 삭제 - 레거시(Legacy) 코드 제거
리팩토링의 첫 단계는 불안정성의 근원인 DOM 감시 관련 코드를 모두 제거하는 것입니다.

아래 파일들을 프로젝트에서 완전히 삭제합니다.

src/content/observers/SubtitleObserver.ts
src/utils/subtitleExtractor.ts
subtitleCapturer.ts 파일의 역할 변경

현재 이 파일의 parseVTT 함수는 유용하게 사용되고 있습니다. 이 함수를 src/services/subtitles/vttSubtitleService.ts로 옮기거나, 해당 서비스에서 이 함수를 가져와 사용하도록 구조를 변경하여 VTT 파싱 전용 유틸리티로 역할을 명확히 합니다.
Step 2: background 스크립트 강화 - '데이터 공급자'로 진화
background/index.ts가 단순히 VTT 내용을 전달하는 것을 넘어, 완전히 가공된 Cue 객체 배열을 content 스크립트에 공급하는 역할을 맡습니다.

Step 3: content 스크립트 재정의 - '데이터 중개자' 역할
content/index.tsx는 DOM 감시 로직을 완전히 버리고, background로부터 받은 데이터를 PlayerController에 전달하는 역할만 수행합니다.

파일: src/content/index.tsx

Step 4: PlayerController 리팩토링 - '순수 VTT 렌더러'로 변신
PlayerController.tsx에서 SubtitleObserver와 관련된 모든 코드를 제거하고, props로 받은 VTT 데이터만을 사용하여 자막을 동기화하고 렌더링합니다.

파일: src/components/player/PlayerController.tsx


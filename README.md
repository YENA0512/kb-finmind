🪙 핀마인드 (FinMind) - 디지털 투자 멘탈 주치의

"당신의 수익률보다 중요한 것은 당신의 마음입니다." > 실시간 금융 시황 분석과 AI 심리 케어를 결합하여 투자자의 뇌동매매를 방지하고 이성적인 판단을 돕는 모바일 멘탈 케어 서비스입니다.

🚀 프로젝트 개요

투자 시장의 극심한 변동성 속에서 초보 투자자들은 공포(FUD)와 포모(FOMO)에 휩싸이기 쉽습니다. 핀마인드는 객관적인 시장 데이터(Fact)와 따뜻한 PB(Private Banker)의 조언을 결합하여 투자자가 겪는 심리적 오류를 진단하고 맞춤형 처방전을 제공합니다.

✨ 핵심 기능

1. 마켓 인사이트 (실시간 시장 동향)

SerpApi 기반 실시간 뉴스: 구글 뉴스 엔진과 연동하여 '오늘' 발생한 가장 뜨거운 금융 이슈를 수집합니다. (when:1d 필터 적용으로 최신성 보장)

시장 심리 지수: 공포/탐욕 지수를 시각화하여 현재 시장의 온도를 직관적으로 보여줍니다.

진짜 URL 연결: AI 환각(Hallucination) 없이 실제 언론사의 원문 기사로 직접 연결됩니다.

2. PB 상담실 (AI 멘탈 케어)

인지 편향 진단: 사용자의 고민을 분석하여 손실 회피, 확증 편향 등 현재 빠져있는 심리적 오류를 찾아냅니다.

맞춤 처방전: Gemini 2.5 Flash 기반의 AI PB가 팩트 체크와 함께 정중하고 전문적인 심리 처방을 내립니다.

Action Item: 멘탈 회복을 위해 지금 당장 실천해야 할 구체적인 가이드를 제공합니다.

3. 멘탈 건강 차트 (대시보드)

패닉 지수 추이: 과거 상담 내역을 바탕으로 본인의 패닉 지수 변화를 차트로 확인합니다.

취약 편향 분석: 본인이 반복적으로 겪는 인지 편향(예: #FOMO)을 분석하여 메타 인지를 향상시킵니다.

🛠 기술 스택

Frontend: React, Tailwind CSS, Lucide React

Backend/BaaS: Supabase (Authentication, Database, RLS)

AI & Data API: - Google Gemini 2.5 Flash: 심리 분석 및 뉴스 요약

SerpApi (Google News): 실시간 금융 데이터 수집

Deployment: Vercel

🔑 환경 변수 설정 (.env)

프로젝트 실행을 위해 다음 API 키들이 필요합니다.

VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_SERP_API_KEY=your_serp_api_key
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key


📝 개발 이력 및 이슈 해결

v1.0 ~ v1.3: 초기 기획 및 블랙&옐로우 PB 톤 UI 구현

v1.4 ~ v1.5: Firebase에서 Supabase로 백엔드 전환 및 데이터 스키마 확정

v1.6: 뉴스 실시간성 확보를 위해 네이버 API 및 Bing API 테스트

v1.7 (최종): SerpApi 도입. Gemini 자체 검색의 날짜 오류(수천 일 전 뉴스 노출) 및 가짜 URL 생성 문제를 구글 뉴스 엔진 연동으로 완벽히 해결.

© 2026 FinMind Team. All rights reserved.
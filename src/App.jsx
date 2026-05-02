import React, { useState, useEffect } from 'react';
import { HeartPulse, TrendingUp, MessageSquare, ChevronLeft, Activity, Info, ThumbsUp, ShieldAlert, CheckCircle2, Globe, ArrowUpRight, Search, BarChart3, Clock, Newspaper, CloudRain, Sun, Cloud, BrainCircuit, FileText, X, Maximize2 } from 'lucide-react';
import { supabase } from './lib/supabase';

const stripHtmlTags = (str) => {
  if (!str) return '';
  return str.replace(/<\/?[^>]+(>|$)/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
};

const getTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  const parsedDate = new Date(dateStr);
  if (isNaN(parsedDate.getTime())) return dateStr; // 파싱 실패시 원본 문자열 반환

  const diffInSeconds = Math.floor((new Date() - parsedDate) / 1000);
  if (diffInSeconds < 60) return '방금 전';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
  if (diffInSeconds <= 48 * 3600) return `${Math.floor(diffInSeconds / 3600)}시간 전`;
  return `${Math.floor(diffInSeconds / 86400)}일 전`;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('news'); 
  
  const [inputText, setInputText] = useState('');
  const [isConsultLoading, setIsConsultLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [newsData, setNewsData] = useState(null);
  const [isNewsLoading, setIsNewsLoading] = useState(false);
  const [modalContent, setModalContent] = useState(null);

  // Supabase 인증 및 history 불러오기
  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // 익명 세션이 없을 경우 자동 익명 로그인 처리
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) console.error("Anonymous Sign-in error:", error);
        else setUser(data?.user || null);
      } else {
        setUser(session.user);
      }
    };
    initAuth();

    // 인증 상태 변화 감지
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // 유저 정보가 세팅되면 히스토리 불러오기
  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user]);

  const fetchHistory = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('consultations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("History fetch error:", error);
    } else {
      setHistory(data || []);
    }
  };

  const fetchNews = async () => {
    setIsNewsLoading(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const serpApiKey = import.meta.env.VITE_SERP_API_KEY;
      
      if (!apiKey) throw new Error("Gemini API Key is missing. Check .env file.");
      if (!serpApiKey) throw new Error("SerpApi Key is missing. Check .env file.");
      
      const today = new Date();
      const todayStr = today.toLocaleDateString();
      const timeStr = today.toLocaleTimeString();

      // 1. SerpApi (Google News) 호출
      const query = "글로벌 증시 시황 when:1d";
      const serpUrl = `/api/serp/search.json?engine=google_news&q=${encodeURIComponent(query)}&gl=kr&hl=ko&api_key=${serpApiKey}`;
      
      const res = await fetch(serpUrl);
      const data = await res.json();
      
      if (!data.news_results || data.news_results.length === 0) {
        throw new Error("현재 수집된 실시간 구글 뉴스가 없습니다. 잠시 후 다시 시도해 주세요.");
      }

      const recentItems = data.news_results.slice(0, 5);

      const newsContext = recentItems.map((item, idx) => `
        [뉴스 ${idx + 1}]
        제목: ${item.title}
        출처: ${item.source?.name || item.source}
        링크: ${item.link}
        보도시점: ${item.date}
        썸네일: ${item.thumbnail || ''}
      `).join('\n');

      // 2. Gemini API에 수집된 데이터 주입 후 분석 요청
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ 
            parts: [{ 
              text: `오늘 날짜와 시간은 ${todayStr} ${timeStr}입니다. 다음은 구글 뉴스(SerpApi)로 수집한 실시간 금융 뉴스 5개입니다.\n${newsContext}\n\n제공된 실제 뉴스 데이터를 바탕으로 현재 시장의 1) fearGreedIndex(0~100), 2) sentimentLabel, 3) sentimentDesc, 4) trendingKeywords를 분석하고, 각 뉴스를 1문장으로 요약하여 JSON으로 반환해. 뉴스 원문의 진짜 URL(url)과 썸네일(thumbnail)은 절대 수정하지 말고 그대로 유지해라. 보도시점(timeAgo)도 최대한 원본의 느낌을 살려라.` 
            }] 
          }],
          systemInstruction: {
            parts: [{
              text: `당신은 대한민국 최고 수준의 금융사 수석 애널리스트입니다. 제공된 뉴스 데이터를 바탕으로 지정된 JSON 스키마에 맞게 결과를 반환하세요. 절대 새로운 뉴스를 검색하거나 지어내지 마세요.`
            }]
          },
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                fearGreedIndex: { type: "INTEGER", description: "시장 공포/탐욕 지수 (0: 극단적 공포 ~ 100: 극단적 탐욕)" },
                sentimentLabel: { type: "STRING", description: "심리 상태 라벨 (예: 극단적 공포, 경계, 중립, 탐욕, 극단적 탐욕)" },
                sentimentDesc: { type: "STRING", description: "현재 시장 심리에 대한 전문적 코멘트 (2~3문장)" },
                trendingKeywords: {
                  type: "ARRAY",
                  items: { type: "STRING", description: "해시태그 제외한 순수 키워드 (예: AI반도체, 금리인하)" }
                },
                newsItems: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      type: { type: "STRING", description: "호재, 악재, 중립/팩트 중 택 1" },
                      headline: { type: "STRING", description: "원본 데이터의 뉴스 헤드라인" },
                      summary: { type: "STRING", description: "해당 뉴스의 핵심 요약 (1~2문장)" },
                      source: { type: "STRING", description: "출처 (예: 한국경제, 매일경제 등, 제공된 원본 제목에서 유추 가능하면 기입)" },
                      timeAgo: { type: "STRING", description: "예: 1시간 전, 30분 전 (제공된 발행일 기반 유추)" },
                      url: { type: "STRING", description: "원본 데이터의 뉴스 링크 URL (절대 임의로 변경하지 말 것)" },
                      thumbnail: { type: "STRING", description: "원본 데이터의 썸네일 URL" }
                    },
                    required: ["type", "headline", "summary", "source", "timeAgo", "url"]
                  }
                }
              },
              required: ["fearGreedIndex", "sentimentLabel", "sentimentDesc", "trendingKeywords", "newsItems"]
            }
          }
        })
      });

      const geminiData = await response.json();
      if (!response.ok) throw new Error(geminiData.error?.message || "News Fetch Failed");

      // schema가 강제되므로 순수 JSON 텍스트 반환을 신뢰할 수 있음
      const textResult = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const parsedData = JSON.parse(textResult);
      
      setNewsData(parsedData);
    } catch (error) {
      console.error("News fetch error:", error);
      setNewsData({
        fearGreedIndex: 50,
        sentimentLabel: "조회 지연",
        sentimentDesc: "현재 시장 데이터를 불러오고 있습니다. 잠시 후 새로고침해 주시길 바랍니다.",
        trendingKeywords: ["데이터조회중", "시장동향"],
        newsItems: []
      });
    } finally {
      setIsNewsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'news' && !newsData && !isNewsLoading) {
      fetchNews();
    }
  }, [activeTab, newsData, isNewsLoading]);

  const handleConsultSubmit = async () => {
    if (!inputText.trim() || !user) return;
    setIsConsultLoading(true);
    setCurrentResult(null);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Gemini API Key is missing. Check .env file.");

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `고객님의 고민: "${inputText}"` }] }],
          systemInstruction: {
            parts: [{ 
              text: `당신은 핀마인드의 10년 차 수석 프라이빗 뱅커(PB)입니다. 
              고객을 존중하고 든든한 신뢰감을 주는 어조(~합니다, ~하시길 권장합니다, 고객님)를 사용하세요.
              고객의 불안한 고민을 듣고, Google Search를 활용해 객관적 팩트를 체크한 뒤 멘탈 처방전을 JSON으로 제공하세요.
              추가로, 고객의 텍스트를 분석하여 현재 겪고 있는 '투자 인지 편향'(예: FOMO, 손실 회피 편향, 확증 편향, 군중 심리 등)을 진단하세요.
              **경고: 절대로 인사말이나 부연 설명을 덧붙이지 말고, 오직 중괄호 {} 로 시작하고 끝나는 순수 JSON 데이터만 반환하세요.**
              반드시 다음 JSON 키를 그대로 사용하세요:
              {
                "panicScore": 80, // 0~100 사이의 패닉 지수
                "emotion": "시장 변동성에 따른 일시적 불안",
                "cognitiveBias": "손실 회피 편향", // 사용자가 겪고 있는 투자 인지 편향 (짧은 단어)
                "factCheck": "고객이 고민하는 종목/상황에 대한 최신 팩트 리포트",
                "prescription": "PB의 따뜻하고 전문적인 대처 조언",
                "actionItem": "오늘은 시장을 끄고 편히 쉬시길 권장합니다."
              }` 
            }]
          },
          tools: [{ google_search: {} }]
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Consult Request Failed");

      const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const jsonMatch = textResult.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("JSON format not found in response.");
      const parsedResult = JSON.parse(jsonMatch[0]);

      // Supabase db insert
      const { error } = await supabase.from('consultations').insert([{
        user_id: user.id,
        input_text: inputText,
        result: parsedResult
      }]);

      if (error) {
        console.error("Supabase insert error:", error);
      } else {
        // 성공 시 히스토리 갱신
        fetchHistory();
      }

      setCurrentResult(parsedResult);
      setInputText('');
    } catch (error) {
      console.error("Consult error:", error);
    } finally {
      setIsConsultLoading(false);
    }
  };

  const getTagColor = (type) => {
    if(type.includes('호재')) return 'text-emerald-700 bg-emerald-100/80';
    if(type.includes('악재')) return 'text-red-700 bg-red-100/80';
    return 'text-slate-700 bg-slate-200/80';
  };

  const Header = () => (
    <header className="bg-[#1A1A1A] text-white p-4 shadow-md flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center space-x-2.5">
        <div className="bg-[#FFCC00] p-1.5 rounded-lg">
          <Activity className="w-5 h-5 text-[#1A1A1A] stroke-[2.5]" />
        </div>
        <h1 className="text-[19px] font-extrabold tracking-tight">FinMind</h1>
      </div>
      <div className="text-[11px] font-bold text-[#1A1A1A] bg-[#FFCC00] px-2.5 py-1.5 rounded-full flex items-center shadow-sm">
        <ShieldAlert className="w-3.5 h-3.5 mr-1" />
        고객 전담 주치의
      </div>
    </header>
  );

  const BottomNav = () => (
    <nav className="bg-white border-t border-gray-200 flex justify-around sticky bottom-0 z-20 pb-safe shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
      {[
        { id: 'news', icon: BarChart3, label: '마켓 인사이트' },
        { id: 'consult', icon: MessageSquare, label: 'PB 상담실' },
        { id: 'chart', icon: TrendingUp, label: '건강 차트' }
      ].map((tab) => (
        <button 
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex-1 py-3.5 flex flex-col items-center space-y-1 transition-all ${activeTab === tab.id ? 'text-[#1A1A1A] -translate-y-0.5' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <tab.icon className={`w-[22px] h-[22px] ${activeTab === tab.id ? 'stroke-[2.5] text-[#1A1A1A]' : 'stroke-2'}`} />
          <span className={`text-[10px] ${activeTab === tab.id ? 'font-extrabold' : 'font-semibold'}`}>{tab.label}</span>
          {activeTab === tab.id && <div className="w-1 h-1 bg-[#FFCC00] rounded-full mt-1" />}
        </button>
      ))}
    </nav>
  );

  const NewsView = () => (
    <div className="p-5 pb-24 animate-in fade-in duration-500 bg-[#F9FAFB] min-h-full">
      <div className="mb-7">
        <h2 className="text-[24px] font-extrabold text-[#1A1A1A] tracking-tight">실시간 마켓 인사이트</h2>
        <p className="text-[14px] text-gray-500 mt-2 font-medium leading-relaxed">
          현재 시장의 객관적인 온도와<br/>고객님의 투자를 좌우할 핵심 이슈를 확인하세요.
        </p>
      </div>

      {isNewsLoading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="relative w-12 h-12 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-gray-100"></div>
            <div className="absolute inset-0 rounded-full border-4 border-[#FFCC00] border-t-transparent animate-spin"></div>
          </div>
          <p className="text-[14px] font-bold text-gray-600">시장 데이터를 분석 중입니다...</p>
        </div>
      ) : newsData ? (
        <div className="space-y-8">
          <div className="bg-white rounded-[20px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <Globe className="w-5 h-5 text-blue-600" />
                <h3 className="text-[17px] font-bold text-[#1A1A1A]">시장 심리 지수 <span className="text-gray-400 font-medium text-[15px] ml-0.5">(Market Sentiment)</span></h3>
              </div>
              <span className="text-[13px] font-bold px-3 py-1.5 bg-[#FFF4ED] text-[#E05200] rounded-md">
                {newsData.sentimentLabel}
              </span>
            </div>

            <div className="relative w-full h-4 bg-gradient-to-r from-[#FF4D4D] via-[#FFCC00] to-[#22C55E] rounded-full mb-3 shadow-inner">
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white border-[3px] border-[#1A1A1A] rounded-full shadow-md transition-all duration-1000 ease-out"
                style={{ left: `calc(${Math.max(5, Math.min(95, newsData.fearGreedIndex || 50))}% - 12px)` }}
              />
            </div>
            
            <div className="flex justify-between text-[11px] font-bold text-gray-400 mb-6 px-1">
              <span>극단적 공포</span>
              <span>중립</span>
              <span>극단적 탐욕</span>
            </div>

            <div className="bg-[#F8F9FA] p-4 rounded-xl">
              <p className="text-[14px] text-gray-700 leading-relaxed font-medium">
                {newsData.sentimentDesc}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-[16px] font-bold text-[#1A1A1A] mb-3 flex items-center">
              <TrendingUp className="w-4 h-4 mr-1.5 text-[#1A1A1A]" />
              실시간 급상승 키워드
            </h3>
            <div className="flex flex-wrap gap-2">
              {newsData.trendingKeywords?.map((kw, idx) => (
                <a 
                  key={idx} 
                  href={`https://www.google.com/search?q=${encodeURIComponent(kw)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-white border border-gray-200 text-gray-600 rounded-full text-[13px] font-semibold hover:border-[#1A1A1A] hover:text-[#1A1A1A] transition-colors shadow-sm inline-block"
                >
                  #{kw}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-[16px] font-bold text-[#1A1A1A] mb-4 flex items-center">
              <Newspaper className="w-4 h-4 mr-1.5 text-[#1A1A1A]" />
              AI 요약: 오늘의 핵심 금융 뉴스
            </h3>
            <div className="space-y-3.5">
              {newsData.newsItems?.map((news, idx) => {
                const isHot = news.timeAgo && (news.timeAgo.includes('분 전') || news.timeAgo.includes('방금') || news.timeAgo.includes('시간 전'));
                return (
                <a 
                  key={idx} 
                  href={news.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block bg-white p-5 rounded-[20px] border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-md hover:border-[#FFCC00]/50 transition-all group"
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${getTagColor(news.type)}`}>
                      {news.type}
                    </span>
                    <div className="flex items-center text-gray-400 text-[12px] font-medium bg-gray-50 px-2 py-0.5 rounded-md">
                      <Clock className="w-3 h-3 mr-1" />
                      {news.timeAgo}
                    </div>
                  </div>
                  <div className="flex gap-4">
                    {news.thumbnail && (
                      <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-gray-100">
                        <img src={news.thumbnail} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-[#1A1A1A] text-[16px] leading-snug mb-2 group-hover:text-blue-600 transition-colors flex justify-between items-start">
                        <span className="pr-2 leading-tight">
                          {isHot && (
                            <span className="inline-block bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full mr-2 tracking-wider align-middle shadow-sm">HOT 🔥</span>
                          )}
                          {news.headline}
                        </span>
                      </h4>
                      <p className="text-[14px] text-gray-500 leading-relaxed line-clamp-2">
                        {news.summary}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[12px] font-medium text-gray-400 border-t border-gray-50 pt-3">
                    <span>출처: {news.source}</span>
                    <span className="text-blue-500 font-semibold flex items-center group-hover:underline">
                      원문 보기 <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
                    </span>
                  </div>
                </a>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  const ConsultView = () => {
    if (currentResult) {
      return (
        <div className="p-5 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24 bg-[#F9FAFB] min-h-full">
          <button onClick={() => setCurrentResult(null)} className="flex items-center text-[14px] font-bold text-gray-500 hover:text-[#1A1A1A] transition">
            <ChevronLeft className="w-4 h-4 mr-0.5" />
            새로운 상담하기
          </button>

          <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-[#1A1A1A] p-6 flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#FFCC00] to-yellow-200"></div>
              <Activity className="w-8 h-8 text-[#FFCC00] mb-3" />
              <h2 className="text-[18px] font-bold text-white mb-1">맞춤형 멘탈 케어 리포트</h2>
              <p className="text-[13px] font-medium text-gray-400">{currentResult.emotion}</p>
              
              <div className="mt-6 bg-white/10 px-5 py-3 rounded-2xl flex items-center space-x-3 backdrop-blur-sm">
                <span className="text-[11px] font-bold text-[#FFCC00] tracking-wider">PANIC SCORE</span>
                <span className="text-[24px] font-black text-white">{currentResult.panicScore}<span className="text-[14px] text-gray-400 font-semibold ml-1">/100</span></span>
              </div>

              {currentResult.cognitiveBias && (
                <div className="mt-4 inline-flex items-center space-x-1.5 bg-white/10 px-3.5 py-1.5 rounded-full backdrop-blur-sm border border-white/5">
                  <BrainCircuit className="w-4 h-4 text-[#FFCC00]" />
                  <span className="text-[12.5px] font-bold text-white tracking-wide">진단된 편향: {currentResult.cognitiveBias}</span>
                </div>
              )}
            </div>
            
            <div className="p-6 space-y-7">
              <div>
                <h3 className="text-[15px] font-bold text-[#1A1A1A] mb-3 flex items-center">
                  <Search className="w-4 h-4 mr-2 text-blue-600" />
                  객관적 팩트 체크
                </h3>
                <div className="bg-[#F8FAFC] p-4.5 rounded-2xl text-[14px] leading-relaxed text-gray-700 font-medium">
                  <div className="line-clamp-4">{currentResult.factCheck}</div>
                  {currentResult.factCheck?.length > 80 && (
                    <button onClick={() => setModalContent({ title: '객관적 팩트 체크', content: currentResult.factCheck })} className="mt-2.5 text-blue-600 text-[13px] font-bold flex items-center hover:underline">
                      <Maximize2 className="w-3.5 h-3.5 mr-1" /> 전체 보기
                    </button>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-[15px] font-bold text-[#1A1A1A] mb-3 flex items-center">
                  <MessageSquare className="w-4 h-4 mr-2 text-[#FFCC00]" />
                  PB의 멘탈 처방전
                </h3>
                <div className="text-[14.5px] leading-relaxed text-gray-700 bg-yellow-50/50 p-4.5 rounded-2xl border border-yellow-100/50 font-medium">
                  <div className="line-clamp-4">{currentResult.prescription}</div>
                  {currentResult.prescription?.length > 80 && (
                    <button onClick={() => setModalContent({ title: 'PB의 멘탈 처방전', content: currentResult.prescription })} className="mt-2.5 text-yellow-600 text-[13px] font-bold flex items-center hover:underline">
                      <Maximize2 className="w-3.5 h-3.5 mr-1" /> 전체 보기
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-[#1A1A1A] p-5 rounded-2xl flex items-start space-x-3.5 shadow-md">
                <CheckCircle2 className="w-[22px] h-[22px] text-[#FFCC00] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-[12px] font-bold text-gray-400 mb-1.5 tracking-wide">고객님을 위한 ACTION ITEM</h4>
                  <p className="text-[14.5px] font-semibold leading-snug text-white">{currentResult.actionItem}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full p-6 relative pb-24 bg-white">
        <div className="flex-1 overflow-y-auto mt-2">
          <div className="space-y-2.5 mb-6">
            <h2 className="text-[26px] font-extrabold text-[#1A1A1A] tracking-tight leading-[1.3]">
              고객님, 현재 어떤 점이<br/>가장 불안하신가요?
            </h2>
            <p className="text-[15px] text-gray-500 leading-relaxed font-medium">
              급락하는 주가나 뉴스 때문에 마음이 힘드신가요?<br/>
              저희에게 편안하게 말씀해 주시면, 팩트를 확인해 드립니다.
            </p>
          </div>

          <div className="bg-[#F9FAFB] rounded-[24px] border border-gray-200 p-2 focus-within:border-[#FFCC00] focus-within:bg-white focus-within:ring-4 focus-within:ring-yellow-100 transition-all duration-300">
            <textarea
              className="w-full h-48 p-4 bg-transparent border-none resize-none focus:ring-0 text-[#1A1A1A] placeholder-gray-400 text-[15px] leading-relaxed font-medium"
              placeholder="예: 어제 밤에 기술주들이 급락했는데, 지금이라도 다 팔고 현금화해야 할까요? 너무 불안해서 잠이 안 오네요..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isConsultLoading}
            />
          </div>

          {isConsultLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-5">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-gray-100"></div>
                <div className="absolute inset-0 rounded-full border-4 border-[#1A1A1A] border-t-transparent animate-spin"></div>
                <Activity className="w-6 h-6 text-[#1A1A1A] animate-pulse" />
              </div>
              <div className="text-center">
                <p className="text-[16px] font-bold text-[#1A1A1A]">고객님의 상황을 면밀히 분석 중입니다</p>
                <p className="text-[14px] font-medium text-gray-500 mt-1.5">잠시만 기다려 주시길 바랍니다...</p>
              </div>
            </div>
          ) : (
            <button
              onClick={handleConsultSubmit}
              disabled={!inputText.trim()}
              className="w-full mt-6 bg-[#1A1A1A] text-[#FFCC00] font-bold text-[16px] py-4.5 rounded-[18px] shadow-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black transition-all active:scale-[0.98]"
            >
              전문가 진단 및 처방 받기
            </button>
          )}
        </div>
      </div>
    );
  };

  const ChartView = () => {
    // 멘탈 날씨 계산
    const recentHistory = [...history].slice(0, 7).reverse(); // 최근 7개 (과거순 정렬)
    const avgPanic = history.length > 0 
      ? Math.round(history.slice(0, 5).reduce((acc, curr) => acc + (curr.result?.panicScore || 0), 0) / Math.min(history.length, 5))
      : 0;
    
    let weatherInfo = { icon: Sun, text: "맑음", color: "text-amber-500", bg: "bg-amber-50", desc: "안정적이고 차분한 멘탈 상태입니다." };
    if (avgPanic > 70) weatherInfo = { icon: CloudRain, text: "폭우", color: "text-blue-600", bg: "bg-blue-50", desc: "극심한 불안감에 시달리고 계시네요." };
    else if (avgPanic > 40) weatherInfo = { icon: Cloud, text: "흐림", color: "text-gray-500", bg: "bg-gray-100", desc: "조금의 경계심과 불안이 감도는 상태입니다." };

    // 취약 편향 집계
    const biasCounts = {};
    history.forEach(item => {
      const bias = item.result?.cognitiveBias;
      if (bias && bias !== '발견되지 않음' && bias !== '없음' && bias.length > 0) {
        biasCounts[bias] = (biasCounts[bias] || 0) + 1;
      }
    });
    const topBiases = Object.entries(biasCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);

    return (
      <div className="p-6 pb-24 bg-[#F9FAFB] min-h-full">
        <div className="mb-7">
          <h2 className="text-[24px] font-extrabold text-[#1A1A1A] tracking-tight">멘탈 건강 대시보드</h2>
          <p className="text-[14px] font-medium text-gray-500 mt-2">고객님의 멘탈 상태와 취약점을 한눈에 분석해 드립니다.</p>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[24px] border border-gray-200 border-dashed">
            <Activity className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-[15px] font-bold text-gray-400">아직 등록된 상담 이력이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* 멘탈 날씨 위젯 */}
            <div className="bg-white p-6 rounded-[24px] shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-gray-100 flex items-center space-x-5">
              <div className={`p-4 rounded-2xl ${weatherInfo.bg}`}>
                <weatherInfo.icon className={`w-10 h-10 ${weatherInfo.color}`} />
              </div>
              <div>
                <h3 className="text-[13px] font-bold text-gray-400 mb-1">최근 멘탈 날씨</h3>
                <div className="flex items-end space-x-2">
                  <span className={`text-[22px] font-black ${weatherInfo.color}`}>{weatherInfo.text}</span>
                  <span className="text-[13px] font-semibold text-gray-500 mb-1.5">(평균 패닉: {avgPanic})</span>
                </div>
                <p className="text-[13px] font-medium text-gray-600 mt-1">{weatherInfo.desc}</p>
              </div>
            </div>

            {/* 패닉 지수 트렌드 (Bar Chart) */}
            <div className="bg-white p-6 rounded-[24px] shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-gray-100">
              <h3 className="text-[15px] font-bold text-[#1A1A1A] mb-6 flex items-center">
                <TrendingUp className="w-4 h-4 mr-2 text-blue-500" />
                최근 패닉 지수 추이
              </h3>
              <div className="flex items-end justify-between h-32 mt-4 px-2 space-x-2">
                {recentHistory.map((item, idx) => {
                  const score = item.result?.panicScore || 0;
                  const heightPercent = Math.max(10, score);
                  let barColor = "from-green-400 to-green-500";
                  if(score > 70) barColor = "from-red-400 to-red-500";
                  else if(score > 40) barColor = "from-orange-400 to-orange-500";

                  const date = new Date(item.created_at);
                  return (
                    <div key={idx} className="flex flex-col items-center flex-1 group h-full">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-bold text-gray-500 mb-2">
                        {score}
                      </div>
                      <div className="w-full max-w-[28px] bg-gray-100 rounded-t-lg relative flex justify-end flex-col h-full overflow-hidden">
                        <div 
                          className={`w-full bg-gradient-to-t ${barColor} rounded-t-lg transition-all duration-700 ease-out`}
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 mt-3">{date.getMonth()+1}/{date.getDate()}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 취약 편향 태그 클라우드 */}
            {topBiases.length > 0 && (
              <div className="bg-white p-6 rounded-[24px] shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-gray-100">
                <h3 className="text-[15px] font-bold text-[#1A1A1A] mb-4 flex items-center">
                  <BrainCircuit className="w-4 h-4 mr-2 text-purple-500" />
                  나의 멘탈 취약점
                </h3>
                <div className="flex flex-wrap gap-2.5">
                  {topBiases.map(([bias, count], idx) => (
                    <div key={idx} className="px-3.5 py-2 bg-purple-50 border border-purple-100 text-purple-700 rounded-xl text-[13px] font-bold flex items-center shadow-sm">
                      #{bias}
                      <span className="ml-2 bg-white px-2 py-0.5 rounded-full text-[11px] text-purple-500 font-black">{count}회</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 과거 처방 이력 리스트 */}
            <div className="mt-8">
              <h3 className="text-[16px] font-extrabold text-[#1A1A1A] mb-4 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-[#FFCC00]" />
                과거 상담 리포트
              </h3>
              <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2">
                {history.map((item) => {
                  const date = new Date(item.created_at);
                  const formattedDate = `${date.getMonth()+1}월 ${date.getDate()}일`;
                  return (
                    <div key={item.id} className="bg-white p-5 rounded-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-gray-100 flex flex-col space-y-3.5">
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col space-y-2">
                          <div className="text-[12px] font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-md w-fit">
                            {formattedDate}
                          </div>
                          {item.result?.cognitiveBias && item.result.cognitiveBias !== '발견되지 않음' && item.result.cognitiveBias !== '없음' && (
                            <span className="text-[12px] font-extrabold text-purple-600">#{item.result.cognitiveBias}</span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 bg-gray-50 px-2.5 py-1.5 rounded-xl border border-gray-100">
                          <span className="text-[10px] font-bold text-gray-400 tracking-wider">PANIC</span>
                          <span className={`text-[13px] font-black ${
                            item.result?.panicScore > 70 ? 'text-red-600' : 
                            item.result?.panicScore > 40 ? 'text-orange-600' : 
                            'text-green-600'
                          }`}>
                            {item.result?.panicScore}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[15px] text-[#1A1A1A] font-bold leading-snug line-clamp-2">
                          "{item.input_text}"
                        </p>
                        <div className="mt-3 text-[14px] text-gray-600 bg-[#F8FAFC] p-4 rounded-xl leading-relaxed font-medium border border-slate-100">
                          <span className="font-bold text-[#1A1A1A]">PB 코멘트:</span> 
                          <div className="line-clamp-3 mt-1">{item.result?.prescription}</div>
                          {item.result?.prescription?.length > 70 && (
                            <button onClick={() => setModalContent({ title: '상담 리포트 상세', content: `[내 고민]\n${item.input_text}\n\n[PB 코멘트]\n${item.result?.prescription}` })} className="mt-2.5 text-blue-600 text-[12px] font-bold flex items-center hover:underline">
                              <Maximize2 className="w-3.5 h-3.5 mr-1" /> 자세히 보기
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#E5E7EB] font-sans flex justify-center">
      <div className="w-full max-w-[420px] bg-white min-h-screen shadow-2xl relative flex flex-col overflow-hidden">
        {Header()}
        <main className="flex-1 overflow-x-hidden overflow-y-auto relative scroll-smooth">
          {activeTab === 'news' && NewsView()}
          {activeTab === 'consult' && ConsultView()}
          {activeTab === 'chart' && ChartView()}
        </main>
        {BottomNav()}

        {/* 공통 팝업(Modal) */}
        {modalContent && (
          <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-5 backdrop-blur-[2px] animate-in fade-in duration-200" onClick={() => setModalContent(null)}>
            <div className="bg-white rounded-[24px] p-6 w-full max-w-[360px] max-h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-5 pb-4 border-b border-gray-100 shrink-0">
                <h3 className="font-extrabold text-[17px] text-[#1A1A1A]">{modalContent.title}</h3>
                <button onClick={() => setModalContent(null)} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-y-auto pr-2 text-gray-700 text-[15px] leading-relaxed whitespace-pre-wrap font-medium pb-2">
                {modalContent.content}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

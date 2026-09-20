import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  AlertCircle,
  RefreshCw,
  Lightbulb,
  Languages,
  Volume2,
  VolumeX,
  Plus,
  Check,
  Calculator,
} from 'lucide-react';
import { ChatMessage, StudentInterest, ConceptNode } from '../types';
import { MathView } from './MathView';
import { apiFetch } from '../utils/apiClient';

export type TutorLanguage = 'English' | 'Hindi' | 'Gujarati';

interface AITutorChatProps {
  concept: ConceptNode;
  interest: StudentInterest;
  struggleNote?: string;
  onClearStruggleNote?: () => void;
  studentId?: string;
}

const LANGUAGE_LABELS: Record<TutorLanguage, { name: string; native: string; badge: string; voiceLang: string }> = {
  English: { name: 'English', native: 'English', badge: 'EN', voiceLang: 'en-IN' },
  Hindi: { name: 'Hindi', native: 'हिंदी', badge: 'HI', voiceLang: 'hi-IN' },
  Gujarati: { name: 'Gujarati', native: 'ગુજરાતી', badge: 'GU', voiceLang: 'gu-IN' },
};

export const AITutorChat: React.FC<AITutorChatProps> = ({
  concept,
  interest,
  struggleNote,
  onClearStruggleNote,
  studentId,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<TutorLanguage>(() => {
    try {
      const saved = localStorage.getItem('learnx_tutor_lang') as TutorLanguage;
      if (saved && (saved === 'English' || saved === 'Hindi' || saved === 'Gujarati')) {
        return saved;
      }
    } catch {}
    return 'English';
  });

  const getWelcomeText = (lang: TutorLanguage, topic: string, hobby: string) => {
    switch (lang) {
      case 'Hindi':
        return `नमस्ते! मैं "${topic}" के लिए आपका पर्सनल मेंटर (Personal Mentor) हूँ। आपकी रुचि **${hobby}** में है, इसलिए मैं उसी के अनुसार उदाहरण और सूत्र समझाऊंगा। अगर आपको कोई भी कदम समझने में दिक्कत हो, तो बस बेझिझक पूछें!`;
      case 'Gujarati':
        return `નમસ્તે! હું "${topic}" માટે તમારો પર્સનલ મેન્ટર (Personal Mentor) છું. તમારી રુચિ **${hobby}** માં છે, તેથી હું સરળ ગુજરાતીમાં દાખલા અને સૂત્રો સમજાવીશ. જ્યાં પણ મૂંઝવણ થાય ત્યાં મને પૂછો!`;
      default:
        return `Hello! I am your personal tutor for **${topic}**. Because your profile highlights **${hobby}**, I connect explanations and formulas to what you enjoy. Feel free to ask anytime if a step feels unclear!`;
    }
  };

  const getStorageKey = () => (studentId ? `learnx_tutor_chat_${studentId}` : null);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const defaultWelcome: ChatMessage = {
      id: 'msg-welcome',
      sender: 'ai',
      text: getWelcomeText(selectedLanguage, concept.title, interest),
      timestamp: 'Just now',
    };

    const key = studentId ? `learnx_tutor_chat_${studentId}` : null;
    if (key) {
      try {
        const saved = localStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Basic data validation
            const isValid = parsed.every((m: any) => m.id && m.sender && m.text);
            if (isValid) return parsed;
          }
        }
      } catch (err) {
        console.warn('Failed to parse cached tutor chat messages:', err);
      }
    }
    return [defaultWelcome];
  });

  // Persist messages whenever they change, bound history size to 50
  useEffect(() => {
    const key = getStorageKey();
    if (key && messages.length > 0) {
      try {
        const recentMessages = messages.slice(-50);
        localStorage.setItem(key, JSON.stringify(recentMessages));
      } catch (err) {
        console.warn('Failed to save tutor chat messages to local storage:', err);
      }
    }
  }, [messages, studentId]);

  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [showMathToolbar, setShowMathToolbar] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleResetChat = () => {
    const key = getStorageKey();
    if (key) {
      try {
        localStorage.removeItem(key);
      } catch (err) {
        console.warn('Failed to clear local storage on reset:', err);
      }
    }
    setMessages([
      {
        id: `msg-reset-${Date.now()}`,
        sender: 'ai',
        text: getWelcomeText(selectedLanguage, concept.title, interest),
        timestamp: 'Just now',
      },
    ]);
  };

  // Sync language changes
  const handleLanguageChange = (newLang: TutorLanguage) => {
    setSelectedLanguage(newLang);
    try {
      localStorage.setItem('learnx_tutor_lang', newLang);
    } catch {}

    const noticeMap: Record<TutorLanguage, string> = {
      English: `Switched language to **English**. AI explanations and KaTeX math formulas will now be presented in English.`,
      Hindi: `भाषा बदलकर **हिंदी (Hindi)** कर दी गई है। अब AI शिक्षक हिंदी में समझाएगा और KaTeX द्वारा सभी सूत्र स्पष्ट रूप से प्रदर्शित होंगे।`,
      Gujarati: `ભાષા બદલીને **ગુજરાતી (Gujarati)** કરી દેવામાં આવી છે. હવે AI શિક્ષક તમને ગુજરાતીમાં સમજાવશે અને KaTeX દ્વારા બધા સૂત્રો સ્પષ્ટ દેખાશે.`,
    };

    setMessages((prev) => [
      ...prev,
      {
        id: `lang-notice-${Date.now()}`,
        sender: 'system',
        text: noticeMap[newLang],
        timestamp: 'Just now',
      },
    ]);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (struggleNote) {
      setMessages((prev) => [
        ...prev,
        {
          id: `struggle-${Date.now()}`,
          sender: 'system',
          text: `Context: ${struggleNote}`,
          timestamp: 'Just now',
          struggleNote,
        },
      ]);
      const strugglePrompt =
        selectedLanguage === 'Hindi'
          ? `मुझे "${concept.title}" में थोड़ी कठिनाई आ रही है। क्या आप ${interest} के किसी उदाहरण से इसके मुख्य सूत्र और अवधारणा को समझा सकते हैं?`
          : selectedLanguage === 'Gujarati'
          ? `મને "${concept.title}" માં થોડી મૂંઝવણ છે. શું તમે ${interest} ના ઉદાહરણ દ્વારા મુખ્ય સૂત્ર અને કોન્સેપ્ટ સમજાવી શકો?`
          : `I am experiencing hesitation with "${concept.title}". Could you walk me through the key intuition and formulas using an analogy from ${interest}?`;

      handleSend(strugglePrompt);
      if (onClearStruggleNote) onClearStruggleNote();
    }
  }, [struggleNote]);

  const handleSend = async (customText?: string) => {
    const textToSend = customText || inputText;
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: 'Just now',
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInputText('');
    setLoading(true);

    try {
      const res = await apiFetch('/api/ai/tutor-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          concept: concept.title,
          struggleDetected: !!struggleNote,
          struggleReason: struggleNote || 'Student inquiry',
          interest,
          language: selectedLanguage,
          history: messages.slice(-6).map((m) => ({ sender: m.sender, text: m.text })),
        }),
              });
  
        if (!res.ok) throw new Error('API Request Failed');
        const json = await res.json();
      const replyText = json.reply || json.data?.reply;

      if (replyText) {
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            text: replyText,
            timestamp: 'Just now',
          },
        ]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      const fallbackError =
        selectedLanguage === 'Hindi'
          ? `आइए "${concept.title}" के बुनियादी सिद्धांतों को देखते हैं। सबसे पहले मुख्य सूत्र पहचानें और फिर एक-एक करके मान रखें। कौन सा भाग अस्पष्ट लग रहा है?`
          : selectedLanguage === 'Gujarati'
          ? `ચાલો "${concept.title}" ના મૂળભૂત નિયમો જોઈએ. સૌથી પહેલા મુખ્ય સૂત્ર ઓળખો અને ત્યારબાદ કિંમતો મૂકો. કયો ભાગ મુશ્કેલ લાગે છે?`
          : `Let's break down "${concept.title}" into clear foundational steps. First identify the constraints, then apply the formula carefully. Which part feels least clear?`;

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: 'ai',
          text: fallbackError,
          timestamp: 'Just now',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Text-to-speech for tutor responses
  const handleSpeak = (text: string, msgId: string) => {
    if (!('speechSynthesis' in window)) return;

    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    // Clean LaTeX and markdown tags for natural speech
    const cleanSpeech = text
      .replace(/\$\$[\s\S]+?\$\$/g, ' mathematical equation ')
      .replace(/\$([^\$]+?)\$/g, '$1')
      .replace(/[*_`#]/g, '')
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 divided by $2')
      .replace(/\\sqrt\{([^}]+)\}/g, 'square root of $1');

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    const targetLang = LANGUAGE_LABELS[selectedLanguage].voiceLang;
    utterance.lang = targetLang;
    utterance.rate = 0.95;

    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  // Insert math symbol or formula snippet into input
  const insertMathSnippet = (snippet: string) => {
    setInputText((prev) => {
      const next = prev ? `${prev} ${snippet} ` : `${snippet} `;
      return next;
    });
    inputRef.current?.focus();
  };

  // Language-specific quick prompts
  const quickPromptsMap: Record<TutorLanguage, string[]> = {
    English: [
      `Explain with a ${interest} analogy`,
      'Step-by-step example with formula',
      'Common misconceptions to avoid',
      'Why is this formula structured this way?',
      'Show derivation of the formula',
    ],
    Hindi: [
      `${interest} के उदाहरण से समझाएं`,
      'कदम-दर-कदम उदाहरण सूत्र सहित हल करें',
      'सामान्य गलतियाँ (Common Mistakes) जिन्हें टालें',
      'यह सूत्र (Formula) कैसे बना है?',
      'विविक्तकर (Discriminant) का क्या महत्व है?',
    ],
    Gujarati: [
      `${interest} ના ઉદાહરણ દ્વારા સમજાવો`,
      'પગલે-પગલે ઉદાહરણ દાખલો સૂત્ર સાથે ગણો',
      'સામાન્ય ભૂલો જે વિદ્યાર્થીઓ કરે છે',
      'આ સૂત્ર (Formula) કેવી રીતે બન્યું છે?',
      'વિવેચક (Discriminant) નું મહત્વ સમજાવો',
    ],
  };

  const inputPlaceholderMap: Record<TutorLanguage, string> = {
    English: `Ask about ${concept.title}, request a formula step, or type math like $x^2 + 5x + 6 = 0$...`,
    Hindi: `${concept.title} के बारे में पूछें, उदाहरण मांगें, या $ax^2 + bx + c = 0$ जैसा समीकरण लिखें...`,
    Gujarati: `${concept.title} વિશે પૂછો, ઉદાહરણ માંગો, અથવા $ax^2 + bx + c = 0$ જેવું સમીકરણ લખો...`,
  };

  const mathSnippets = [
    { label: 'x²', val: '$x^2$' },
    { label: '√x', val: '$\\sqrt{x}$' },
    { label: '±', val: '$\\pm$' },
    { label: 'Δ', val: '$\\Delta$' },
    { label: 'a/b', val: '$\\frac{a}{b}$' },
    { label: 'π', val: '$\\pi$' },
    { label: 'θ', val: '$\\theta$' },
    { label: 'F=ma', val: '$F = ma$' },
    { label: 'y=mx+c', val: '$y = mx + c$' },
    { label: 'Quad Eq', val: '$ax^2 + bx + c = 0$' },
  ];

  return (
    <div className="max-w-3xl mx-auto h-[660px] bg-white dark:bg-[#1c1c1a] rounded-xl border border-stone-200/90 dark:border-stone-800 shadow-2xs flex flex-col overflow-hidden transition-colors">
      {/* Tutor Header */}
      <div className="p-3.5 sm:p-4 border-b border-stone-100 dark:border-stone-800 bg-white dark:bg-[#1c1c1a] flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#114B43] text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif font-semibold text-sm sm:text-base text-stone-900 dark:text-stone-100">
                Socratic AI Mentor
              </h3>
              <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-medium px-2 py-0.5 rounded border border-emerald-200/80 dark:border-emerald-800/60">
                Active KaTeX
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Topic: <span className="font-medium text-stone-800 dark:text-stone-200">{concept.title}</span> • Lens: {interest}
            </p>
          </div>
        </div>

        {/* Controls: Multilingual Selector & Reset */}
        <div className="flex items-center gap-2">
          {/* Language Selector Segmented Switcher */}
          <div
            id="tutor-language-selector"
            className="flex items-center p-0.5 rounded-lg bg-stone-100 dark:bg-[#252422] border border-stone-200 dark:border-stone-700/70"
            title="Choose AI Tutor Language"
          >
            <div className="px-1.5 py-0.5 text-[11px] text-stone-400 dark:text-stone-500 hidden sm:flex items-center gap-1 font-medium">
              <Languages className="w-3 h-3 text-[#114B43] dark:text-emerald-400" />
            </div>
            {(['English', 'Hindi', 'Gujarati'] as TutorLanguage[]).map((lang) => {
              const active = selectedLanguage === lang;
              return (
                <button
                  key={lang}
                  id={`btn-lang-${lang.toLowerCase()}`}
                  onClick={() => handleLanguageChange(lang)}
                  className={`px-2 py-1 text-xs rounded-md font-medium transition-all flex items-center gap-1 ${
                    active
                      ? 'bg-white dark:bg-[#171716] text-[#114B43] dark:text-emerald-400 font-semibold shadow-2xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  <span>{LANGUAGE_LABELS[lang].native}</span>
                  {active && <Check className="w-2.5 h-2.5" />}
                </button>
              );
            })}
          </div>

          <button
            id="btn-reset-chat"
            onClick={handleResetChat}
            className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-stone-400"
            title="Reset conversation"
            aria-label="Start a new chat"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 bg-stone-50/40 dark:bg-[#151514]">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-2.5 ${
              msg.sender === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.sender === 'ai' && (
              <div className="w-6 h-6 rounded-md bg-[#114B43]/10 dark:bg-[#114B43]/30 text-[#114B43] dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-3 h-3" />
              </div>
            )}

            {msg.sender === 'system' ? (
              <div className="w-full text-center my-1.5">
                <span className="inline-flex items-center gap-1.5 text-xs bg-amber-50/90 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/50 px-3 py-1.5 rounded-lg font-medium shadow-2xs">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <MathView text={msg.text} as="span" className="inline text-xs" />
                </span>
              </div>
            ) : (
              <div
                className={`max-w-[86%] rounded-xl p-3.5 text-xs sm:text-sm leading-relaxed transition-all shadow-2xs ${
                  msg.sender === 'user'
                    ? 'bg-[#1C1917] dark:bg-[#20201e] text-stone-100 border border-stone-800 dark:border-stone-700'
                    : 'bg-white dark:bg-[#1c1c1a] text-stone-800 dark:text-stone-100 border border-stone-200/90 dark:border-stone-800 font-sans'
                }`}
              >
                {/* KaTeX Math & Markdown Rendering */}
                <MathView
                  text={msg.text}
                  as="div"
                  className={msg.sender === 'user' ? 'text-stone-100' : 'text-stone-850 dark:text-stone-100'}
                />

                {/* Footer bar with Timestamp & Speech Button */}
                <div
                  className={`text-[10px] mt-2 pt-1 border-t flex items-center justify-between gap-2 ${
                    msg.sender === 'user'
                      ? 'border-stone-700/60 text-stone-400'
                      : 'border-stone-100 dark:border-stone-800/80 text-stone-400 dark:text-stone-500'
                  }`}
                >
                  {msg.sender === 'ai' && (
                    <button
                      onClick={() => handleSpeak(msg.text, msg.id)}
                      className="flex items-center gap-1 text-[11px] text-stone-500 hover:text-[#114B43] dark:hover:text-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-400 rounded px-1"
                      title={speakingMsgId === msg.id ? 'Stop audio' : 'Listen in audio'}
                      aria-label={speakingMsgId === msg.id ? 'Stop reading aloud' : 'Read message aloud'}
                    >
                      {speakingMsgId === msg.id ? (
                        <>
                          <VolumeX className="w-3 h-3 text-rose-500" aria-hidden="true" />
                          <span className="text-[10px] text-rose-500 font-medium">Stop</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3 h-3" aria-hidden="true" />
                          <span className="text-[10px]">Read Aloud</span>
                        </>
                      )}
                    </button>
                  )}
                  <span className="ml-auto">{msg.timestamp}</span>
                </div>
              </div>
            )}

            {msg.sender === 'user' && (
              <div className="w-6 h-6 rounded-md bg-stone-800 dark:bg-stone-700 text-white flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3 h-3" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-stone-400 dark:text-stone-500 pl-8">
            <Sparkles className="w-3.5 h-3.5 text-[#114B43] dark:text-emerald-400 animate-spin" />
            <span>Formulating KaTeX pedagogical response in {selectedLanguage}...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Carousel */}
      <div className="px-3 sm:px-4 py-2 bg-stone-50 dark:bg-[#1a1a19] border-t border-stone-100 dark:border-stone-800 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <span className="text-[11px] font-medium text-stone-400 dark:text-stone-500 shrink-0 flex items-center gap-1">
          <Lightbulb className="w-3 h-3 text-stone-500 dark:text-stone-400" /> {LANGUAGE_LABELS[selectedLanguage].native}:
        </span>
        {quickPromptsMap[selectedLanguage].map((prompt, idx) => (
          <button
            key={idx}
            id={`quick-prompt-${idx}`}
            onClick={() => handleSend(prompt)}
            className="text-xs font-medium px-2.5 py-1 rounded-md bg-white dark:bg-[#252422] border border-stone-200 dark:border-stone-700/80 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:border-stone-400 dark:hover:border-stone-500 transition-all shrink-0 shadow-2xs"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Quick Math Symbols Toolbar (Toggleable) */}
      {showMathToolbar && (
        <div className="px-3 sm:px-4 py-1.5 bg-stone-100/80 dark:bg-[#222220] border-t border-stone-200/60 dark:border-stone-800 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <span className="text-[10px] uppercase font-bold tracking-wider text-stone-500 dark:text-stone-400 shrink-0 flex items-center gap-1">
            <Calculator className="w-3 h-3 text-[#114B43] dark:text-emerald-400" /> Math:
          </span>
          {mathSnippets.map((chip, idx) => (
            <button
              key={idx}
              id={`btn-math-chip-${idx}`}
              type="button"
              onClick={() => insertMathSnippet(chip.val)}
              className="text-xs font-mono px-2 py-0.5 rounded bg-white dark:bg-[#1c1c1a] border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors shrink-0"
              title={`Insert ${chip.val}`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Chat Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3 sm:p-4 border-t border-stone-100 dark:border-stone-800 bg-white dark:bg-[#1c1c1a] flex items-center gap-2"
      >
        <button
          type="button"
          id="btn-toggle-math-bar"
          onClick={() => setShowMathToolbar(!showMathToolbar)}
          className={`p-2 rounded-lg border transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-stone-400 ${
            showMathToolbar
              ? 'bg-[#114B43]/10 dark:bg-[#114B43]/30 border-[#114B43]/30 text-[#114B43] dark:text-emerald-400'
              : 'border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800'
          }`}
          title="Toggle Math & Equation Symbols"
          aria-label="Toggle math tools"
          aria-expanded={showMathToolbar}
        >
          <Calculator className="w-4 h-4" aria-hidden="true" />
        </button>

        <input
          ref={inputRef}
          id="input-ai-chat"
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={inputPlaceholderMap[selectedLanguage]}
          className="flex-1 px-3.5 py-2 text-xs sm:text-sm bg-stone-50 dark:bg-[#252422] rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-400 dark:focus:ring-stone-600 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 border border-stone-200 dark:border-stone-700/80 transition-colors"
        />

        <button
          id="btn-send-ai-chat"
          type="submit"
          disabled={!inputText.trim() || loading}
          className="p-2.5 bg-[#114B43] hover:bg-[#0D3F38] disabled:bg-stone-200 dark:disabled:bg-stone-800 disabled:text-stone-400 dark:disabled:text-stone-600 text-white rounded-lg transition-all shadow-2xs shrink-0 focus:outline-none focus:ring-2 focus:ring-[#114B43] focus:ring-offset-1 dark:focus:ring-offset-[#1c1c1a]"
          aria-label="Send message"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
};


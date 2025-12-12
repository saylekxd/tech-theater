# Tech Theater - Plan Projektu

## 📋 Opis Projektu
Aplikacja webowa w Next.js z **głosową interakcją** LLM i animowaną postacią.

**Główne funkcjonalności:**
- Rozmowa GŁOSOWA z LLM wcielającym się w postać z występu
- Użytkownik mówi → LLM przetwarza → Postać odpowiada głosem
- Synchronizacja animacji wideo z stanami LLM (czekanie/słuchanie/odpowiadanie)
- BRAK interfejsu tekstowego - tylko interakcja głosowa

**Stack Audio:**
- **Speech-to-Text:** Web Speech API lub OpenAI Whisper
- **LLM:** OpenAI GPT / Anthropic Claude / inne
- **Text-to-Speech:** ElevenLabs (rekomendowane) lub OpenAI TTS

---

## 🔄 Flow Aplikacji (Overview)

```
┌─────────────────────────────────────────────────────────────┐
│  1. WAITING STATE                                           │
│  ├─ Video: waiting.mp4 (loop)                              │
│  └─ UI: Button "Naciśnij aby mówić"                        │
└─────────────────────────────────────────────────────────────┘
                           │
                  [User clicks button]
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  2. LISTENING STATE                                         │
│  ├─ Video: listening.mp4 (loop)                            │
│  ├─ Audio: Nagrywanie mikrofonu (MediaRecorder)            │
│  ├─ UI: "Słucham..." + audio visualizer                    │
│  └─ Auto-stop: silence detection lub manual stop           │
└─────────────────────────────────────────────────────────────┘
                           │
                  [Recording stopped]
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  3. PROCESSING STATE (substany)                            │
│                                                              │
│  3a. TRANSCRIBING                                           │
│      ├─ Video: listening.mp4 (kontynuacja)                 │
│      ├─ API: OpenAI Whisper (Speech-to-Text)               │
│      ├─ Wysyłanie audio do /api/speech-to-text             │
│      └─ UI: "Rozpoznaję mowę..."                           │
│                           ↓                                  │
│  3b. THINKING                                               │
│      ├─ Video: listening.mp4 (kontynuacja)                 │
│      ├─ API: LLM (GPT/Claude) generates response           │
│      └─ UI: "Myślę..."                                      │
│                           ↓                                  │
│  3c. SYNTHESIZING                                           │
│      ├─ Video: listening.mp4 (kontynuacja)                 │
│      ├─ API: ElevenLabs TTS                                │
│      └─ UI: "Przygotowuję odpowiedź..."                    │
└─────────────────────────────────────────────────────────────┘
                           │
                  [Audio ready to play]
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  4. RESPONDING STATE                                        │
│  ├─ Video: responding.mp4 (loop - sync z audio)            │
│  ├─ Audio: Odtwarzanie TTS z ElevenLabs                    │
│  ├─ UI: Opcjonalna transkrypcja co mówi postać             │
│  └─ Button: "Przerwij" (stop audio)                        │
└─────────────────────────────────────────────────────────────┘
                           │
                  [Audio playback ended]
                           ↓
                    [Return to State 1]
```

---

## 🏗️ Faza 1: Setup Projektu

### 1.1 Inicjalizacja
- [X] Utworzenie projektu Next.js z TypeScript
- [X] Konfiguracja ESLint i Prettier
- [X] Setup Git i .gitignore
- [X] Instalacja podstawowych dependencji
  - [X] Tailwind CSS (styling)
  - [X] Shadcn/ui (komponenty UI - przyciski, ikony)
  - [X] Zustand lub Context API (state management)
  - [X] ElevenLabs SDK (TTS)
  - [X] OpenAI SDK (opcjonalnie dla Whisper STT)

### 1.2 Struktura Folderów
- [X] Utworzenie struktury:
  ```
  /app
    /api
      /speech-to-text
      /llm-chat
      /text-to-speech
    /components
      /VideoPlayer
      /VoiceControls
      /AudioVisualizer
    /lib
      /elevenlabs
      /llm
      /audio
    /types
  /public
    /videos
      - waiting.mp4
      - listening.mp4
      - responding.mp4
  ```

---

## 🎨 Faza 2: UI i Podstawowe Komponenty

### 2.1 Layout Główny
- [X] Stworzenie layoutu aplikacji
- [X] Responsywny design (mobile + desktop)
- [X] Sekcja na wideo (animowana postać) - główny element
- [X] Minimalistyczny interfejs - focus na postaci
- [X] Przyciski kontrolne na dole/górze

### 2.2 Video Player
- [X] Komponent VideoPlayer z trzema stanami
  - [X] Stan: `waiting` - wyświetla waiting.mp4 (loop)
  - [X] Stan: `listening` - wyświetla listening.mp4 (loop)
  - [X] Stan: `responding` - wyświetla responding.mp4 (loop + synchronizacja z audio)
- [X] Płynne przejścia między filmami
- [X] Autoplay (będzie potrzebny user gesture)
- [X] Preloading wszystkich trzech filmów
- [X] Fullscreen lub large viewport

### 2.3 Voice Controls UI
- [X] Duży button "Naciśnij aby mówić" / "Push to Talk"
- [X] Lub: "Tap to Start" z auto-detection mowy
- [X] Wizualna indykacja stanu:
  - [X] Pulsujący button podczas słuchania
  - [X] Animation podczas przetwarzania
  - [X] Disabled podczas odpowiedzi
- [X] Button "Stop/Przerwij" (aby przerwać odpowiedź)

### 2.4 Audio Visualizer (opcjonalnie)
- [X] Wizualizacja fal dźwiękowych podczas:
  - [X] Gdy użytkownik mówi
  - [X] Gdy postać odpowiada
- [X] Canvas API lub biblioteka (wavesurfer.js)

---

## 🎤 Faza 3: Speech-to-Text (STT) - OBOWIĄZKOWE

### 3.1 Wybór Metody STT
**✅ WYBRANA: OpenAI Whisper (lepsza jakość)**
- [X] Nagrywanie audio w przeglądarce (MediaRecorder)
- [X] Wysyłanie audio do API endpoint
- [X] Endpoint `/api/speech-to-text` z Whisper API
- [X] Obsługa różnych formatów (webm, mp3, wav)
- [X] Model: `whisper-1` (jedyny dostępny przez API)
- ✅ Zalety: Najlepsza jakość, wielojęzyczne, działa w każdej przeglądarce
- ✅ Bardzo dokładne rozpoznawanie polskiego
- ⚠️ Wady: Płatne (~$0.006/minuta), wymaga backendu, minimalne opóźnienie


### 3.2 Implementacja Nagrywania (dla Whisper)
- [X] Hook `useVoiceRecording` lub komponent
- [X] MediaRecorder API setup:
  ```typescript
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'audio/webm;codecs=opus' // Lub audio/mp4
  });
  ```
- [X] Start/Stop recording
- [X] Zbieranie audio chunks do Blob
- [X] Konwersja do formatu akceptowanego przez Whisper (webm/mp3/wav)
- [X] Error handling:
  - [X] Brak mikrofonu
  - [X] Permission denied
  - [X] Nieobsługiwany format
  - [X] Przeglądarka nie obsługuje MediaRecorder

### 3.3 API Endpoint `/api/speech-to-text`
- [X] Utworzenie Next.js route handler
- [X] Import OpenAI SDK:
  ```typescript
  import OpenAI from 'openai';
  
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  ```
- [X] Przyjmowanie audio jako FormData
- [X] Wywołanie Whisper API:
  ```typescript
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1",
    language: "pl", // Opcjonalne - wymusza polski
    response_format: "json",
    temperature: 0.0 // Dla większej accuracy
  });
  ```
- [X] Return transkrypcji jako JSON
- [X] Error handling i timeout (max 30s)
- [X] Rate limiting (opcjonalnie)

### 3.4 Auto-Stop Detection (ważne dla UX)
- [X] Implementacja silence detection:
  - [X] Analiza poziomu audio w real-time
  - [X] Jeśli cisza przez 1.5-2s → auto-stop
  - [X] Prevents user having to manually click "stop"
- [X] Użyj Web Audio API:
  ```typescript
  const analyser = audioContext.createAnalyser();
  // Monitoruj volume level
  // Jeśli volume < threshold przez 1.5s → stop
  ```
- [X] Lub: prostsze rozwiązanie z timeoutem

### 3.5 UI Feedback
- [X] Timer nagrywania (pokazuje ile sekund)
- [X] Wizualizacja poziomu głośności (audio meter)
- [X] Stany:
  - [X] "Słucham..." (nagrywanie)
  - [X] "Rozpoznaję mowę..." (Whisper processing ~0.5-2s)
  - [X] Wyświetlenie transkrypcji (co rozpoznał)
- [X] Button "Przerwij nagrywanie"
- [X] Max czas nagrywania (np. 60s - Whisper limit 25MB file size)

### 3.6 Whisper Best Practices
- [X] Format audio: webm/opus (najmniejszy rozmiar)
- [X] Fallback formats: mp3, mp4, wav
- [X] Parametr `language: "pl"` - przyspiesza processing
- [X] `temperature: 0.0` - maksymalna dokładność
- [X] Obsługa błędów:
  - [X] File too large (max 25MB)
  - [X] Invalid format
  - [X] API timeout (retry logic)
- [X] Cache API key validation

---

## 🤖 Faza 4: Integracja LLM (do generowania odpowiedzi)

### 4.1 API Route
- [X] Utworzenie `/api/llm-chat` endpoint
- [X] Wybór providera LLM (do tekstowych odpowiedzi):
  - [X] **OpenAI GPT-5.2** (NAJNOWSZY - 11.12.2025)
  - [X] **OpenAI GPT-4o / GPT-3.5** (alternatywy)
  - [X] **Anthropic Claude** (konfiguracja dostępna)
  - [X] **Groq** (konfiguracja dostępna)
- [X] Zarządzanie kluczem API (environment variables)
- [X] Format requestu: `{ messages: [], characterId: string }`

### 4.2 System Promptów dla Postaci
- [X] Plik konfiguracyjny `/lib/characters.ts`
- [X] Struktura:
  ```typescript
  interface Character {
    id: string;
    name: string;
    systemPrompt: string;  // Tu dodasz instrukcje postaci
    voiceId: string;       // ID głosu z ElevenLabs
    temperature: number;   // Kreatywność odpowiedzi
    maxTokens: number;     // Długość odpowiedzi
  }
  ```
- [X] Placeholder systemprompt do późniejszego dodania
- [X] Możliwość wielu postaci

### 4.3 Response Format
- [X] Zwykły response (nie streaming dla uproszczenia)
- [X] Response: `{ text: string, characterId: string, tokensUsed, model }`
- [X] Obsługa błędów i timeoutów
- [X] Limity długości odpowiedzi (aby TTS nie był za długi)

---

## 🔄 Faza 5: State Management

### 5.1 Stany Aplikacji
- [X] Typ: `AppState = 'waiting' | 'listening' | 'processing' | 'responding'`
- [X] Hook lub store do zarządzania stanem (Zustand recommended)
- [X] Synchronizacja stanu z VideoPlayer i Audio

### 5.2 Flow Stanów - GŁOSOWA INTERAKCJA
```
waiting 
  ↓ (user clicks "Speak" button)
listening (nagrywanie audio użytkownika)
  ↓ (user stops lub auto-stop po ciszy)
processing (STT → LLM → TTS generation)
  ↓ (audio ready)
responding (odtwarzanie audio + animacja)
  ↓ (audio kończy się)
waiting
```

Substany podczas `processing`:
- `transcribing` - konwersja mowy na tekst
- `thinking` - LLM generuje odpowiedź
- `synthesizing` - generowanie audio z ElevenLabs

- [X] Implementacja maszyny stanów
- [X] Event handlers dla przejść
- [X] Obsługa przerwania (user może przerwać `responding`)

### 5.3 Historia Konwersacji
- [X] Typ wiadomości:
  ```typescript
  interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;           // Tekst (transkrypcja lub odpowiedź)
    audioUrl?: string;         // Opcjonalne audio (dla asystenta)
    timestamp: number;
  }
  ```
- [X] Przechowywanie historii w state
- [X] Wysyłanie kontekstu do LLM (ostatnie N wiadomości)
- [X] Opcjonalne: Wyświetlanie transkrypcji (aby user wiedział co zrozumiał system)

---

## 🎬 Faza 6: Integracja Wideo z Audio i Logiką

### 6.1 Event Handlers
- [X] `onRecordingStart` → zmiana wideo na `listening`
- [X] `onRecordingStop` → pozostaje `listening` (lub `processing`)
- [X] `onAudioPlayStart` → zmiana wideo na `responding` (gotowe dla Fazy 7)
- [X] `onAudioPlayEnd` → zmiana wideo na `waiting` (gotowe dla Fazy 7)
- [X] Podłączenie zdarzeń do VideoPlayer

### 6.2 Synchronizacja Audio + Wideo
- [X] Automatyczna zmiana filmu na podstawie stanu aplikacji
- [X] Film `responding.mp4` na loop (jeśli audio dłuższe niż film)
- [X] Płynne przejścia między filmami z transition effects
- [X] Callback `onVideoChange` dla synchronizacji z audio

### 6.3 Optymalizacja
- [X] Enhanced preloading wszystkich filmów przy starcie z cache
- [X] Bufferowanie dla płynnych przejść
- [X] Error handling dla błędów ładowania filmów
- [X] User interaction handler dla autoplay
- [X] Debug info overlay (można wyłączyć w produkcji)

---

## 🎙️ Faza 7: Text-to-Speech z ElevenLabs - OBOWIĄZKOWE

### 7.1 Integracja ElevenLabs
**Dlaczego ElevenLabs?**
- ✅ Najlepsza jakość głosu na rynku
- ✅ Naturalność i emocje w głosie
- ✅ Możliwość klonowania głosu (jeśli masz nagrania aktora)
- ✅ Multilingual (polski obsługiwany)
- ✅ Streaming audio (dla niskich latency)

**Alternatywy (gorsza jakość):**
- OpenAI TTS - dobra, ale mniej naturalna
- Google TTS - średnia jakość
- Web Speech API - najgorsza jakość (nie polecane)

### 7.2 Setup ElevenLabs
- [X] Rejestracja na elevenlabs.io (user TODO)
- [X] Wybór planu (Free tier: 10k characters/month)
- [X] Pobranie API key (user TODO)
- [X] Dodanie do `.env.local`: `ELEVENLABS_API_KEY`
- [X] Wybór głosu lub klonowanie głosu aktora
  - [X] Przeglądanie Voice Library
  - [X] Voice ID: JBFqnCBsd6RMkjVDRZzb (George - British male)
  - [X] Zapisanie `voiceId` do konfiguracji postaci w `lib/characters.ts`

### 7.3 API Implementation
- [X] Utworzenie `/api/text-to-speech` endpoint
- [X] Instalacja: `npm install @elevenlabs/elevenlabs-js`
- [X] Implementacja:
  ```typescript
  import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
  
  // Convert text to audio
  // Return audio stream or buffer
  ```
- [X] Parametry:
  - [X] `voiceId` - ID głosu postaci
  - [X] `text` - tekst do powiedzenia
  - [X] `modelId` - `eleven_multilingual_v2` (dla polskiego)
  - [X] `voice_settings` - stability, similarity_boost, style, use_speaker_boost

### 7.4 Audio Playback
- [X] Hook `useAudioPlayback` (zamiast komponentu)
- [X] Odtwarzanie audio z API response (Blob/ArrayBuffer)
- [X] Format: MP3 (mp3_44100_128)
- [X] Event listeners:
  - [X] `onPlayStart` → trigger `responding` state
  - [X] `onPlayEnd` → trigger `waiting` state
  - [X] `onError` → error handling
- [X] Button "Stop" aby przerwać audio (interrupt handler)
- [X] Progress tracking (currentTime, duration)

### 7.5 Synchronizacja Video + Audio
- [X] Start audio = automatyczna zmiana na `responding` state
- [X] Video player automatycznie przełącza na `responding.mp4`
- [X] Loop filmu jeśli audio dłuższe (już zaimplementowane w VideoPlayer)
- [X] Jednoczesne zakończenie audio i powrót do `waiting.mp4`

### 7.6 Rekomendowane Ustawienia ElevenLabs
```typescript
// Dla naturalnej konwersacji (ZAIMPLEMENTOWANE)
{
  voice_id: "voiceId_z_characters",
  model_id: "eleven_multilingual_v2",  // Dla polskiego
  voice_settings: {
    stability: 0.5,           // 0-1: niższe = bardziej ekspresywne
    similarity_boost: 0.75,   // 0-1: dopasowanie do oryginalnego głosu
    style: 0.0,              // 0-1: styl/emocje (opcjonalne)
    use_speaker_boost: true   // Lepsza jakość
  },
  optimize_streaming_latency: 3,  // 0-4: 3 = dobry balans
  output_format: "mp3_44100_128"  // Good quality, reasonable size
}
```

---

## 🔐 Faza 8: Bezpieczeństwo i Konfiguracja

### 8.1 Environment Variables
- [ ] `.env.local`:
  ```
  # OpenAI (używane dla Whisper STT + opcjonalnie GPT LLM)
  OPENAI_API_KEY=sk-...
  
  # LLM Provider (wybierz jeden - jeśli nie używasz GPT)
  # ANTHROPIC_API_KEY=sk-ant-...   # Jeśli używasz Claude
  # GROQ_API_KEY=...               # Jeśli używasz Groq
  
  # Text-to-Speech (obowiązkowe)
  ELEVENLABS_API_KEY=...
  
  # App Config
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  NODE_ENV=development
  ```
- [ ] Walidacja kluczy API przy starcie
- [ ] Rate limiting (opcjonalne ale zalecane)
- [ ] Dodanie `.env.example` do repo (bez prawdziwych kluczy)

### 8.2 Ochrona API
- [ ] Weryfikacja origin requestów
- [ ] Rate limiting na endpointy
- [ ] Sanityzacja inputów użytkownika

---

## 🎯 Faza 9: Funkcjonalności Dodatkowe

### 9.1 Multi-Character Support (opcjonalne)
- [ ] Wybór postaci przed rozpoczęciem rozmowy
- [ ] Różne system prompty dla różnych postaci
- [ ] Różne głosy ElevenLabs dla każdej postaci
- [ ] Różne zestawy animacji (3 filmy × N postaci)
- [ ] Menu wyboru postaci

### 9.2 Historia Rozmów
- [ ] LocalStorage dla historii konwersacji
- [ ] Wyświetlanie transkrypcji (co user powiedział, co postać odpowiedziała)
- [ ] Button "Nowa rozmowa" (reset historii)
- [ ] Export transkrypcji do TXT
- [ ] Opcjonalnie: zapis nagrań audio

### 9.3 Ustawienia
- [ ] Regulacja głośności audio odpowiedzi
- [ ] Wybór trybu STT:
  - [ ] Web Speech API (darmowy)
  - [ ] Whisper (płatny, lepsza jakość)
- [ ] Toggle transkrypcji na ekranie
- [ ] Ustawienia języka interfejsu
- [ ] Debug mode (pokazuje substany: transcribing, thinking, etc.)

---

## 🧪 Faza 10: Testowanie

### 10.1 Testy Funkcjonalne
- [ ] Test przejść między stanami (waiting→listening→processing→responding→waiting)
- [ ] Test nagrywania audio (mikrofon działa)
- [ ] Test STT (rozpoznaje mowę po polsku)
- [ ] Test integracji z LLM (odpowiada sensownie)
- [ ] Test TTS z ElevenLabs (audio gra poprawnie)
- [ ] Test synchronizacji wideo + audio

### 10.2 Testy Audio
- [ ] Test z różnymi mikrofonami
- [ ] Test poziomu głośności (za głośno/cicho)
- [ ] Test z szumem w tle
- [ ] Test przerwania audio w trakcie
- [ ] Test kolejkowania (czy działa po sobie)

### 10.3 Testy UX
- [ ] Test na różnych przeglądarkach:
  - [ ] Chrome (główny target)
  - [ ] Safari (Web Speech API ma ograniczenia)
  - [ ] Firefox
  - [ ] Mobile browsers
- [ ] Test responsywności (mobile + desktop)
- [ ] Test wydajności (loading filmów, latency)
- [ ] Test z wolnym internetem (czy nie timeout)

### 10.4 Testy Edge Cases
- [ ] Co jeśli user nie da permisji do mikrofonu?
- [ ] Co jeśli API zwróci błąd?
- [ ] Co jeśli user mówi za długo?
- [ ] Co jeśli user klika wielokrotnie "Speak"?
- [ ] Co jeśli API timeout (LLM lub ElevenLabs)?

---

## 🚀 Faza 11: Deployment

### 11.1 Przygotowanie
- [ ] Optymalizacja buildów
- [ ] Kompresja assetów (wideo)
- [ ] Setup CDN dla filmów (opcjonalne)

### 11.2 Deploy
- [ ] Wybór platformy:
  - [ ] Vercel (rekomendowane dla Next.js)
  - [ ] Netlify
  - [ ] Custom VPS
- [ ] Konfiguracja environment variables
- [ ] Konfiguracja domeny (opcjonalne)

### 11.3 Monitoring
- [ ] Setup analytics (opcjonalne)
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring

---

## 📝 Faza 12: Dokumentacja

### 12.1 Dokumentacja Techniczna
- [ ] README.md z instrukcją uruchomienia
- [ ] Dokumentacja API endpoints
- [ ] Opis architektury

### 12.2 Instrukcje dla Użytkownika
- [ ] Jak dodać nowe prompty postaci
- [ ] Jak wymienić filmy animacji
- [ ] Troubleshooting

---

## 🎭 Faza 13: Personalizacja Postaci i Głosu

### 13.1 System Promptów
- [ ] Utworzenie pliku `/lib/characters.ts`
- [ ] Interface:
  ```typescript
  interface Character {
    id: string;
    name: string;
    description: string;
    systemPrompt: string;      // Instrukcje jak ma rozmawiać
    voiceId: string;            // ID głosu z ElevenLabs
    videoSet: {
      waiting: string;
      listening: string;
      responding: string;
    };
    llmConfig: {
      temperature: number;      // 0.7-1.0 dla kreatywności
      maxTokens: number;        // Max długość odpowiedzi
      model: string;            // gpt-4, claude-3-opus, etc.
    };
  }
  ```
- [ ] Import instrukcji postaci (gdy będą gotowe od Ciebie)
- [ ] Możliwość wielu postaci

### 13.2 Wybór Głosu ElevenLabs
- [ ] Opcja A: Wybór z Voice Library ElevenLabs
  - [ ] Przeglądnij https://elevenlabs.io/voice-library
  - [ ] Wybierz głos pasujący do postaci
  - [ ] Skopiuj Voice ID
- [ ] Opcja B: Voice Cloning (jeśli masz nagrania aktora)
  - [ ] Nagraj 3-5 minut mowy aktora (czysty audio)
  - [ ] Upload do ElevenLabs → Instant Voice Cloning
  - [ ] Otrzymasz Voice ID

### 13.3 Dostrojenie Zachowania
- [ ] Testy różnych `temperature` dla LLM (0.7-1.0)
- [ ] Dostrojenie długości odpowiedzi (krótsze = lepsze dla dialogu)
- [ ] Testy ElevenLabs `voice_settings`:
  - [ ] `stability` (0.0-1.0) - 0.5 default
  - [ ] `similarity_boost` (0.0-1.0) - 0.75 default
  - [ ] `style` (opcjonalnie dla emocji)
- [ ] A/B testy różnych promptów
- [ ] Iteracja na podstawie feedbacku użytkowników

---

## ⚡ Faza 14: Optymalizacja Latency (Ważne!)

### 14.1 Problem Latency w Voice Apps
```
User mówi (3s) 
  → STT (0.5-2s) 
  → LLM (1-5s) 
  → TTS (1-3s) 
  → Total: 5-13s opóźnienia!
```

### 14.2 Optymalizacje STT (Whisper)
- [ ] **Whisper latency:** ~0.5-2s w zależności od długości audio
- [ ] Optymalizacje:
  - [ ] Wysyłaj audio zaraz po zakończeniu nagrania
  - [ ] Używaj kompresji audio (webm/opus - mniejsze pliki)
  - [ ] Auto-detect końca wypowiedzi (silence detection)
  - [ ] Nie czekaj aż user kliknie "stop" - auto-stop po 1-2s ciszy
- [ ] Alternatywa: Web Speech API jako fallback (0 latency ale gorsza jakość)

### 14.3 Optymalizacje LLM
- [ ] Użyj szybszego modelu:
  - GPT-3.5-turbo zamiast GPT-4 (4x szybszy)
  - Groq (ultra szybki inference)
  - Claude 3 Haiku (szybki, tańszy)
- [ ] Ogranicz `max_tokens` (krótsze odpowiedzi = szybsze)
- [ ] Streaming response (opcjonalnie)

### 14.4 Optymalizacje TTS
- [ ] **ElevenLabs Streaming** (najważniejsze!)
  - [ ] Użyj `/v1/text-to-speech/{voice_id}/stream`
  - [ ] Audio zaczyna grać natychmiast (chunk by chunk)
  - [ ] Redukuje latency z 3s → 0.5s
- [ ] Użyj `optimize_streaming_latency` parameter
- [ ] Cache popularnych fraz (opcjonalnie)

### 14.5 UX dla Latency
- [ ] Loading indicators z procentami
- [ ] "Myślę..." message podczas LLM processing
- [ ] Animacja "thinking" w czasie przetwarzania
- [ ] Preload pierwszej części audio (streaming)
- [ ] Feedback: "Przetwarzam..." → "Za chwilę odpowiem..."

### 14.6 Target Latency (cel)
- ✅ Ideal: <3s od końca mowy do początku odpowiedzi
- ⚠️ Acceptable: 3-5s
- ❌ Too slow: >5s

---

## 📊 Priorytety

### Must Have (MVP) - Głosowa Interakcja
1. ✅ Setup Next.js z TypeScript (DONE - Faza 1)
2. ✅ Video player z trzema stanami (DONE - Faza 2)
3. ✅ State management (Zustand) (DONE - Faza 2 & 5)
4. ✅ Voice controls UI (DONE - Faza 2)
5. ✅ **Speech-to-Text** (Whisper) (DONE - Faza 3)
6. ✅ **Integracja z LLM GPT-5.2** (DONE - Faza 4)
7. ✅ **Synchronizacja wideo z logiką** (DONE - Faza 6)
8. ✅ **Text-to-Speech z ElevenLabs** (DONE - Faza 7) 🎉

## 🎉 MVP COMPLETE! Pełny workflow gotowy:
User mówi → Whisper STT → GPT-5.2 LLM → ElevenLabs TTS → Audio + Video playback

### Nice to Have (V2)
- Multi-character support (kilka postaci)
- Historia rozmów z transkrypcją
- Audio visualizer
- Wybór metody STT w ustawieniach
- Export transkrypcji

### Future Enhancements (V3)
- Voice cloning dla konkretnego aktora
- Emotions detection (zmiana tonu głosu)
- Admin panel do zarządzania postaciami
- Analytics rozmów
- Mobile app (React Native)
- Tryb offline (edge cases)

---

## 🛠️ Stack Technologiczny

**Frontend:**
- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
- Shadcn/ui (komponenty)
- Zustand (state management)

**Backend (Next.js API Routes):**
- `/api/speech-to-text` - **OpenAI Whisper** (główny STT)
- `/api/llm-chat` - OpenAI GPT / Anthropic Claude / Groq
- `/api/text-to-speech` - **ElevenLabs API** (główny TTS)

**Audio/Video:**
- MediaRecorder API (nagrywanie)
- HTML5 Video (animacje)
- HTML5 Audio (odtwarzanie TTS)
- Web Speech API (opcjonalne STT)

**External APIs:**
- **ElevenLabs** - Text-to-Speech (OBOWIĄZKOWE) ✅
- **OpenAI Whisper** - Speech-to-Text (WYBRANE) ✅
- **OpenAI GPT / Anthropic Claude / Groq** - LLM (do wyboru)

**Deployment:**
- Vercel (recommended) - zero-config dla Next.js
- Cloudflare R2 / AWS S3 - hosting filmów (opcjonalnie)

**Development:**
- pnpm / npm - package manager
- ESLint + Prettier
- Git

---

## 📌 Notatki i Decyzje

### Do Uzupełnienia:
- [ ] **System prompt postaci** - dostosować w `lib/characters.ts` (Faza 4.2)
- [X] **Wybór providera LLM:**
  - ✅ OpenAI GPT-5.2 (NAJNOWSZY - 11.12.2025) - UŻYWANY
  - OpenAI GPT-4o / GPT-4-turbo (alternatywy)
  - Anthropic Claude (dostępne w konfiguracji)
  - Groq (dostępne w konfiguracji)
- [ ] **Przygotować 3 filmy animacji:**
  - `waiting.mp4` - postać czeka na interakcję (loop)
  - `listening.mp4` - postać słucha użytkownika (loop)
  - `responding.mp4` - postać mówi/odpowiada (loop)
  - Zalecane: <10MB każdy, format MP4, H.264
- [ ] **Zarejestrować konta:**
  - OpenAI account + API key (dla Whisper + opcjonalnie GPT)
  - ElevenLabs account + API key
  - (Opcjonalnie) Anthropic/Groq jeśli wybierzesz inny LLM

### ✅ Potwierdzone Decyzje:
- ✅ **STT: OpenAI Whisper** (lepsza jakość niż Web Speech API)
- ✅ **TTS: ElevenLabs** (najlepsza jakość głosu)
- ✅ **Tryb: Tylko głosowa interakcja** (brak chatu tekstowego)
- ✅ **Framework: Next.js** z TypeScript

### Koszty (szacowane):
- **ElevenLabs:**
  - Free Tier: 10,000 znaków/miesiąc (darmowe, ~10-15 min mowy)
  - Creator: $11/mo - 100,000 znaków (~1.5h mowy)
- **OpenAI Whisper:** ~$0.006/minuta
  - Przykład: 100 rozmów × 2 min = $1.20/miesiąc
- **LLM:**
  - GPT-3.5-turbo: ~$0.002/1000 tokenów (bardzo tanie)
  - GPT-4: ~$0.03/1000 tokenów (droższe, ale lepsze)
  - Claude/Groq: podobnie
- **Deployment (Vercel):** Darmowy dla hobby projectów
- **TOTAL dla MVP:** ~$15-30/miesiąc (z umiarkowanym użyciem)

---

## 🚀 Quick Start Guide (gdy zaczniesz implementację)

### Krok 1: Setup
```bash
npx create-next-app@latest tech-theater --typescript --tailwind --app
cd tech-theater
npm install elevenlabs openai zustand @radix-ui/react-icons
```

### Krok 2: Struktura
```
/app
  /api
    /speech-to-text/route.ts
    /llm-chat/route.ts
    /text-to-speech/route.ts
  /components
    /VideoPlayer.tsx
    /VoiceControls.tsx
  /lib
    /characters.ts
    /elevenlabs.ts
  page.tsx
```

### Krok 3: Env Variables
```bash
# .env.local
OPENAI_API_KEY=your_key_here      # Dla Whisper STT (+ opcjonalnie GPT)
ELEVENLABS_API_KEY=your_key_here  # Dla TTS
# ANTHROPIC_API_KEY=...           # Jeśli używasz Claude zamiast GPT
```

### Krok 4: Dodaj Filmy
```
/public/videos/
  waiting.mp4
  listening.mp4
  responding.mp4
```

### Krok 5: Zaimplementuj w kolejności:
1. VideoPlayer (najprostsze)
2. State management (Zustand)
3. Voice recording (MediaRecorder + auto-stop)
4. API routes:
   - `/api/speech-to-text` (Whisper)
   - `/api/llm-chat` (GPT/Claude/Groq)
   - `/api/text-to-speech` (ElevenLabs)
5. Integration & synchronizacja wszystkich komponentów

### Krok 6: Testowanie
- Test nagrywania → sprawdź czy audio się nagrywa
- Test Whisper → sprawdź czy rozpoznaje polski
- Test LLM → sprawdź czy odpowiada sensownie
- Test ElevenLabs → sprawdź czy mówi naturalnie
- Test synchronizacji → sprawdź czy video zmienia się z audio

---

---

## ❓ FAQ - Najczęstsze Pytania

### Q: Czy mogę używać innego TTS niż ElevenLabs?
**A:** Tak, ale ElevenLabs ma najlepszą jakość. Alternatywy:
- OpenAI TTS (dobra jakość, ale mniej naturalna)
- Google Cloud TTS (średnia)
- Web Speech API (najgorsza - nie polecane)

### Q: Ile kosztuje ElevenLabs?
**A:** 
- Free tier: 10,000 znaków/miesiąc (~10-15 minut mowy)
- Creator: $11/mo - 100,000 znaków (~1.5h mowy)
- Pro: $99/mo - 500,000 znaków (~8h mowy)

### Q: Czy potrzebuję płatnego konta OpenAI?
**A:** 
- **Dla Whisper (STT): TAK** - wybrana opcja, bardzo tanie (~$0.006/minuta)
- Dla GPT (LLM): Opcjonalnie - możesz użyć Claude lub Groq zamiast GPT
- Koszt Whisper: ~$1-2/miesiąc dla umiarkowanego użycia
- Alternatywa dla LLM: Claude (Anthropic) lub Groq

### Q: Czy działa na telefonach?
**A:** 
- ✅ **TAK** - Whisper działa na wszystkich przeglądarkach!
- iOS Safari: ✅ Pełne wsparcie (MediaRecorder)
- Android Chrome: ✅ Pełne wsparcie
- Wymaga tylko permisji do mikrofonu
- Whisper nie wymaga specyficznej przeglądarki (w przeciwieństwie do Web Speech API)

### Q: Jak przyspieszyć odpowiedzi?
**A:**
1. **Użyj ElevenLabs streaming** (najważniejsze! redukuje latency z 3s → 0.5s)
2. Użyj szybszego LLM (GPT-3.5 zamiast GPT-4, lub Groq)
3. Ogranicz długość odpowiedzi (`max_tokens` ~150-300)
4. Auto-stop nagrywania po ciszy (nie czekaj na manual stop)
5. Kompresuj audio przed wysłaniem do Whisper (webm/opus)

### Q: Czy mogę mieć wiele postaci?
**A:** Tak! Każda postać ma:
- Własny system prompt
- Własny głos ElevenLabs (voice_id)
- Własny zestaw 3 filmów animacji
- Selector w UI do wyboru postaci

### Q: Co jeśli user nie da permisji do mikrofonu?
**A:** 
- Obsłuż error gracefully
- Pokaż instrukcję jak włączyć mikrofon
- Fallback: brak - aplikacja wymaga mikrofonu

### Q: Dlaczego Whisper zamiast Web Speech API?
**A:**
- ✅ Lepsza jakość rozpoznawania (~95% vs ~70-80%)
- ✅ Działa na wszystkich przeglądarkach (iOS Safari, Firefox, etc.)
- ✅ Lepsze rozpoznawanie polskiego języka
- ✅ Nie wymaga specyficznej przeglądarki
- ⚠️ Wady: Płatne (~$0.006/min), minimalne opóźnienie (~0.5-2s)
- 💡 Web Speech API można dodać jako fallback

### Q: Jakie są limity Whisper?
**A:**
- Max wielkość pliku: 25MB
- Max długość audio: brak oficjalnego limitu, ale rekomendowane <10 min
- Formaty: mp3, mp4, mpeg, mpga, m4a, wav, webm
- Koszt: $0.006 za minutę audio (bardzo tanie!)
- Rate limits: 50 requests/min (więcej niż potrzeba)

### Q: Jak długie mogą być filmy?
**A:**
- Rekomendacja: 3-10 sekund każdy
- Format: MP4, H.264, <10MB
- Filmy będą loopowane, więc mogą być krótkie
- `responding.mp4` powinien być najdłuższy

### Q: Czy mogę użyć głosu mojego aktora?
**A:** Tak! ElevenLabs Voice Cloning:
- Potrzebujesz 3-5 minut czystego audio aktora
- Upload do ElevenLabs → Instant Voice Cloning
- Otrzymasz unique voice_id
- Plan Professional+ wymagany ($99/mo)

---

**Status:** ⏳ Projekt w planowaniu
**Data utworzenia:** 12.12.2025
**Wersja planu:** 2.0 (Voice-Only)
**Ostatnia aktualizacja:** 12.12.2025

